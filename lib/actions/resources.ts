"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function num(formData: FormData, key: string): number {
  return Number(formData.get(key) ?? 0) || 0;
}

// ============================================================
// TEAM MEMBERS
// ============================================================
export async function upsertTeamMember(projectId: string, formData: FormData) {
  await requireEdit(projectId, "resources");
  const supabase = await createClient();
  const id = str(formData, "id");

  const row = {
    project_id: projectId,
    name: str(formData, "name"),
    role: str(formData, "role"),
    location: str(formData, "location"),
    planned_hours: num(formData, "planned_hours"),
    rate: num(formData, "rate"),
    logged_hours: num(formData, "logged_hours"),
  };

  const { error } = id
    ? await supabase.from("team_members").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("team_members").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/resources");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}

export async function deleteTeamMember(projectId: string, id: string) {
  await requireEdit(projectId, "resources");
  const supabase = await createClient();
  const { error } = await supabase.from("team_members").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/resources");
  refresh();
}

// ============================================================
// HOURS LOG
// ============================================================
export async function addHoursLog(projectId: string, formData: FormData) {
  await requireEdit(projectId, "resources");
  const supabase = await createClient();

  const row = {
    project_id: projectId,
    date: str(formData, "date"),
    team_member_id: str(formData, "team_member_id") || null,
    hours: num(formData, "hours"),
    activity: str(formData, "activity"),
    notes: str(formData, "notes"),
  };

  const { error } = await supabase.from("hours_log").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/resources");
  refresh();
}

export async function deleteHoursLog(projectId: string, id: string) {
  await requireEdit(projectId, "resources");
  const supabase = await createClient();
  const { error } = await supabase.from("hours_log").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/resources");
  refresh();
}
