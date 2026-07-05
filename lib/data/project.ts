import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ProjectConfig = {
  id: string;
  name: string;
  client: string;
  erp: string;
  goLive: string;
  prefix: string;
  budget: number;
  isSuperAdmin: boolean;
  userEmail: string;
};

// cache() dedupes this within a single request — (app)/layout.tsx and every
// page both call it, but it only hits Supabase once per request.
export const getCurrentProject = cache(async (): Promise<ProjectConfig | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  const isSuperAdmin = profile?.is_super_admin ?? false;

  let projectId: string | null = null;
  if (isSuperAdmin) {
    const { data } = await supabase.from("projects").select("id").limit(1).maybeSingle();
    projectId = data?.id ?? null;
  } else {
    const { data } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    projectId = data?.project_id ?? null;
  }

  if (!projectId) return null;

  const { data: project } = await supabase
    .from("projects")
    .select("id,name,client,erp_system,go_live_date,issue_prefix,budget")
    .eq("id", projectId)
    .single();
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    client: project.client ?? "",
    erp: project.erp_system ?? "",
    goLive: project.go_live_date ?? "",
    prefix: project.issue_prefix,
    budget: Number(project.budget),
    isSuperAdmin,
    userEmail: user.email ?? "",
  };
});
