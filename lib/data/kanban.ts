import { createClient } from "@/lib/supabase/server";
import type { Issue, KanbanColumn, TeamMember } from "@/lib/seed-data";

export type IssueRow = Issue & { dbId: string };

export async function getKanbanData(projectId: string) {
  const supabase = await createClient();

  const [columnsRes, issuesRes, teamRes, sprintsRes] = await Promise.all([
    supabase.from("columns").select("id,name,color,wip_limit,sort_order").eq("project_id", projectId).order("sort_order"),
    supabase
      .from("issues")
      .select(
        "id,key,type,title,description,priority,status_column_id,assignee_id,epic_id,sprint_id,process_link_id,epic_color,created_at,updated_at"
      )
      .eq("project_id", projectId),
    supabase
      .from("team_members")
      .select("id,name,role,location,planned_hours,rate,logged_hours")
      .eq("project_id", projectId),
    supabase.from("sprints").select("id,name").eq("project_id", projectId).order("start_date"),
  ]);

  const issueRows = issuesRes.data ?? [];
  const issueIds = issueRows.map((i) => i.id);
  const issueKeyById = new Map(issueRows.map((i) => [i.id, i.key]));

  const [effortRes, labelsRes, linksRes, commentsRes] = issueIds.length
    ? await Promise.all([
        supabase.from("issue_effort_by_role").select("issue_id,role,days").in("issue_id", issueIds),
        supabase.from("issue_labels").select("issue_id,label").in("issue_id", issueIds),
        supabase.from("issue_links").select("issue_id,linked_issue_id,link_type").in("issue_id", issueIds),
        supabase.from("issue_comments").select("id,issue_id,author_id,text,created_at").in("issue_id", issueIds),
      ])
    : [
        { data: [] as { issue_id: string; role: string; days: number }[] },
        { data: [] as { issue_id: string; label: string }[] },
        { data: [] as { issue_id: string; linked_issue_id: string; link_type: string }[] },
        { data: [] as { id: string; issue_id: string; author_id: string | null; text: string; created_at: string }[] },
      ];

  const team: TeamMember[] = (teamRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    location: m.location ?? "",
    plannedHours: Number(m.planned_hours),
    rate: Number(m.rate),
    loggedHours: Number(m.logged_hours),
  }));
  const teamById = new Map(team.map((m) => [m.id, m.name]));

  const columns: KanbanColumn[] = (columnsRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color ?? "#6b7280",
    wipLimit: c.wip_limit,
    order: c.sort_order,
  }));

  const issues: IssueRow[] = issueRows.map((i) => {
    const effortByRole: Record<string, number> = {};
    for (const e of effortRes.data ?? []) if (e.issue_id === i.id) effortByRole[e.role] = Number(e.days);

    const labels = (labelsRes.data ?? []).filter((l) => l.issue_id === i.id).map((l) => l.label);

    const blocks = (linksRes.data ?? [])
      .filter((l) => l.issue_id === i.id && l.link_type === "blocks")
      .map((l) => issueKeyById.get(l.linked_issue_id) ?? "");
    const blockedBy = (linksRes.data ?? [])
      .filter((l) => l.issue_id === i.id && l.link_type === "blocked_by")
      .map((l) => issueKeyById.get(l.linked_issue_id) ?? "");

    const comments = (commentsRes.data ?? [])
      .filter((c) => c.issue_id === i.id)
      .map((c) => ({
        id: c.id,
        author: (c.author_id && teamById.get(c.author_id)) || "",
        text: c.text,
        timestamp: c.created_at,
      }));

    return {
      id: i.key,
      dbId: i.id,
      type: i.type as Issue["type"],
      title: i.title,
      description: i.description ?? "",
      priority: i.priority as Issue["priority"],
      status: i.status_column_id ?? "",
      assignee: i.assignee_id ?? "",
      effortByRole,
      epic: i.epic_id ? issueKeyById.get(i.epic_id) ?? null : null,
      sprint: i.sprint_id,
      labels,
      processLink: i.process_link_id,
      blocks,
      blockedBy,
      comments,
      epicColor: i.epic_color ?? undefined,
      created: i.created_at,
      updated: i.updated_at,
    };
  });

  const sprints = sprintsRes.data ?? [];

  return { columns, issues, team, sprints };
}
