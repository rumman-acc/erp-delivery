"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { CURRENT_PROJECT_COOKIE } from "@/lib/data/project";
import { seedNewProject } from "@/lib/data/projectDefaults";

// Just a view preference, not an access grant — RLS still governs what the
// picked project actually returns (see get_my_current_project's p_project_id
// handling), so there's no need to validate membership before setting this.
export async function setCurrentProject(projectId: string) {
  const cookieStore = await cookies();
  cookieStore.set(CURRENT_PROJECT_COOKIE, projectId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

// Super Admin only (plan.md §6 — creating a brand-new project is the more
// sensitive, centrally-controlled action, same tier as inviting a new user).
// Also reachable indirectly via an approved "new_project" agent suggestion
// (lib/actions/suggestions.ts), which calls seedNewProject the same way.
export async function createProject(input: { name: string; client: string; issuePrefix: string }) {
  await requireSuperAdmin();

  const name = input.name.trim();
  const issuePrefix = input.issuePrefix.trim().toUpperCase();
  if (!name) return { error: "Project name is required" };
  if (!issuePrefix) return { error: "Issue prefix is required" };

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({ name, client: input.client.trim() || "Accelance", budget: 0, issue_prefix: issuePrefix })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: `Issue prefix "${issuePrefix}" is already used by another project.` };
    return { error: error.message };
  }

  try {
    await seedNewProject(supabase, project.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Project created, but seeding default data failed" };
  }

  revalidatePath("/projects");
  return { id: project.id as string };
}
