import Link from "next/link";
import { getCurrentProject } from "@/lib/data/project";
import { getDashboardData } from "@/lib/data/dashboard";
import { getTeamOptions } from "@/lib/data/team";
import { deleteActionItem, deleteGate, deletePhase } from "@/lib/actions/dashboard";
import { formatDate, priorityBadgeClass, ragColor, statusBadgeClass } from "@/lib/ui-helpers";
import { GanttChart } from "@/components/dashboard/GanttChart";
import { GateModal } from "@/components/dashboard/GateModal";
import { ActionItemModal } from "@/components/dashboard/ActionItemModal";
import { PhaseModal } from "@/components/dashboard/PhaseModal";
import { DeleteButton } from "@/components/ui/DeleteButton";

function KpiCard({ label, value, sub, icon, href }: { label: string; value: string | number; sub: string; icon: string; href: string }) {
  return (
    <Link href={href} className="kpi-card" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="kpi-label">
        <i className={`fa ${icon}`} /> {label}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const project = await getCurrentProject();
  if (!project) return null;

  const [{ phases, gates, actions, totalProcesses, inScopeProcesses, totalIssues, openIssues, totalRisks, openRisks, totalCost }, team] =
    await Promise.all([getDashboardData(project.id), getTeamOptions(project.id)]);

  const budgetPct = project.budget ? Math.round((totalCost / project.budget) * 100) : 0;

  return (
    <div className="page active" id="page-dashboard">
      <div className="kpi-grid">
        <KpiCard label="Total Processes" value={totalProcesses} sub={`${inScopeProcesses} in scope`} icon="fa-sitemap" href="/scope" />
        <KpiCard
          label="In-Scope %"
          value={`${Math.round((inScopeProcesses / Math.max(1, totalProcesses)) * 100)}%`}
          sub={`${inScopeProcesses} of ${totalProcesses} processes`}
          icon="fa-bullseye"
          href="/scope"
        />
        <KpiCard label="Kanban Issues" value={totalIssues} sub={`${openIssues} open`} icon="fa-table-columns" href="/kanban" />
        <KpiCard label="Open Risks" value={openRisks} sub={`${totalRisks} total`} icon="fa-triangle-exclamation" href="/risks" />
        <KpiCard
          label="Budget Used"
          value={`${budgetPct}%`}
          sub={`$${(totalCost / 1000).toFixed(0)}k of $${(project.budget / 1000).toFixed(0)}k`}
          icon="fa-circle-dollar-to-slot"
          href="/resources"
        />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa fa-timeline" /> Project Timeline
          </span>
          <PhaseModal projectId={project.id} />
        </div>
        <div className="gantt-wrap">
          <GanttChart phases={phases} />
        </div>
        {phases.length > 0 && (
          <table className="table-auto" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Start</th>
                <th>End</th>
                <th>Progress</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {phases.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="rag-dot" style={{ background: p.color }} /> {p.name}
                  </td>
                  <td className="text-muted text-sm">
                    {p.start && p.end ? formatDate(p.start) : <span className="badge badge-neutral">Not scheduled</span>}
                  </td>
                  <td className="text-muted text-sm">{p.start && p.end ? formatDate(p.end) : ""}</td>
                  <td className="text-muted text-sm">{p.progress}%</td>
                  <td className="row-actions" style={{ display: "flex", gap: 4 }}>
                    <PhaseModal
                      projectId={project.id}
                      phase={p}
                      trigger={
                        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                          <i className="fa fa-pen" />
                        </button>
                      }
                    />
                    <DeleteButton action={deletePhase.bind(null, project.id, p.id)} confirmText="Delete this phase?" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa fa-flag" /> Milestone Gates
            </span>
            <GateModal projectId={project.id} team={team} trigger={
              <button className="btn btn-secondary btn-sm">
                <i className="fa fa-plus" /> Add
              </button>
            } />
          </div>
          {gates.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No milestone gates</p>
            </div>
          ) : (
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Gate</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Responsible</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gates.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td className="text-muted text-sm">{formatDate(g.date)}</td>
                    <td>
                      <span className="rag-dot" style={{ background: ragColor(g.status) }} />{" "}
                      {g.status.charAt(0).toUpperCase() + g.status.slice(1)}
                    </td>
                    <td className="text-muted text-sm">{g.responsible}</td>
                    <td className="row-actions" style={{ display: "flex", gap: 4 }}>
                      <GateModal
                        projectId={project.id}
                        team={team}
                        gate={g}
                        trigger={
                          <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                            <i className="fa fa-pen" />
                          </button>
                        }
                      />
                      <DeleteButton action={deleteGate.bind(null, project.id, g.id)} confirmText="Delete this gate?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa fa-list-check" /> Action Items
            </span>
            <ActionItemModal projectId={project.id} team={team} trigger={
              <button className="btn btn-secondary btn-sm">
                <i className="fa fa-plus" /> Add
              </button>
            } />
          </div>
          {actions.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No action items</p>
            </div>
          ) : (
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {actions.map((a) => (
                  <tr key={a.id}>
                    <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.title}
                    </td>
                    <td className="text-muted text-sm">{a.owner}</td>
                    <td className="text-muted text-sm">{formatDate(a.due)}</td>
                    <td>
                      <span className={priorityBadgeClass(a.priority)}>{a.priority}</span>
                    </td>
                    <td>
                      <span className={statusBadgeClass(a.status)}>{a.status}</span>
                    </td>
                    <td className="row-actions" style={{ display: "flex", gap: 4 }}>
                      <ActionItemModal
                        projectId={project.id}
                        team={team}
                        item={a}
                        trigger={
                          <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                            <i className="fa fa-pen" />
                          </button>
                        }
                      />
                      <DeleteButton action={deleteActionItem.bind(null, project.id, a.id)} confirmText="Delete this action item?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
