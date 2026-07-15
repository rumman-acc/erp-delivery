"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canEditModule } from "@/lib/permissions";
import { getMyProjects } from "@/lib/data/project";
import { pollMeetings, type PollResult } from "@/lib/agent/pollMeetings";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function disconnectMicrosoft() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { error: "Not signed in" };

  // Filtered explicitly to the caller's own row — RLS would also allow a
  // Super Admin to delete here, but without this filter a Super Admin
  // disconnecting "their own" account could wipe every connection in the
  // table (delete() with no filter deletes every row RLS permits).
  const { error } = await supabase.from("agent_connections").delete().eq("connected_by", userId);
  if (error) return { error: error.message };

  await supabase.from("agent_audit_log").insert({
    actor_type: "human",
    actor_id: userId,
    action: "connection.revoked",
    entity_type: "agent_connections",
  });

  revalidatePath("/agent");
  refresh();
}

// Fired every 5 seconds while the AI Agent page is open (see
// AutoPollTrigger) so an admin watching the page sees a just-finished
// meeting's transcript land without reloading. This carries the real load —
// the Vercel Hobby plan caps cron jobs at once/day, so the daily cron
// (vercel.json) is only a distant backstop for closed tabs, not a
// near-real-time path.
//
// AI Agent is a global page now (not project-specific), so this checks
// every project the caller has 'agent' edit access on, not just one —
// mirrors what the daily cron already does (pollMeetings() with no
// projectId filter checks every project in the database; this checks every
// project *this caller* is allowed to edit).
export async function checkMeetingsNow(): Promise<PollResult> {
  const projects = await getMyProjects();
  const editable = await Promise.all(projects.map((p) => canEditModule(p.id, "agent")));
  const editableProjectIds = projects.filter((_, i) => editable[i]).map((p) => p.id);

  const aggregate: PollResult = { checked: 0, fetched: 0, stillPending: 0, unavailable: 0, errors: 0, suggestionsCreated: 0 };
  for (const projectId of editableProjectIds) {
    const r = await pollMeetings({ projectId });
    aggregate.checked += r.checked;
    aggregate.fetched += r.fetched;
    aggregate.stillPending += r.stillPending;
    aggregate.unavailable += r.unavailable;
    aggregate.errors += r.errors;
    aggregate.suggestionsCreated += r.suggestionsCreated;
  }

  revalidatePath("/agent");
  refresh();
  return aggregate;
}

// A meeting (e.g. a shared daily standup) can be linked to several projects
// at once — one meeting_sources row per real calendar event, linked to
// however many projects via meeting_source_projects. No explicit
// requireEdit precheck here (unlike most actions): the UI only ever offers
// projects the caller can already edit 'agent' on as checkboxes, and
// meeting_source_projects_insert's own RLS enforces can_edit_module per
// row regardless — if any selected project fails that check, the whole
// insert fails atomically rather than partially linking.
export async function linkMeeting(projectIds: string[], formData: FormData) {
  if (projectIds.length === 0) return { error: "Pick at least one project" };

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { error: "Not signed in" };

  const { data: connection } = await supabase
    .from("agent_connections")
    .select("id")
    .eq("connected_by", userId)
    .maybeSingle();
  if (!connection) return { error: "Connect your Microsoft account first" };

  const graphEventId = str(formData, "graph_event_id");
  const subject = str(formData, "subject");

  // unique(connection_id, graph_event_id) means re-clicking an already-linked
  // meeting (e.g. a double click) fails loudly instead of creating a duplicate.
  const { data: meetingSource, error: meetingError } = await supabase
    .from("meeting_sources")
    .insert({
      connection_id: connection.id,
      graph_event_id: graphEventId,
      subject,
      organizer_email: str(formData, "organizer_email"),
      start_time: str(formData, "start_time"),
      end_time: str(formData, "end_time") || null,
      join_url: str(formData, "join_url") || null,
      linked_by: userId,
    })
    .select("id")
    .single();
  if (meetingError) return { error: meetingError.message };

  const { error: linkError } = await supabase
    .from("meeting_source_projects")
    .insert(projectIds.map((projectId) => ({ meeting_source_id: meetingSource.id, project_id: projectId, linked_by: userId })));
  if (linkError) return { error: linkError.message };

  for (const projectId of projectIds) {
    await supabase.from("agent_audit_log").insert({
      project_id: projectId,
      actor_type: "human",
      actor_id: userId,
      action: "meeting.linked",
      entity_type: "meeting_sources",
      details: { subject, graph_event_id: graphEventId },
    });
  }

  revalidatePath("/agent");
  refresh();
}
