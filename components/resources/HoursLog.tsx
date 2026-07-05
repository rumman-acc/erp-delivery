"use client";

import { useState } from "react";
import type { HoursLogEntry, TeamMember } from "@/lib/seed-data";
import { formatDate } from "@/lib/ui-helpers";
import { addHoursLog, deleteHoursLog } from "@/lib/actions/resources";
import { DeleteButton } from "@/components/ui/DeleteButton";

export function HoursLog({
  projectId,
  initialEntries,
  team,
}: {
  projectId: string;
  initialEntries: HoursLogEntry[];
  team: TeamMember[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await addHoursLog(projectId, formData);
    setPending(false);
    if (result?.error) setError(result.error);
    else (document.getElementById("hours-log-form") as HTMLFormElement | null)?.reset();
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <i className="fa fa-clock" /> Hours Log
        </span>
      </div>
      <div className="scrollable-x" style={{ marginBottom: 16 }}>
        <table className="table-auto">
          <thead>
            <tr>
              <th>Date</th>
              <th>Team Member</th>
              <th>Hours</th>
              <th>Activity</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initialEntries.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="empty-state text-sm">
                    <p>No hours logged</p>
                  </div>
                </td>
              </tr>
            ) : (
              initialEntries.map((h) => (
                <tr key={h.id}>
                  <td className="text-sm text-muted">{formatDate(h.date)}</td>
                  <td>{h.person}</td>
                  <td style={{ fontWeight: 600 }}>{h.hours}h</td>
                  <td>{h.activity}</td>
                  <td className="text-muted text-sm">{h.notes}</td>
                  <td>
                    <DeleteButton action={deleteHoursLog.bind(null, projectId, h.id)} confirmText="Delete this hours log entry?" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
          Log Hours
        </div>
        <form id="hours-log-form" action={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-group">
            <label className="label">Date</label>
            <input type="date" className="input" name="date" style={{ width: 140 }} defaultValue={new Date().toISOString().split("T")[0]} />
          </div>
          <div className="form-group">
            <label className="label">Member</label>
            <select className="select" name="team_member_id" style={{ width: 160 }}>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Hours</label>
            <input type="number" className="input" name="hours" style={{ width: 80 }} defaultValue={8} min={0.5} step={0.5} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <label className="label">Activity</label>
            <input className="input" name="activity" placeholder="Activity description..." required />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
            <label className="label">Notes</label>
            <input className="input" name="notes" placeholder="Optional notes..." />
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            <i className="fa fa-plus" /> {pending ? "Logging…" : "Log"}
          </button>
        </form>
        {error && (
          <div className="text-sm" style={{ color: "var(--danger)", marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
