import { getCurrentProject } from "@/lib/data/project";
import { getKanbanData } from "@/lib/data/kanban";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default async function KanbanPage() {
  const project = await getCurrentProject();
  if (!project) return null;

  const { columns, issues, team, sprints } = await getKanbanData(project.id);

  return (
    <div className="page active" id="page-kanban">
      <KanbanBoard projectId={project.id} columns={columns} issues={issues} team={team} sprints={sprints} />
    </div>
  );
}
