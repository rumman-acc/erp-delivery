"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertIssueLog } from "@/lib/actions/risks";
import type { IssueLogRow } from "@/lib/data/risks";
import type { TeamOption } from "@/lib/data/team";

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;

export function IssueLogModal({
  projectId,
  team,
  entry,
  trigger,
}: {
  projectId: string;
  team: TeamOption[];
  entry?: IssueLogRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (entry) formData.set("id", entry.dbId);
    const result = await upsertIssueLog(projectId, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Modal open={open} onClose={() => setOpen(false)} title={entry ? "Edit Issue" : "Add Issue"} size="md">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Code</label>
              <input className="input" name="code" defaultValue={entry?.code ?? ""} placeholder="ISS-003" />
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input className="input" name="category" defaultValue={entry?.category} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" name="description" defaultValue={entry?.description} required />
          </div>
          <div className="form-group">
            <label className="label">Root Cause</label>
            <textarea className="textarea" name="root_cause" defaultValue={entry?.rootCause} />
          </div>
          <div className="form-group">
            <label className="label">Resolution</label>
            <textarea className="textarea" name="resolution" defaultValue={entry?.resolution} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Owner</label>
              <select className="select" name="owner_id" defaultValue={entry?.ownerId ?? ""}>
                <option value="">—</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Severity</label>
              <input className="input" name="severity" defaultValue={entry?.severity} placeholder="High / Medium / Low" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Due Date</label>
              <input className="input" type="date" name="due" defaultValue={entry?.due} />
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="select" name="status" defaultValue={entry?.status ?? "Open"}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
