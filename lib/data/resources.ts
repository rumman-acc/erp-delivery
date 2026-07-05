import { createClient } from "@/lib/supabase/server";
import type { HoursLogEntry, TeamMember } from "@/lib/seed-data";

export async function getResourcesData(projectId: string) {
  const supabase = await createClient();

  const [teamRes, hoursRes, issuesRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("id,name,role,location,planned_hours,rate,logged_hours")
      .eq("project_id", projectId)
      .order("name"),
    supabase
      .from("hours_log")
      .select("id,date,team_member_id,hours,activity,notes")
      .eq("project_id", projectId)
      .order("date", { ascending: false }),
    supabase.from("issues").select("id").eq("project_id", projectId),
  ]);

  const teamById = new Map((teamRes.data ?? []).map((m) => [m.id, m.name]));

  const team: TeamMember[] = (teamRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    location: m.location ?? "",
    plannedHours: Number(m.planned_hours),
    rate: Number(m.rate),
    loggedHours: Number(m.logged_hours),
  }));

  const hoursLog: HoursLogEntry[] = (hoursRes.data ?? []).map((h) => ({
    id: h.id,
    date: h.date,
    person: (h.team_member_id && teamById.get(h.team_member_id)) || "",
    hours: Number(h.hours),
    activity: h.activity ?? "",
    notes: h.notes ?? "",
  }));

  const issueIds = (issuesRes.data ?? []).map((i) => i.id);
  const effortByRole: Record<string, number> = {};
  if (issueIds.length) {
    const { data: effortRows } = await supabase
      .from("issue_effort_by_role")
      .select("role,days")
      .in("issue_id", issueIds);
    for (const row of effortRows ?? []) {
      effortByRole[row.role] = (effortByRole[row.role] ?? 0) + Number(row.days);
    }
  }

  return { team, hoursLog, effortByRole };
}
