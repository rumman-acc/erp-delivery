import { createClient } from "@/lib/supabase/server";
import type { OrgUnit, TeamMember } from "@/lib/seed-data";

export type ProjectMember = {
  userId: string;
  roleId: string;
  email: string;
  fullName: string;
  roleName: string;
};

export type RoleOption = { id: string; name: string };

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

// project_members has two FKs into profiles (user_id, invited_by), so the
// embed needs the !user_id hint to disambiguate which one PostgREST joins on.
export async function getUsersData(projectId: string): Promise<{ members: ProjectMember[]; roles: RoleOption[] }> {
  const supabase = await createClient();
  const [membersRes, rolesRes] = await Promise.all([
    supabase
      .from("project_members")
      .select("user_id, role_id, profiles!user_id(email, full_name), roles(name)")
      .eq("project_id", projectId)
      .order("created_at"),
    supabase.from("roles").select("id, name").order("name"),
  ]);

  const members: ProjectMember[] = (membersRes.data ?? []).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const role = Array.isArray(m.roles) ? m.roles[0] : m.roles;
    return {
      userId: m.user_id,
      roleId: m.role_id,
      email: profile?.email ?? "",
      fullName: profile?.full_name ?? "",
      roleName: role?.name ?? "",
    };
  });

  const roles: RoleOption[] = (rolesRes.data ?? []).map((r) => ({ id: r.id, name: r.name }));

  return { members, roles };
}
