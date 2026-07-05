"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updateProcess(projectId: string, processDbId: string, formData: FormData) {
  await requireEdit(projectId, "scope");
  const supabase = await createClient();

  const row = {
    description: str(formData, "description"),
    notes: str(formData, "notes"),
    priority: str(formData, "priority") || "M",
    in_scope: formData.get("in_scope") === "on",
  };

  const { error } = await supabase.from("processes").update(row).eq("id", processDbId).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/scope");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}

export async function updateDataElement(projectId: string, dataElementDbId: string, formData: FormData) {
  await requireEdit(projectId, "scope");
  const supabase = await createClient();

  const row = {
    description: str(formData, "description"),
    source_system: str(formData, "source"),
    target_system: str(formData, "target"),
    volume: str(formData, "volume"),
    complexity: str(formData, "complexity") || "M",
    in_scope: formData.get("in_scope") === "on",
  };

  const { error } = await supabase.from("data_elements").update(row).eq("id", dataElementDbId).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/scope");
  refresh();
}
