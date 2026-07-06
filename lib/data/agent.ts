import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/microsoft/connection";
import { listOnlineMeetings } from "@/lib/microsoft/graph";

export type AgentConnection = {
  id: string;
  microsoftEmail: string;
  status: "active" | "revoked" | "expired";
  connectedAt: string;
};

// cache()'d because both the page and getMyMeetings() call this within the
// same request — dedupes to one DB round trip instead of two.
export const getMyConnection = cache(async (): Promise<AgentConnection | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("agent_connections")
    .select("id,microsoft_email,status,connected_at")
    .eq("connected_by", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    microsoftEmail: data.microsoft_email,
    status: data.status as AgentConnection["status"],
    connectedAt: data.connected_at,
  };
});

export type MyMeeting = {
  graphEventId: string;
  subject: string;
  organizerEmail: string;
  start: string;
  end: string;
  joinUrl: string | null;
  linkedProjectId: string | null;
  linkedProjectName: string | null;
};

export type MeetingsResult = { status: "no_connection" | "needs_reconnect" | "ok"; meetings: MyMeeting[] };

// Graph returns dateTime strings with no "Z"/offset when a timezone Prefer
// header is set (they're UTC in value, but formatted as a naive string) —
// normalize to real ISO 8601 UTC so `new Date(...)` and Postgres `timestamptz`
// both parse them correctly instead of misreading as local time.
function toUtcIso(graphDateTime: string): string {
  return graphDateTime.endsWith("Z") ? graphDateTime : `${graphDateTime}Z`;
}

// plan-agentic.md §5 step 2 — the admin's own upcoming/recent Teams
// meetings, cross-referenced against meeting_sources so already-linked
// meetings (to this or any other project) show clearly instead of being
// silently double-linkable.
export async function getMyMeetings(projectId: string): Promise<MeetingsResult> {
  const connection = await getMyConnection();
  if (!connection) return { status: "no_connection", meetings: [] };

  const valid = await getValidAccessToken();
  if (!valid) return { status: "needs_reconnect", meetings: [] };

  let events;
  try {
    events = await listOnlineMeetings(valid.accessToken);
  } catch (err) {
    console.error("Failed to list Microsoft meetings:", err);
    return { status: "needs_reconnect", meetings: [] };
  }

  const supabase = await createClient();
  const eventIds = events.map((e) => e.id);

  const { data: linkedRows } = eventIds.length
    ? await supabase
        .from("meeting_sources")
        .select("graph_event_id,project_id")
        .eq("connection_id", valid.connectionId)
        .in("graph_event_id", eventIds)
    : { data: [] as { graph_event_id: string; project_id: string }[] };

  const linkedProjectIds = [...new Set((linkedRows ?? []).map((r) => r.project_id))];
  const { data: projectRows } = linkedProjectIds.length
    ? await supabase.from("projects").select("id,name").in("id", linkedProjectIds)
    : { data: [] as { id: string; name: string }[] };

  const projectNameById = new Map((projectRows ?? []).map((p) => [p.id, p.name]));
  const linkedProjectIdByEvent = new Map((linkedRows ?? []).map((r) => [r.graph_event_id, r.project_id]));

  const meetings: MyMeeting[] = events.map((e) => {
    const linkedProjectId = linkedProjectIdByEvent.get(e.id) ?? null;
    return {
      graphEventId: e.id,
      subject: e.subject,
      organizerEmail: e.organizer?.emailAddress?.address ?? "",
      start: toUtcIso(e.start.dateTime),
      end: toUtcIso(e.end.dateTime),
      joinUrl: e.onlineMeeting?.joinUrl ?? null,
      linkedProjectId,
      linkedProjectName: linkedProjectId ? projectNameById.get(linkedProjectId) ?? null : null,
    };
  });

  // Unlinked meetings and ones already linked to *this* project are the
  // actionable ones — surface those before meetings linked to other projects.
  meetings.sort((a, b) => {
    const rank = (m: MyMeeting) => (m.linkedProjectId === null || m.linkedProjectId === projectId ? 0 : 1);
    return rank(a) - rank(b);
  });

  return { status: "ok", meetings };
}

export type LinkedMeeting = {
  id: string;
  subject: string;
  startTime: string;
  transcriptStatus: "pending" | "fetched" | "unavailable" | "error";
  transcriptFetchedAt: string | null;
};

// Visibility into the Phase 3 pipeline for this project — any Admin can see
// this regardless of who linked the meeting (plan-agentic.md §8).
export async function getLinkedMeetings(projectId: string): Promise<LinkedMeeting[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_sources")
    .select("id,subject,start_time,transcript_status,transcript_fetched_at")
    .eq("project_id", projectId)
    .order("start_time", { ascending: false });

  return (data ?? []).map((m) => ({
    id: m.id,
    subject: m.subject,
    startTime: m.start_time,
    transcriptStatus: m.transcript_status as LinkedMeeting["transcriptStatus"],
    transcriptFetchedAt: m.transcript_fetched_at,
  }));
}
