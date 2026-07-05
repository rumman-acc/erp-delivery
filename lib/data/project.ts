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
//
// Performance note: this used to be 3-4 sequential round trips (getUser,
// profile lookup, membership/id lookup, project detail lookup), which was
// the dominant cost on every navigation. getClaims() verifies the JWT
// locally (no network call, since this project uses asymmetric signing
// keys) and get_my_current_project() collapses the rest into one RPC call.
export const getCurrentProject = cache(async (): Promise<ProjectConfig | null> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return null;

  const { data: project } = await supabase.rpc("get_my_current_project").single<{
    id: string;
    name: string;
    client: string | null;
    erp_system: string | null;
    go_live_date: string | null;
    issue_prefix: string;
    budget: number;
    is_super_admin: boolean;
  }>();
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    client: project.client ?? "",
    erp: project.erp_system ?? "",
    goLive: project.go_live_date ?? "",
    prefix: project.issue_prefix,
    budget: Number(project.budget),
    isSuperAdmin: project.is_super_admin,
    userEmail: (claims.email as string) ?? "",
  };
});
