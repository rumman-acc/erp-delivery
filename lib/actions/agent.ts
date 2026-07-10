"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";
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

// Fired once when the AI Agent page loads (see AutoPollTrigger) so an
// admin doesn't have to wait for the next scheduled cron tick (vercel.json,
// every 2 minutes) to see a just-finished meeting's transcript picked up.
export async function checkMeetingsNow(projectId: string): Promise<PollResult> {
  await requireEdit(projectId, "agent");
  const results = await pollMeetings({ projectId });
  revalidatePath("/agent");
  refresh();
  return results;
}

export async function linkMeeting(projectId: string, formData: FormData) {
  await requireEdit(projectId, "agent");
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

  const row = {
    connection_id: connection.id,
    project_id: projectId,
    graph_event_id: str(formData, "graph_event_id"),
    subject: str(formData, "subject"),
    organizer_email: str(formData, "organizer_email"),
    start_time: str(formData, "start_time"),
    end_time: str(formData, "end_time") || null,
    join_url: str(formData, "join_url") || null,
    linked_by: userId,
  };

  // unique(connection_id, graph_event_id) means re-clicking an already-linked
  // meeting (e.g. a double click) fails loudly instead of creating a duplicate.
  const { error } = await supabase.from("meeting_sources").insert(row);
  if (error) return { error: error.message };

  await supabase.from("agent_audit_log").insert({
    project_id: projectId,
    actor_type: "human",
    actor_id: userId,
    action: "meeting.linked",
    entity_type: "meeting_sources",
    details: { subject: row.subject, graph_event_id: row.graph_event_id },
  });

  revalidatePath("/agent");
  refresh();
}
