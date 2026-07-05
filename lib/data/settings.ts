import { createClient } from "@/lib/supabase/server";
import type { OrgUnit, TeamMember } from "@/lib/seed-data";

export async function getSettingsData(projectId: string) {
  const supabase = await createClient();
  const [teamRes, orgUnitsRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("id,name,role,location,planned_hours,rate,logged_hours")
      .eq("project_id", projectId)
      .order("name"),
    supabase
      .from("org_units")
      .select("id,location,region,strategic_bu,business_unit,type,in_scope")
      .eq("project_id", projectId)
      .order("location"),
  ]);

  const team: TeamMember[] = (teamRes.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    location: m.location ?? "",
    plannedHours: Number(m.planned_hours),
    rate: Number(m.rate),
    loggedHours: Number(m.logged_hours),
  }));

  const orgUnits: OrgUnit[] = (orgUnitsRes.data ?? []).map((o) => ({
    id: o.id,
    location: o.location,
    region: o.region ?? "",
    strategicBU: o.strategic_bu ?? "",
    businessUnit: o.business_unit ?? "",
    type: o.type ?? "",
    inScope: o.in_scope,
  }));

  return { team, orgUnits };
}
