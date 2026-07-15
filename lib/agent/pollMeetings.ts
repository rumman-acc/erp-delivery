import { createServiceClient } from "@/lib/supabase/service";
import { getValidAccessTokenForConnection } from "@/lib/microsoft/connection";
import { resolveOnlineMeetingId, listTranscripts, getTranscriptContent } from "@/lib/microsoft/graph";
import { extractSuggestions, type ExtractedSuggestion } from "@/lib/claude/extractSuggestions";
import { redactSuggestion } from "@/lib/agent/redact";

export type PollResult = {
  checked: number;
  fetched: number;
  stillPending: number;
  unavailable: number;
  errors: number;
  suggestionsCreated: number;
};

// A meeting that never actually happened over Teams audio (e.g. an
// "[In-person]" standup with a calendar-only Teams link) will never get a
// transcript — Graph has nothing to ever return. Past this grace period
// past end_time, stop treating "not found yet" as "check again later" and
// settle it into 'unavailable' instead of polling it forever.
const NO_TRANSCRIPT_GRACE_MS = 2 * 60 * 60 * 1000;

// One meeting can be linked to several projects (e.g. a shared daily
// standup) — extraction happens once per meeting, and each suggestion
// carries its own resolved project_id (Claude's tagged projectName,
// resolved against this meeting's actual linked projects), rather than one
// project_id shared by the whole batch. new_project suggestions have no
// projectName at all (they're proposing a project that doesn't exist yet),
// so they fall back to the meeting's first linked project purely so the
// row has a valid FK to attach to for review purposes — commitSuggestionBatch
// doesn't use it for new_project rows.
function toSuggestionRow(
  meetingSourceId: string,
  linkedProjects: { id: string; name: string }[],
  batchId: string,
  s: ExtractedSuggestion
) {
  const { suggestionType, supportingQuote, confidence, ...payload } = s;
  const projectName = "projectName" in s ? s.projectName : undefined;
  const resolvedProject =
    (projectName && linkedProjects.find((p) => p.name === projectName)) || linkedProjects[0];

  // projectName isn't part of the stored payload — it was only needed to
  // resolve project_id, and the reviewer picks/confirms the project via its
  // own field in the UI, not by re-editing this text.
  const { projectName: _drop, ...restPayload } = payload as typeof payload & { projectName?: string };
  void _drop;

  return {
    meeting_source_id: meetingSourceId,
    project_id: resolvedProject.id,
    suggestion_type: suggestionType,
    origin: "agent" as const,
    payload: restPayload,
    original_payload: restPayload,
    supporting_quote: supportingQuote,
    confidence,
    batch_id: batchId,
  };
}

// Shared by the scheduled cron route (all projects, service-role auth via
// CRON_SECRET) and the on-demand "check now" Server Action (every project
// the caller can edit 'agent' on) — same logic either way, just optionally
// scoped. Detects that a linked, ended meeting now has a transcript
// available and classifies its content into requirements / new processes /
// action items / risks / issues / new projects (plan-agentic.md §10 step 7,
// generalized). Deliberately does not persist the raw transcript text —
// only ever held in memory for the one extraction call.
export async function pollMeetings(options?: { projectId?: string }): Promise<PollResult> {
  const supabase = createServiceClient();

  let query = supabase
    .from("meeting_sources")
    .select("id,connection_id,join_url,graph_meeting_id,end_time,meeting_source_projects!inner(project_id,projects(name))")
    .eq("transcript_status", "pending")
    .lt("end_time", new Date().toISOString());
  if (options?.projectId) {
    query = query.eq("meeting_source_projects.project_id", options.projectId);
  }
  const { data: pendingMeetings, error } = await query;
  if (error) throw error;

  const results: PollResult = { checked: 0, fetched: 0, stillPending: 0, unavailable: 0, errors: 0, suggestionsCreated: 0 };
  // Avoid refreshing the same connection's token once per meeting when one
  // admin has multiple linked meetings ready to check in the same run.
  const tokenCache = new Map<string, string | null>();

  async function accessTokenFor(connectionId: string): Promise<string | null> {
    if (tokenCache.has(connectionId)) return tokenCache.get(connectionId) ?? null;
    const valid = await getValidAccessTokenForConnection(supabase, connectionId);
    tokenCache.set(connectionId, valid?.accessToken ?? null);
    return valid?.accessToken ?? null;
  }

  const { data: allProjects } = await supabase.from("projects").select("name");
  const allProjectNames = (allProjects ?? []).map((p) => p.name);

  for (const meeting of pendingMeetings ?? []) {
    results.checked++;
    const pastGracePeriod = Date.now() - new Date(meeting.end_time).getTime() > NO_TRANSCRIPT_GRACE_MS;

    // When options.projectId scopes the query, Postgres still returns every
    // linked project for a matching meeting (the !inner filter only decides
    // which meetings match, not which join rows come back) — exactly what
    // we want, since extraction should see the meeting's full linked set
    // regardless of which project triggered this check.
    const linkedProjects = (meeting.meeting_source_projects ?? [])
      .map((msp) => {
        const project = Array.isArray(msp.projects) ? msp.projects[0] : msp.projects;
        return project ? { id: msp.project_id, name: project.name } : null;
      })
      .filter((p): p is { id: string; name: string } => p !== null);

    if (linkedProjects.length === 0) {
      // Shouldn't happen (a meeting only exists once linked to at least one
      // project), but don't crash the whole run over one malformed row.
      results.errors++;
      continue;
    }

    try {
      const accessToken = await accessTokenFor(meeting.connection_id);
      if (!accessToken) {
        // Connection expired/revoked — surfaced to the admin via the
        // connection card's status, not by erroring every linked meeting.
        results.errors++;
        continue;
      }

      let onlineMeetingId: string | null = meeting.graph_meeting_id;
      if (!onlineMeetingId) {
        if (!meeting.join_url) {
          await supabase.from("meeting_sources").update({ transcript_status: "error" }).eq("id", meeting.id);
          results.errors++;
          continue;
        }
        onlineMeetingId = await resolveOnlineMeetingId(accessToken, meeting.join_url);
        if (!onlineMeetingId) {
          if (pastGracePeriod) {
            await supabase.from("meeting_sources").update({ transcript_status: "unavailable" }).eq("id", meeting.id);
            results.unavailable++;
          } else {
            results.stillPending++; // Teams hasn't registered the online meeting yet — retry next run
          }
          continue;
        }
        await supabase.from("meeting_sources").update({ graph_meeting_id: onlineMeetingId }).eq("id", meeting.id);
      }

      const transcripts = await listTranscripts(accessToken, onlineMeetingId);
      if (transcripts.length === 0) {
        if (pastGracePeriod) {
          await supabase.from("meeting_sources").update({ transcript_status: "unavailable" }).eq("id", meeting.id);
          results.unavailable++;
        } else {
          results.stillPending++; // meeting ended, but Teams hasn't finished generating a transcript yet
        }
        continue;
      }

      const transcriptText = await getTranscriptContent(accessToken, onlineMeetingId, transcripts[0].id);
      const rawExtracted = await extractSuggestions(
        transcriptText,
        linkedProjects.map((p) => p.name),
        allProjectNames
      );

      // Defense-in-depth: scrub common secret/PII patterns from every
      // extracted field before anything is stored or shown to a reviewer,
      // regardless of whether the model's own guardrail instructions held.
      let redactedCount = 0;
      const extracted = rawExtracted.map((s) => {
        const { suggestion, count } = redactSuggestion(s as unknown as Record<string, unknown>);
        redactedCount += count;
        return suggestion as unknown as ExtractedSuggestion;
      });

      const batchId = crypto.randomUUID();
      if (extracted.length > 0) {
        const { error: insertError } = await supabase
          .from("agent_suggestions")
          .insert(extracted.map((s) => toSuggestionRow(meeting.id, linkedProjects, batchId, s)));
        if (insertError) throw insertError;
      }

      await supabase
        .from("meeting_sources")
        .update({ transcript_status: "fetched", transcript_fetched_at: new Date().toISOString() })
        .eq("id", meeting.id);

      // One audit entry per linked project — matches how linking itself is
      // logged, and keeps each project's own audit trail complete even
      // though extraction ran once for the whole meeting.
      for (const project of linkedProjects) {
        await supabase.from("agent_audit_log").insert({
          project_id: project.id,
          actor_type: "agent",
          action: "suggestions.created",
          entity_type: "meeting_sources",
          entity_id: meeting.id,
          details: { batch_id: batchId, count: extracted.length },
        });

        // Visible in the Audit Log so a fired guardrail isn't invisible —
        // never logs the redacted value itself, only that a pattern matched.
        if (redactedCount > 0) {
          await supabase.from("agent_audit_log").insert({
            project_id: project.id,
            actor_type: "agent",
            action: "suggestion.redacted",
            entity_type: "meeting_sources",
            entity_id: meeting.id,
            details: { batch_id: batchId, redactions: redactedCount },
          });
        }
      }

      results.fetched++;
      results.suggestionsCreated += extracted.length;
    } catch (err) {
      console.error(`pollMeetings: error processing meeting_sources.id=${meeting.id}:`, err);
      await supabase.from("meeting_sources").update({ transcript_status: "error" }).eq("id", meeting.id);
      results.errors++;
    }
  }

  return results;
}
