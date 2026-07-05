import { createClient } from "@/lib/supabase/server";
import type { IssueLogEntry, Risk } from "@/lib/seed-data";

export type RiskRow = Risk & { dbId: string; code: string | null; ownerId: string | null };
export type IssueLogRow = IssueLogEntry & { dbId: string; code: string | null; ownerId: string | null };

export async function getRisksData(projectId: string) {
  const supabase = await createClient();

  const [risksRes, issuesLogRes, teamRes] = await Promise.all([
    supabase
      .from("risks")
      .select("id,code,description,category,probability,impact,mitigation,owner_id,status")
      .eq("project_id", projectId),
    supabase
      .from("issues_log")
      .select("id,code,description,category,severity,root_cause,resolution,owner_id,due_date,status")
      .eq("project_id", projectId),
    supabase.from("team_members").select("id,name").eq("project_id", projectId),
  ]);

  const teamById = new Map((teamRes.data ?? []).map((m) => [m.id, m.name]));

  const risks: RiskRow[] = (risksRes.data ?? []).map((r) => ({
    id: r.code ?? r.id,
    dbId: r.id,
    code: r.code,
    description: r.description,
    category: r.category ?? "",
    probability: r.probability as Risk["probability"],
    impact: r.impact as Risk["impact"],
    mitigation: r.mitigation ?? "",
    owner: (r.owner_id && teamById.get(r.owner_id)) || "",
    ownerId: r.owner_id,
    status: r.status,
  }));

  const issuesLog: IssueLogRow[] = (issuesLogRes.data ?? []).map((i) => ({
    id: i.code ?? i.id,
    dbId: i.id,
    code: i.code,
    description: i.description,
    category: i.category ?? "",
    severity: i.severity ?? "",
    rootCause: i.root_cause ?? "",
    resolution: i.resolution ?? "",
    owner: (i.owner_id && teamById.get(i.owner_id)) || "",
    ownerId: i.owner_id,
    due: i.due_date ?? "",
    status: i.status,
  }));

  return { risks, issuesLog };
}
