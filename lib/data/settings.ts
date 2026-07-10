import { createClient } from "@/lib/supabase/server";
import type { OrgUnit, TeamMember } from "@/lib/seed-data";

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
};

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

// Org-wide, not project-scoped — access is now gated by the accelance.io
// tenant boundary (Microsoft SSO), not per-project membership, so a Super
// Admin manages everyone who has ever signed in, not just this project's team.
export async function getAllUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id,email,full_name,is_super_admin").order("email");

  return (data ?? []).map((p) => ({
    id: p.id,
    email: p.email ?? "",
    fullName: p.full_name ?? "",
    isSuperAdmin: p.is_super_admin,
  }));
}
