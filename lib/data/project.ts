import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const CURRENT_PROJECT_COOKIE = "current_project_id";

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

type CurrentProjectRow = {
  id: string;
  name: string;
  client: string | null;
  erp_system: string | null;
  go_live_date: string | null;
  issue_prefix: string;
  budget: number;
  is_super_admin: boolean;
};

// cache() dedupes this within a single request — (app)/layout.tsx and every
// page both call it, but it only hits Supabase once per request.
//
// Performance note: this used to be 3-4 sequential round trips (getUser,
// profile lookup, membership/id lookup, project detail lookup), which was
// the dominant cost on every navigation. getClaims() verifies the JWT
// locally (no network call, since this project uses asymmetric signing
// keys) and get_my_current_project() collapses the rest into one RPC call.
//
// A cookie (set via setCurrentProject(), see lib/actions/projects.ts) lets
// the user pick a project on the Projects page instead of always landing on
// whatever get_my_current_project()'s ordering happens to pick. Passing it
// straight into the same RPC keeps this a single round trip in the common
// case — it only falls back to a second, param-less call if the cookie
// points at a project the caller no longer has access to (stale cookie).
export const getCurrentProject = cache(async (): Promise<ProjectConfig | null> => {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims) return null;

  const cookieStore = await cookies();
  const selectedId = cookieStore.get(CURRENT_PROJECT_COOKIE)?.value;

  async function fetchProject(projectId?: string) {
    const { data } = await supabase
      .rpc("get_my_current_project", projectId ? { p_project_id: projectId } : {})
      .single<CurrentProjectRow>();
    return data;
  }

  const project = (selectedId ? await fetchProject(selectedId) : null) ?? (await fetchProject());
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

export type ProjectSummary = {
  id: string;
  name: string;
  client: string;
  budget: number;
  issuePrefix: string;
};

// Powers the Projects page (list + switch) and the "known projects" context
// fed into meeting extraction (lib/agent/pollMeetings.ts) so the agent can
// tell a genuinely new project apart from one that already exists.
type MyProjectRow = { id: string; name: string; client: string | null; budget: number; issue_prefix: string };

export const getMyProjects = cache(async (): Promise<ProjectSummary[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("get_my_projects")) as { data: MyProjectRow[] | null };

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client ?? "",
    budget: Number(p.budget),
    issuePrefix: p.issue_prefix,
  }));
});

export type ProjectStats = {
  projectId: string;
  totalIssues: number;
  openIssues: number;
  totalRisks: number;
  openRisks: number;
};

type ProjectStatsRow = {
  project_id: string;
  total_issues: number;
  open_issues: number;
  total_risks: number;
  open_risks: number;
};

// One row per accessible project's open-issue/open-risk counts, computed
// server-side (get_my_project_stats()) instead of N+1 round trips from the
// app — powers the Main Dashboard's per-project cards and grand-total strip.
export const getMyProjectStats = cache(async (): Promise<ProjectStats[]> => {
  const supabase = await createClient();
  const { data } = (await supabase.rpc("get_my_project_stats")) as { data: ProjectStatsRow[] | null };

  return (data ?? []).map((r) => ({
    projectId: r.project_id,
    totalIssues: Number(r.total_issues),
    openIssues: Number(r.open_issues),
    totalRisks: Number(r.total_risks),
    openRisks: Number(r.open_risks),
  }));
});
