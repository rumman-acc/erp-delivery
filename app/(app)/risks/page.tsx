import { getCurrentProject } from "@/lib/data/project";
import { getRisksData } from "@/lib/data/risks";
import { getTeamOptions } from "@/lib/data/team";
import { RisksAndIssues } from "@/components/risks/RisksAndIssues";

export default async function RisksPage() {
  const project = await getCurrentProject();
  if (!project) return null;

  const [{ risks, issuesLog }, team] = await Promise.all([getRisksData(project.id), getTeamOptions(project.id)]);

  return (
    <div className="page active" id="page-risks">
      <RisksAndIssues projectId={project.id} team={team} risks={risks} issuesLog={issuesLog} />
    </div>
  );
}
