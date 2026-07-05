import { createClient } from "@/lib/supabase/server";
import type { ActionItem, Gate, Phase } from "@/lib/seed-data";

export type GateRow = Gate & { responsibleId: string | null };
export type ActionItemRow = ActionItem & { ownerId: string | null };

export async function getDashboardData(projectId: string) {
  const supabase = await createClient();

  const [phasesRes, gatesRes, actionsRes, processesRes, issuesRes, columnsRes, risksRes, teamRes] =
    await Promise.all([
      supabase
        .from("phases")
        .select("id,name,start_date,end_date,color,progress")
        .eq("project_id", projectId)
        .order("start_date"),
      supabase
        .from("gates")
        .select("id,name,date,status,notes,responsible_id")
        .eq("project_id", projectId)
        .order("date"),
      supabase
        .from("action_items")
        .select("id,title,due_date,status,priority,owner_id")
        .eq("project_id", projectId)
        .order("due_date"),
      supabase.from("processes").select("id,in_scope").eq("project_id", projectId),
      supabase.from("issues").select("id,status_column_id").eq("project_id", projectId),
      supabase.from("columns").select("id,name").eq("project_id", projectId),
      supabase.from("risks").select("id,status").eq("project_id", projectId),
      supabase.from("team_members").select("id,name,logged_hours,rate").eq("project_id", projectId),
    ]);

  const teamById = new Map((teamRes.data ?? []).map((m) => [m.id, m.name]));
  const columnNameById = new Map((columnsRes.data ?? []).map((c) => [c.id, c.name]));

  const phases: Phase[] = (phasesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    start: p.start_date,
    end: p.end_date,
    color: p.color ?? "#6366f1",
    progress: p.progress,
  }));

  const gates: GateRow[] = (gatesRes.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    date: g.date ?? "",
    status: g.status as Gate["status"],
    responsible: (g.responsible_id && teamById.get(g.responsible_id)) || "",
    responsibleId: g.responsible_id,
    notes: g.notes ?? "",
  }));

  const actions: ActionItemRow[] = (actionsRes.data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    owner: (a.owner_id && teamById.get(a.owner_id)) || "",
    ownerId: a.owner_id,
    due: a.due_date ?? "",
    status: a.status,
    priority: a.priority as ActionItem["priority"],
  }));

  const processes = processesRes.data ?? [];
  const issues = issuesRes.data ?? [];
  const risks = risksRes.data ?? [];
  const team = teamRes.data ?? [];

  return {
    phases,
    gates,
    actions,
    totalProcesses: processes.length,
    inScopeProcesses: processes.filter((p) => p.in_scope).length,
    totalIssues: issues.length,
    openIssues: issues.filter((i) => columnNameById.get(i.status_column_id ?? "") !== "Done").length,
    totalRisks: risks.length,
    openRisks: risks.filter((r) => r.status === "Open").length,
    totalCost: team.reduce((s, m) => s + Number(m.logged_hours) * Number(m.rate), 0),
  };
}
