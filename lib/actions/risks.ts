"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ============================================================
// RISKS
// ============================================================
export async function upsertRisk(projectId: string, formData: FormData) {
  await requireEdit(projectId, "risks");
  const supabase = await createClient();
  const id = str(formData, "id");
  const ownerId = str(formData, "owner_id");

  const row = {
    project_id: projectId,
    code: str(formData, "code") || null,
    description: str(formData, "description"),
    category: str(formData, "category"),
    probability: str(formData, "probability") || "M",
    impact: str(formData, "impact") || "M",
    mitigation: str(formData, "mitigation"),
    owner_id: ownerId || null,
    status: str(formData, "status") || "Open",
  };

  const { error } = id
    ? await supabase.from("risks").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("risks").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/risks");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}

export async function deleteRisk(projectId: string, id: string) {
  await requireEdit(projectId, "risks");
  const supabase = await createClient();
  const { error } = await supabase.from("risks").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/risks");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}

// ============================================================
// ISSUES LOG
// ============================================================
export async function upsertIssueLog(projectId: string, formData: FormData) {
  await requireEdit(projectId, "risks");
  const supabase = await createClient();
  const id = str(formData, "id");
  const ownerId = str(formData, "owner_id");

  const row = {
    project_id: projectId,
    code: str(formData, "code") || null,
    description: str(formData, "description"),
    category: str(formData, "category"),
    severity: str(formData, "severity"),
    root_cause: str(formData, "root_cause"),
    resolution: str(formData, "resolution"),
    owner_id: ownerId || null,
    due_date: str(formData, "due") || null,
    status: str(formData, "status") || "Open",
  };

  const { error } = id
    ? await supabase.from("issues_log").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("issues_log").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/risks");
  refresh();
}

export async function deleteIssueLog(projectId: string, id: string) {
  await requireEdit(projectId, "risks");
  const supabase = await createClient();
  const { error } = await supabase.from("issues_log").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/risks");
  refresh();
}
