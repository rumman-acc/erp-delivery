import type { createClient } from "@/lib/supabase/server";

// Every project at Accelance shares the same roster (anyone can work on any
// project, per the org's actual working model) and the same default Kanban
// shape — rather than starting a brand-new project empty. Reused by both
// the manual "New Project" action (lib/actions/projects.ts) and an approved
// new_project agent suggestion (lib/actions/suggestions.ts), so a project
// created either way ends up in the same state.

export const DEFAULT_KANBAN_COLUMNS = [
  { name: "Backlog", color: "#6b7280", wip_limit: null as number | null, sort_order: 0 },
  { name: "To Do", color: "#3b82f6", wip_limit: null as number | null, sort_order: 1 },
  { name: "In Progress", color: "#f59e0b", wip_limit: 5, sort_order: 2 },
  { name: "In Review", color: "#8b5cf6", wip_limit: 3, sort_order: 3 },
  { name: "Done", color: "#10b981", wip_limit: null as number | null, sort_order: 4 },
];

export const DEFAULT_TEAM_ROSTER = [
  { name: "Vijay", role: "Delivery Head" },
  { name: "Pushpa", role: "Business Analyst" },
  { name: "Narender", role: "Senior Architect" },
  { name: "Haneeth", role: "Business Analyst" },
  { name: "Rumman", role: "Full Stack Developer" },
  { name: "Vikas", role: "Full Stack Developer" },
  { name: "Dhanraj", role: "Full Stack Developer" },
];

// Generic delivery-lifecycle phases — deliberately not ERP-specific ("Blueprint",
// "Configure") since these projects span an AI platform build, internal
// tooling, and process-automation work, not just ERP rollouts. No dates: there's
// no real timeline yet, so phases start as "Not scheduled" until an admin sets
// real start/end dates via the Dashboard's phase editor.
export const DEFAULT_PHASES = [
  { name: "Discovery & Planning", color: "#6366f1" },
  { name: "Design", color: "#3b82f6" },
  { name: "Development", color: "#f59e0b" },
  { name: "Testing & QA", color: "#10b981" },
  { name: "Deployment / Go-Live", color: "#ef4444" },
  { name: "Support & Stabilization", color: "#8b5cf6" },
];

export async function seedNewProject(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { error: colError } = await supabase
    .from("columns")
    .insert(DEFAULT_KANBAN_COLUMNS.map((c) => ({ project_id: projectId, ...c })));
  if (colError) throw new Error(colError.message);

  const { error: teamError } = await supabase.from("team_members").insert(
    DEFAULT_TEAM_ROSTER.map((t) => ({
      project_id: projectId,
      name: t.name,
      role: t.role,
      planned_hours: 0,
      rate: 0,
      logged_hours: 0,
    }))
  );
  if (teamError) throw new Error(teamError.message);

  const { error: phaseError } = await supabase.from("phases").insert(
    DEFAULT_PHASES.map((p) => ({
      project_id: projectId,
      name: p.name,
      color: p.color,
      progress: 0,
    }))
  );
  if (phaseError) throw new Error(phaseError.message);
}
