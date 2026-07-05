import { getCurrentProject } from "@/lib/data/project";
import { getScopeData } from "@/lib/data/scope";
import { ScopeExplorer } from "@/components/scope/ScopeExplorer";

export default async function ScopePage() {
  const project = await getCurrentProject();
  if (!project) return null;

  const { processes, dataElements } = await getScopeData(project.id);

  return (
    <div className="page active" id="page-scope">
      <ScopeExplorer projectId={project.id} processes={processes} dataElements={dataElements} />
    </div>
  );
}
