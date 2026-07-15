import { getCurrentProject, getMyProjects, getMyProjectStats } from "@/lib/data/project";
import { ProjectsGrid } from "@/components/projects/ProjectsGrid";

export default async function ProjectsPage() {
  const [current, projects, stats] = await Promise.all([getCurrentProject(), getMyProjects(), getMyProjectStats()]);
  if (!current) return null;

  const totals = stats.reduce(
    (acc, s) => ({
      openIssues: acc.openIssues + s.openIssues,
      totalIssues: acc.totalIssues + s.totalIssues,
      openRisks: acc.openRisks + s.openRisks,
      totalRisks: acc.totalRisks + s.totalRisks,
    }),
    { openIssues: 0, totalIssues: 0, openRisks: 0, totalRisks: 0 }
  );

  return (
    <div className="page active" id="page-projects">
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>
        <i className="fa fa-folder-tree" /> Main Dashboard
      </h2>

      <div className="kpi-grid">
        <div className="kpi-card" style={{ cursor: "default" }}>
          <div className="kpi-label">
            <i className="fa fa-folder-tree" /> Projects
          </div>
          <div className="kpi-value">{projects.length}</div>
          <div className="kpi-sub">across Accelance</div>
        </div>
        <div className="kpi-card" style={{ cursor: "default" }}>
          <div className="kpi-label">
            <i className="fa fa-table-columns" /> Open Issues
          </div>
          <div className="kpi-value">{totals.openIssues}</div>
          <div className="kpi-sub">{totals.totalIssues} total</div>
        </div>
        <div className="kpi-card" style={{ cursor: "default" }}>
          <div className="kpi-label">
            <i className="fa fa-triangle-exclamation" /> Open Risks
          </div>
          <div className="kpi-value">{totals.openRisks}</div>
          <div className="kpi-sub">{totals.totalRisks} total</div>
        </div>
      </div>

      <ProjectsGrid projects={projects} stats={stats} currentProjectId={current.id} isSuperAdmin={current.isSuperAdmin} />
    </div>
  );
}
