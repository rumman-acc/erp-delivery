import { createServiceClient } from "@/lib/supabase/service";
import { getValidAccessTokenForConnection } from "@/lib/microsoft/connection";
import { resolveOnlineMeetingId, listTranscripts, getTranscriptContent } from "@/lib/microsoft/graph";
import { extractRequirements } from "@/lib/claude/extractRequirements";

export type PollResult = {
  checked: number;
  fetched: number;
  stillPending: number;
  errors: number;
  suggestionsCreated: number;
};

// Shared by the scheduled cron route (all projects, service-role auth via
// CRON_SECRET) and the on-demand "check now" Server Action (one project,
// gated by requireEdit) — same logic either way, just optionally scoped.
// Detects that a linked, ended meeting now has a transcript available and
// extracts candidate requirements from it. Deliberately does not persist
// the raw transcript text (plan-agentic.md §6/§10 step 6) — only ever held
// in memory for the one extraction call.
export async function pollMeetings(options?: { projectId?: string }): Promise<PollResult> {
  const supabase = createServiceClient();

  let query = supabase
    .from("meeting_sources")
    .select("id,project_id,connection_id,join_url,graph_meeting_id")
    .eq("transcript_status", "pending")
    .lt("end_time", new Date().toISOString());
  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  const { data: pendingMeetings, error } = await query;
  if (error) throw error;

  const results: PollResult = { checked: 0, fetched: 0, stillPending: 0, errors: 0, suggestionsCreated: 0 };
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
          results.stillPending++; // Teams hasn't registered the online meeting yet — retry next run
          continue;
        }
        await supabase.from("meeting_sources").update({ graph_meeting_id: onlineMeetingId }).eq("id", meeting.id);
      }

      const transcripts = await listTranscripts(accessToken, onlineMeetingId);
      if (transcripts.length === 0) {
        results.stillPending++; // meeting ended, but Teams hasn't finished generating a transcript yet
        continue;
      }

      const transcriptText = await getTranscriptContent(accessToken, onlineMeetingId, transcripts[0].id);
      const extracted = await extractRequirements(transcriptText);

      const batchId = crypto.randomUUID();
      if (extracted.length > 0) {
        const { error: insertError } = await supabase.from("agent_suggestions").insert(
          extracted.map((r) => ({
            meeting_source_id: meeting.id,
            project_id: meeting.project_id,
            suggestion_type: "requirement",
            origin: "agent",
            payload: { description: r.description, type: r.type, priority: r.priority },
            original_payload: { description: r.description, type: r.type, priority: r.priority },
            supporting_quote: r.supportingQuote,
            confidence: r.confidence,
            batch_id: batchId,
          }))
        );
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
