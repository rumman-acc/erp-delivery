"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updateProjectSettings(projectId: string, formData: FormData) {
  await requireEdit(projectId, "settings");
  const supabase = await createClient();

  const row = {
    name: str(formData, "name"),
    client: str(formData, "client"),
    erp_system: str(formData, "erp"),
    go_live_date: str(formData, "go_live") || null,
    issue_prefix: str(formData, "prefix").toUpperCase() || "ERP",
    budget: Number(formData.get("budget") ?? 0) || 0,
  };

  const { error } = await supabase.from("projects").update(row).eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  refresh();
}

// ============================================================
// ORG UNITS
// ============================================================
export async function upsertOrgUnit(projectId: string, formData: FormData) {
  await requireEdit(projectId, "settings");
  const supabase = await createClient();
  const id = str(formData, "id");

  const row = {
    project_id: projectId,
    location: str(formData, "location"),
    region: str(formData, "region"),
    strategic_bu: str(formData, "strategic_bu"),
    business_unit: str(formData, "business_unit"),
    type: str(formData, "type"),
    in_scope: formData.get("in_scope") === "on",
  };

  const { error } = id
    ? await supabase.from("org_units").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("org_units").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  refresh();
}

export async function deleteOrgUnit(projectId: string, id: string) {
  await requireEdit(projectId, "settings");
  const supabase = await createClient();
  const { error } = await supabase.from("org_units").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  refresh();
}
