import { getMyProjects } from "@/lib/data/project";
import { getResourcesData, getKnownPeople } from "@/lib/data/resources";
import { deleteTeamMember } from "@/lib/actions/resources";
import { avatarColor, avatarInitials } from "@/lib/ui-helpers";
import { HoursLog } from "@/components/resources/HoursLog";
import { TeamMemberModal } from "@/components/resources/TeamMemberModal";
import { DeleteButton } from "@/components/ui/DeleteButton";

// Global page (like AI Agent / Main Dashboard) — every project's roster,
// hours log, and budget stacked one after another, so assigning any of the
// shared team to any project doesn't require switching "current project."
// Rate/hours/budget stay genuinely per-project (that's real data, not just
// a display quirk), only the page itself is no longer locked to one.
export default async function ResourcesPage() {
  const [projects, knownPeople] = await Promise.all([getMyProjects(), getKnownPeople()]);
  if (projects.length === 0) return null;

  const sections = await Promise.all(
    projects.map(async (project) => ({
      project,
      ...(await getResourcesData(project.id)),
    }))
  );

  return (
    <div className="page active" id="page-resources">
      {sections.map(({ project, team, hoursLog, effortByRole }) => {
        const totalLogged = team.reduce((s, m) => s + m.loggedHours, 0);
        const totalCost = team.reduce((s, m) => s + m.loggedHours * m.rate, 0);
        const budget = project.budget;
        const budgetPct = budget ? Math.min(100, Math.round((totalCost / budget) * 100)) : 0;
        const roles = [...new Set(team.map((m) => m.role))];
        const teamNames = new Set(team.map((m) => m.name));
        const availablePeople = knownPeople.filter((p) => !teamNames.has(p.name));

        return (
          <div key={project.id} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>
              <i className="fa fa-folder-tree" /> {project.name}
            </h2>

            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <span className="card-title">
                  <i className="fa fa-users" /> Team Members
                </span>
                <TeamMemberModal
                  projectId={project.id}
                  knownPeople={availablePeople}
                  trigger={
                    <button className="btn btn-secondary btn-sm">
                      <i className="fa fa-plus" /> Add Member
                    </button>
                  }
                />
              </div>
              <div className="scrollable-x">
                <table className="table-auto">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Location</th>
                      <th>Planned Hrs</th>
                      <th>Rate ($/hr)</th>
                      <th>Logged Hrs</th>
                      <th>Remaining</th>
                      <th>Cost ($)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="avatar" style={{ background: avatarColor(m.name), color: "#fff" }}>
                              {avatarInitials(m.name)}
                            </span>
                            <span style={{ fontWeight: 600 }}>{m.name}</span>
                          </div>
                        </td>
                        <td>{m.role}</td>
                        <td>{m.location}</td>
                        <td>{m.plannedHours}</td>
                        <td>{m.rate}</td>
                        <td>{m.loggedHours}</td>
                        <td style={{ color: m.plannedHours - m.loggedHours < 0 ? "var(--danger)" : "var(--success)" }}>
                          {m.plannedHours - m.loggedHours}
                        </td>
                        <td style={{ fontWeight: 600 }}>${(m.loggedHours * m.rate).toLocaleString()}</td>
                        <td className="row-actions" style={{ display: "flex", gap: 4 }}>
                          <TeamMemberModal
                            projectId={project.id}
                            member={m}
                            trigger={
                              <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                                <i className="fa fa-pen" />
                              </button>
                            }
                          />
                          <DeleteButton action={deleteTeamMember.bind(null, project.id, m.id)} confirmText="Delete this team member?" />
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: "var(--surface2)", fontWeight: 700 }}>
                      <td colSpan={3}>TOTALS</td>
                      <td>{team.reduce((s, m) => s + m.plannedHours, 0)}</td>
                      <td>—</td>
                      <td>{totalLogged}</td>
                      <td>{team.reduce((s, m) => s + (m.plannedHours - m.loggedHours), 0)}</td>
                      <td>${totalCost.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    <i className="fa fa-circle-dollar-to-slot" /> Budget Overview
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="form-group">
                    <label className="label">Total Budget ($)</label>
                    <input type="number" className="input" defaultValue={budget} readOnly />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span className="text-sm text-muted">Utilized: ${totalCost.toLocaleString()}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: budgetPct > 90 ? "var(--danger)" : budgetPct > 70 ? "var(--warning)" : "var(--success)",
                        }}
                      >
                        {budgetPct}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${budgetPct}%`,
                          background: budgetPct > 90 ? "var(--danger)" : budgetPct > 70 ? "var(--warning)" : "var(--success)",
                        }}
                      />
                    </div>
                    <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                      Remaining: ${(budget - totalCost).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">
                    <i className="fa fa-chart-bar" /> Effort from Issues vs Planned
                  </span>
                </div>
                {roles.length === 0 ? (
                  <div className="empty-state text-sm">
                    <p>No team members yet</p>
                  </div>
                ) : (
                  <table className="table-auto">
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Issue Days</th>
                        <th>Issue Hrs</th>
                        <th>Planned Hrs</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((r) => {
                        const member = team.find((m) => m.role === r);
                        const issDays = effortByRole[r] || 0;
                        const issHrs = issDays * 8;
                        const planHrs = member?.plannedHours || 0;
                        const delta = issHrs - planHrs;
                        return (
                          <tr key={r}>
                            <td>{r}</td>
                            <td>{issDays}d</td>
                            <td>{issHrs}h</td>
                            <td>{planHrs}h</td>
                            <td
                              style={{
                                fontWeight: 600,
                                color: delta > 0 ? "var(--danger)" : delta < 0 ? "var(--success)" : "var(--text-muted)",
                              }}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}h
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <HoursLog projectId={project.id} initialEntries={hoursLog} team={team} />
          </div>
        );
      })}
    </div>
  );
}
