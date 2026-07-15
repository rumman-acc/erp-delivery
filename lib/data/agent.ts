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
  linkedProjects: { id: string; name: string }[];
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
// meetings (to any project) show clearly instead of being silently
// double-linkable. Global (not project-scoped): a meeting only becomes
// "about" a project once explicitly linked, via the project picker in
// MeetingsList — this just lists what's on the admin's own calendar.
export async function getMyMeetings(): Promise<MeetingsResult> {
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

  // The Graph window is capped at `now` (see listOnlineMeetings), but
  // calendarView matches on overlap — a meeting that started before `now`
  // and hasn't ended yet would still come back. Drop those too: no
  // transcript exists until a meeting actually finishes.
  const now = Date.now();
  const endedEvents = events.filter((e) => new Date(toUtcIso(e.end.dateTime)).getTime() <= now);

  const supabase = await createClient();
  const eventIds = endedEvents.map((e) => e.id);

  const { data: linkedRows } = eventIds.length
    ? await supabase
        .from("meeting_sources")
        .select("graph_event_id,meeting_source_projects(project_id,projects(name))")
        .eq("connection_id", valid.connectionId)
        .in("graph_event_id", eventIds)
    : { data: [] as { graph_event_id: string; meeting_source_projects: { project_id: string; projects: { name: string } | { name: string }[] | null }[] }[] };

  const linkedProjectsByEvent = new Map(
    (linkedRows ?? []).map((r) => [
      r.graph_event_id,
      (r.meeting_source_projects ?? [])
        .map((msp) => {
          const project = Array.isArray(msp.projects) ? msp.projects[0] : msp.projects;
          return project ? { id: msp.project_id, name: project.name } : null;
        })
        .filter((p): p is { id: string; name: string } => p !== null),
    ])
  );

  const meetings: MyMeeting[] = endedEvents.map((e) => ({
    graphEventId: e.id,
    subject: e.subject,
    organizerEmail: e.organizer?.emailAddress?.address ?? "",
    start: toUtcIso(e.start.dateTime),
    end: toUtcIso(e.end.dateTime),
    joinUrl: e.onlineMeeting?.joinUrl ?? null,
    linkedProjects: linkedProjectsByEvent.get(e.id) ?? [],
  }));

  // Unlinked meetings are the actionable ones — surface those first.
  meetings.sort((a, b) => {
    const rank = (m: MyMeeting) => (m.linkedProjects.length === 0 ? 0 : 1);
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
  projectId: string;
  projectName: string;
};

// Visibility into the Phase 3 pipeline across every project the caller can
// access — any Admin can see this regardless of who linked the meeting or
// which project it's for (plan-agentic.md §8, generalized: AI Agent is a
// global page, not project-scoped). A meeting linked to several of the
// caller's projects shows up once per (meeting, project) pair — one row per
// project's own stake in it, same as everywhere else project-scoped data
// is listed.
export async function getLinkedMeetings(projectIds: string[]): Promise<LinkedMeeting[]> {
  if (projectIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_source_projects")
    .select("project_id,projects(name),meeting_sources(id,subject,start_time,transcript_status,transcript_fetched_at)")
    .in("project_id", projectIds)
    .order("start_time", { ascending: false, referencedTable: "meeting_sources" });

  return (data ?? []).flatMap((r) => {
    const meeting = Array.isArray(r.meeting_sources) ? r.meeting_sources[0] : r.meeting_sources;
    const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
    if (!meeting) return [];
    return [
      {
        id: meeting.id,
        subject: meeting.subject,
        startTime: meeting.start_time,
        transcriptStatus: meeting.transcript_status as LinkedMeeting["transcriptStatus"],
        transcriptFetchedAt: meeting.transcript_fetched_at,
        projectId: r.project_id,
        projectName: project?.name ?? "Unknown project",
      },
    ];
  });
}

type Confidence = "high" | "medium" | "low" | null;
type Common = { id: string; supportingQuote: string | null; confidence: Confidence };

// Mirrors ExtractedSuggestion (lib/claude/extractSuggestions.ts) — the
// `payload` column stores exactly these fields per type (see
// pollMeetings.ts's toSuggestionRow), so this is a straight passthrough.
// Every type except new_project carries its own projectId/projectName —
// Claude's tagged (or the reviewer's corrected) guess at which of the
// meeting's linked projects this specific item belongs to, since one
// meeting can span several.
type Targeted = { projectId: string; projectName: string };
export type SuggestionRow =
  | (Common & Targeted & { suggestionType: "requirement"; description: string; reqType: string; priority: string })
  | (Common & Targeted & { suggestionType: "new_process"; name: string; suggestedCode: string; level: 1 | 2 | 3; description: string; priority: string })
  | (Common & Targeted & { suggestionType: "action_item"; title: string; priority: string; dueDate: string | null })
  | (Common & Targeted & { suggestionType: "risk"; description: string; category: string; probability: string; impact: string; mitigation: string })
  | (Common & Targeted & { suggestionType: "issue"; description: string; category: string; severity: string; rootCause: string })
  | (Common & { suggestionType: "new_project"; name: string; description: string; suggestedIssuePrefix: string });

export type SuggestionBatch = {
  batchId: string;
  meetingSourceId: string;
  meetingSubject: string;
  meetingStartTime: string;
  // Every project this meeting is linked to — powers the per-row project
  // picker in the Review Queue (a suggestion can only be (re)tagged to one
  // of these, matching the agent_suggestions_write RLS check).
  linkedProjects: { id: string; name: string }[];
  suggestions: SuggestionRow[];
};

// plan-agentic.md §5 step 5 (generalized, §10 step 7) — one batch per
// meeting, mixing whichever suggestion types were found; any project Admin
// can review it (not just the admin whose Outlook account sourced the
// meeting, nor just an Admin of the specific project a suggestion happens
// to be tagged to). Global across every project the caller can access.
//
// No app-level project_id filter here — RLS (agent_suggestions_select)
// already scopes this correctly via the meeting's linked projects, which is
// NOT the same set as "suggestions whose own project_id tag is in
// projectIds": a suggestion tagged to a project the caller can't view is
// still visible if the underlying meeting is also linked to a project they
// can. Filtering by projectIds here would incorrectly hide those.
export async function getPendingSuggestionBatches(projectIds: string[]): Promise<SuggestionBatch[]> {
  if (projectIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_suggestions")
    .select(
      "id,batch_id,meeting_source_id,project_id,suggestion_type,payload,supporting_quote,confidence,projects(name),meeting_sources(subject,start_time,meeting_source_projects(project_id,projects(name)))"
    )
    .eq("status", "pending")
    .order("created_at");

  const batches = new Map<string, SuggestionBatch>();

  for (const r of data ?? []) {
    const meeting = Array.isArray(r.meeting_sources) ? r.meeting_sources[0] : r.meeting_sources;
    const taggedProject = Array.isArray(r.projects) ? r.projects[0] : r.projects;

    if (!batches.has(r.batch_id)) {
      const linkedProjects = (meeting?.meeting_source_projects ?? [])
        .map((msp) => {
          const project = Array.isArray(msp.projects) ? msp.projects[0] : msp.projects;
          return project ? { id: msp.project_id, name: project.name } : null;
        })
        .filter((p): p is { id: string; name: string } => p !== null);

      batches.set(r.batch_id, {
        batchId: r.batch_id,
        meetingSourceId: r.meeting_source_id,
        meetingSubject: meeting?.subject ?? "Unknown meeting",
        meetingStartTime: meeting?.start_time ?? "",
        linkedProjects,
        suggestions: [],
      });
    }

    const payload = r.payload as Record<string, unknown>;
    const common: Common = { id: r.id, supportingQuote: r.supporting_quote, confidence: r.confidence as Confidence };
    const targeted: Targeted = { projectId: r.project_id, projectName: taggedProject?.name ?? "Unknown project" };
    const row =
      r.suggestion_type === "new_project"
        ? ({ ...common, suggestionType: r.suggestion_type, ...payload } as SuggestionRow)
        : ({ ...common, ...targeted, suggestionType: r.suggestion_type, ...payload } as SuggestionRow);
    batches.get(r.batch_id)!.suggestions.push(row);
  }

  return [...batches.values()];
}

export type ProcessOption = { id: string; code: string; name: string };

// Keyed by project id — a "requirement" suggestion needs the picker
// populated with *its own* project's processes, and batches now span
// multiple projects at once (see getPendingSuggestionBatches).
export async function getProjectProcessesMap(projectIds: string[]): Promise<Record<string, ProcessOption[]>> {
  if (projectIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("processes")
    .select("id,code,name,project_id")
    .in("project_id", projectIds)
    .order("code");

  const map: Record<string, ProcessOption[]> = {};
  for (const p of data ?? []) {
    (map[p.project_id] ??= []).push({ id: p.id, code: p.code, name: p.name });
  }
  return map;
}

export type AuditLogEntry = {
  id: string;
  createdAt: string;
  actorType: "agent" | "human";
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
};

// plan-agentic.md §4 — full governance trail. RLS restricts SELECT to Super
// Admin only, so this returns empty for anyone else regardless of the
// project filter here (see agent_audit_log_select policy). Connection
// events (connect/disconnect) never carry a project_id — they're tied to
// the admin's own Microsoft account, not any one project — so this also
// pulls project_id IS NULL rows to keep the trail complete.
export async function getAgentAuditLog(projectIds: string[]): Promise<AuditLogEntry[]> {
  const supabase = await createClient();
  const idList = projectIds.join(",");
  const { data } = await supabase
    .from("agent_audit_log")
    .select("id,created_at,actor_type,action,entity_type,entity_id,details,profiles(full_name,email)")
    .or(projectIds.length > 0 ? `project_id.in.(${idList}),project_id.is.null` : "project_id.is.null")
    .order("created_at", { ascending: false })
    .limit(200);

  return (data ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      createdAt: r.created_at,
      actorType: r.actor_type as AuditLogEntry["actorType"],
      actorName: profile?.full_name || profile?.email || null,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details as Record<string, unknown> | null,
    };
  });
}
