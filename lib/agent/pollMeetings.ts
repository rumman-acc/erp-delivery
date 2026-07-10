import { createServiceClient } from "@/lib/supabase/service";
import { getValidAccessTokenForConnection } from "@/lib/microsoft/connection";
import { resolveOnlineMeetingId, listTranscripts, getTranscriptContent } from "@/lib/microsoft/graph";
import { extractSuggestions, type ExtractedSuggestion } from "@/lib/claude/extractSuggestions";

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

function toSuggestionRow(
  meetingSourceId: string,
  projectId: string,
  batchId: string,
  s: ExtractedSuggestion
) {
  const { suggestionType, supportingQuote, confidence, ...payload } = s;
  return {
    meeting_source_id: meetingSourceId,
    project_id: projectId,
    suggestion_type: suggestionType,
    origin: "agent" as const,
    payload,
    original_payload: payload,
    supporting_quote: supportingQuote,
    confidence,
    batch_id: batchId,
  };
}

// Shared by the scheduled cron route (all projects, service-role auth via
// CRON_SECRET) and the on-demand "check now" Server Action (one project,
// gated by requireEdit) — same logic either way, just optionally scoped.
// Detects that a linked, ended meeting now has a transcript available and
// classifies its content into requirements / new processes / action items /
// risks / issues (plan-agentic.md §10 step 7, generalized). Deliberately
// does not persist the raw transcript text — only ever held in memory for
// the one extraction call.
export async function pollMeetings(options?: { projectId?: string }): Promise<PollResult> {
  const supabase = createServiceClient();

  let query = supabase
    .from("meeting_sources")
    .select("id,project_id,connection_id,join_url,graph_meeting_id,end_time")
    .eq("transcript_status", "pending")
    .lt("end_time", new Date().toISOString());
  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
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

  for (const meeting of pendingMeetings ?? []) {
    results.checked++;
    const pastGracePeriod = Date.now() - new Date(meeting.end_time).getTime() > NO_TRANSCRIPT_GRACE_MS;

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
      const extracted = await extractSuggestions(transcriptText);

      const batchId = crypto.randomUUID();
      if (extracted.length > 0) {
        const { error: insertError } = await supabase
          .from("agent_suggestions")
          .insert(extracted.map((s) => toSuggestionRow(meeting.id, meeting.project_id, batchId, s)));
        if (insertError) throw insertError;
      }

      await supabase
        .from("meeting_sources")
        .update({ transcript_status: "fetched", transcript_fetched_at: new Date().toISOString() })
        .eq("id", meeting.id);

      await supabase.from("agent_audit_log").insert({
        project_id: meeting.project_id,
        actor_type: "agent",
        action: "suggestions.created",
        entity_type: "meeting_sources",
        entity_id: meeting.id,
        details: { batch_id: batchId, count: extracted.length },
      });

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
