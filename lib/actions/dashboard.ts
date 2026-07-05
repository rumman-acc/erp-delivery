"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// ============================================================
// PHASES
// ============================================================
export async function upsertPhase(projectId: string, formData: FormData) {
  await requireEdit(projectId, "dashboard");
  const supabase = await createClient();
  const id = str(formData, "id");

  const row = {
    project_id: projectId,
    name: str(formData, "name"),
    start_date: str(formData, "start"),
    end_date: str(formData, "end"),
    color: str(formData, "color") || "#6366f1",
    progress: Number(formData.get("progress") ?? 0),
  };

  const { error } = id
    ? await supabase.from("phases").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("phases").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  refresh();
}

// ============================================================
// GATES
// ============================================================
export async function upsertGate(projectId: string, formData: FormData) {
  await requireEdit(projectId, "dashboard");
  const supabase = await createClient();
  const id = str(formData, "id");
  const responsibleId = str(formData, "responsible_id");

  const row = {
    project_id: projectId,
    name: str(formData, "name"),
    date: str(formData, "date") || null,
    status: str(formData, "status") || "grey",
    responsible_id: responsibleId || null,
    notes: str(formData, "notes"),
  };

  const { error } = id
    ? await supabase.from("gates").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("gates").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  refresh();
}

export async function deleteGate(projectId: string, id: string) {
  await requireEdit(projectId, "dashboard");
  const supabase = await createClient();
  const { error } = await supabase.from("gates").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  refresh();
}

// ============================================================
// ACTION ITEMS
// ============================================================
export async function upsertActionItem(projectId: string, formData: FormData) {
  await requireEdit(projectId, "dashboard");
  const supabase = await createClient();
  const id = str(formData, "id");
  const ownerId = str(formData, "owner_id");

  const row = {
    project_id: projectId,
    title: str(formData, "title"),
    owner_id: ownerId || null,
    due_date: str(formData, "due") || null,
    status: str(formData, "status") || "Open",
    priority: str(formData, "priority") || "Medium",
  };

  const { error } = id
    ? await supabase.from("action_items").update(row).eq("id", id).eq("project_id", projectId)
    : await supabase.from("action_items").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  refresh();
}

export async function deleteActionItem(projectId: string, id: string) {
  await requireEdit(projectId, "dashboard");
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").delete().eq("id", id).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  refresh();
}
