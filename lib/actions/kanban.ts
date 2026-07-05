"use server";

import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEdit } from "@/lib/permissions";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createIssue(projectId: string, formData: FormData) {
  await requireEdit(projectId, "kanban");
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("issue_prefix,issue_counter")
    .eq("id", projectId)
    .single();
  if (!project) return { error: "Project not found" };

  const nextCounter = (project.issue_counter ?? 0) + 1;
  const key = `${project.issue_prefix}-${String(nextCounter).padStart(3, "0")}`;

  const assigneeId = str(formData, "assignee_id");
  const sprintId = str(formData, "sprint_id");

  const row = {
    project_id: projectId,
    key,
    type: str(formData, "type") || "Task",
    title: str(formData, "title"),
    description: str(formData, "description"),
    priority: str(formData, "priority") || "Medium",
    status_column_id: str(formData, "status_column_id") || null,
    assignee_id: assigneeId || null,
    sprint_id: sprintId || null,
  };

  const { error: insertError } = await supabase.from("issues").insert(row);
  if (insertError) return { error: insertError.message };

  await supabase.from("projects").update({ issue_counter: nextCounter }).eq("id", projectId);

  revalidatePath("/kanban");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}

export async function updateIssueStatus(projectId: string, issueId: string, statusColumnId: string) {
  await requireEdit(projectId, "kanban");
  const supabase = await createClient();
  const { error } = await supabase
    .from("issues")
    .update({ status_column_id: statusColumnId })
    .eq("id", issueId)
    .eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/kanban");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}

export async function deleteIssue(projectId: string, issueId: string) {
  await requireEdit(projectId, "kanban");
  const supabase = await createClient();
  const { error } = await supabase.from("issues").delete().eq("id", issueId).eq("project_id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/kanban");
  refresh();
  revalidatePath("/dashboard");
  refresh();
}
