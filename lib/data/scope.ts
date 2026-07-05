import { createClient } from "@/lib/supabase/server";
import type { DataElement, ProcessNode, Requirement } from "@/lib/seed-data";

export type ProcessNodeRow = ProcessNode & { dbId: string };
export type DataElementRow = DataElement & { dbId: string; ownerId: string | null };

export async function getScopeData(projectId: string) {
  const supabase = await createClient();

  const [processesRes, orgUnitsRes, dataElementsRes, teamRes, issuesRes] = await Promise.all([
    supabase
      .from("processes")
      .select("id,code,name,level,parent_id,in_scope,priority,description,notes")
      .eq("project_id", projectId),
    supabase.from("org_units").select("id,location").eq("project_id", projectId),
    supabase
      .from("data_elements")
      .select("id,code,name,category,description,owner_id,source_system,target_system,volume,complexity,in_scope")
      .eq("project_id", projectId),
    supabase.from("team_members").select("id,name").eq("project_id", projectId),
    supabase.from("issues").select("id,key").eq("project_id", projectId),
  ]);

  const processRows = processesRes.data ?? [];
  const orgUnitRows = orgUnitsRes.data ?? [];
  const dataElementRows = dataElementsRes.data ?? [];

  const teamById = new Map((teamRes.data ?? []).map((m) => [m.id, m.name]));
  const ouLocationById = new Map(orgUnitRows.map((o) => [o.id, o.location]));
  const processCodeById = new Map(processRows.map((p) => [p.id, p.code]));
  const deCodeById = new Map(dataElementRows.map((d) => [d.id, d.code]));
  const issueKeyById = new Map((issuesRes.data ?? []).map((i) => [i.id, i.key]));

  const processIds = processRows.map((p) => p.id);
  const dataElementIds = dataElementRows.map((d) => d.id);

  const [
    processOuRes,
    processDepsRes,
    deProcessLinksRes,
    deOuRes,
    requirementsRes,
    processKanbanRes,
    deKanbanRes,
  ] = await Promise.all([
    processIds.length
      ? supabase.from("process_org_units").select("process_id,org_unit_id").in("process_id", processIds)
      : Promise.resolve({ data: [] as { process_id: string; org_unit_id: string }[] }),
    processIds.length
      ? supabase.from("process_deps").select("process_id,depends_on_process_id").in("process_id", processIds)
      : Promise.resolve({ data: [] as { process_id: string; depends_on_process_id: string }[] }),
    dataElementIds.length
      ? supabase
          .from("data_element_process_links")
          .select("data_element_id,process_id,direction")
          .in("data_element_id", dataElementIds)
      : Promise.resolve({ data: [] as { data_element_id: string; process_id: string; direction: string | null }[] }),
    dataElementIds.length
      ? supabase.from("data_element_org_units").select("data_element_id,org_unit_id").in("data_element_id", dataElementIds)
      : Promise.resolve({ data: [] as { data_element_id: string; org_unit_id: string }[] }),
    supabase
      .from("requirements")
      .select("id,source_type,source_id,code,description,type,priority,status,note")
      .eq("project_id", projectId),
    processIds.length
      ? supabase.from("kanban_links").select("source_id,issue_id").eq("source_type", "process").in("source_id", processIds)
      : Promise.resolve({ data: [] as { source_id: string; issue_id: string }[] }),
    dataElementIds.length
      ? supabase.from("kanban_links").select("source_id,issue_id").eq("source_type", "data_element").in("source_id", dataElementIds)
      : Promise.resolve({ data: [] as { source_id: string; issue_id: string }[] }),
  ]);

  const requirementRows = requirementsRes.data ?? [];

  function toRequirement(r: (typeof requirementRows)[number]): Requirement {
    return {
      id: r.code ?? r.id,
      desc: r.description,
      type: r.type ?? "",
      priority: r.priority ?? "",
      status: r.status ?? "",
      note: r.note ?? "",
    };
  }

  const processes: ProcessNodeRow[] = processRows.map((p) => ({
    id: p.code,
    dbId: p.id,
    name: p.name,
    level: p.level as ProcessNode["level"],
    parent: p.parent_id ? processCodeById.get(p.parent_id) ?? null : null,
    inscope: p.in_scope,
    priority: (p.priority ?? "M") as ProcessNode["priority"],
    description: p.description ?? "",
    notes: p.notes ?? "",
    orgUnits: (processOuRes.data ?? [])
      .filter((po) => po.process_id === p.id)
      .map((po) => ouLocationById.get(po.org_unit_id) ?? ""),
    requirements: requirementRows.filter((r) => r.source_type === "process" && r.source_id === p.id).map(toRequirement),
    processDeps: (processDepsRes.data ?? [])
      .filter((d) => d.process_id === p.id)
      .map((d) => processCodeById.get(d.depends_on_process_id) ?? ""),
    dataDeps: (deProcessLinksRes.data ?? [])
      .filter((l) => l.process_id === p.id)
      .map((l) => deCodeById.get(l.data_element_id) ?? ""),
    kanbanLinks: (processKanbanRes.data ?? [])
      .filter((k) => k.source_id === p.id)
      .map((k) => issueKeyById.get(k.issue_id) ?? ""),
  }));

  const dataElements: DataElementRow[] = dataElementRows.map((d) => ({
    id: d.code,
    dbId: d.id,
    name: d.name,
    category: d.category ?? "",
    description: d.description ?? "",
    owner: (d.owner_id && teamById.get(d.owner_id)) || "",
    ownerId: d.owner_id,
    source: d.source_system ?? "",
    target: d.target_system ?? "",
    volume: d.volume ?? "",
    complexity: (d.complexity ?? "M") as DataElement["complexity"],
    inscope: d.in_scope,
    linkedProcesses: (deProcessLinksRes.data ?? [])
      .filter((l) => l.data_element_id === d.id)
      .map((l) => ({ pid: processCodeById.get(l.process_id) ?? "", direction: l.direction ?? "Both" })),
    orgUnits: (deOuRes.data ?? []).filter((o) => o.data_element_id === d.id).map((o) => ouLocationById.get(o.org_unit_id) ?? ""),
    requirements: requirementRows.filter((r) => r.source_type === "data_element" && r.source_id === d.id).map(toRequirement),
    kanbanLinks: (deKanbanRes.data ?? []).filter((k) => k.source_id === d.id).map((k) => issueKeyById.get(k.issue_id) ?? ""),
  }));

  return { processes, dataElements };
}
