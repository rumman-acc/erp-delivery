"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { OrgUnit, TeamMember } from "@/lib/seed-data";
import type { ProjectConfig } from "@/lib/data/project";
import { updateProjectSettings, deleteOrgUnit } from "@/lib/actions/settings";
import { deleteTeamMember } from "@/lib/actions/resources";
import { TeamMemberModal } from "@/components/resources/TeamMemberModal";
import { OrgUnitModal } from "@/components/shell/OrgUnitModal";
import { DeleteButton } from "@/components/ui/DeleteButton";

const TABS = ["project", "team", "organization"] as const;
type Tab = (typeof TABS)[number];

export function SettingsButton({
  project,
  team,
  orgUnits,
}: {
  project: ProjectConfig;
  team: TeamMember[];
  orgUnits: OrgUnit[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("project");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSave(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateProjectSettings(project.id, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <i className="fa fa-gear" /> Settings
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Project Settings" size="lg">
        <div className="tab-bar">
          {TABS.map((t) => (
            <div
              key={t}
              className={`tab-item${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>
        {tab === "project" && (
          <form action={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 8 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">Project Name</label>
                <input className="input" name="name" defaultValue={project.name} required />
              </div>
              <div className="form-group">
                <label className="label">Client Name</label>
                <input className="input" name="client" defaultValue={project.client} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">ERP System</label>
                <input className="input" name="erp" defaultValue={project.erp} />
              </div>
              <div className="form-group">
                <label className="label">Go-Live Date</label>
                <input className="input" type="date" name="go_live" defaultValue={project.goLive} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">Issue Key Prefix</label>
                <input className="input" name="prefix" maxLength={6} defaultValue={project.prefix} />
              </div>
              <div className="form-group">
                <label className="label">Total Budget ($)</label>
                <input className="input" type="number" name="budget" defaultValue={project.budget} />
              </div>
            </div>
            <p className="text-sm text-muted">
              Signed in as {project.userEmail}
              {project.isSuperAdmin ? " (Super Admin)" : ""}.
            </p>
            {error && (
              <div className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            )}
            <div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
                <i className="fa fa-save" /> {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
        {tab === "team" && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <TeamMemberModal
                projectId={project.id}
                trigger={
                  <button className="btn btn-secondary btn-sm">
                    <i className="fa fa-plus" /> Add Member
                  </button>
                }
              />
            </div>
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Planned Hrs</th>
                  <th>Rate $/hr</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.role}</td>
                    <td>{m.location}</td>
                    <td>{m.plannedHours}</td>
                    <td>{m.rate}</td>
                    <td style={{ display: "flex", gap: 4 }}>
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
              </tbody>
            </table>
          </div>
        )}
        {tab === "organization" && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <OrgUnitModal
                projectId={project.id}
                trigger={
                  <button className="btn btn-secondary btn-sm">
                    <i className="fa fa-plus" /> Add Org Unit
                  </button>
                }
              />
            </div>
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Region</th>
                  <th>Strategic BU</th>
                  <th>Business Unit</th>
                  <th>Type</th>
                  <th>In Scope</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orgUnits.map((ou) => (
                  <tr key={ou.id}>
                    <td>{ou.location}</td>
                    <td>{ou.region}</td>
                    <td>{ou.strategicBU}</td>
                    <td>{ou.businessUnit}</td>
                    <td>{ou.type}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={ou.inScope} readOnly />
                    </td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <OrgUnitModal
                        projectId={project.id}
                        orgUnit={ou}
                        trigger={
                          <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                            <i className="fa fa-pen" />
                          </button>
                        }
                      />
                      <DeleteButton action={deleteOrgUnit.bind(null, project.id, ou.id)} confirmText="Delete this org unit?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
