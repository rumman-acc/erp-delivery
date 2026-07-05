"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { createIssue } from "@/lib/actions/kanban";
import type { KanbanColumn, TeamMember } from "@/lib/seed-data";

const TYPES = ["Epic", "Story", "Task", "Bug", "Sub-task"] as const;
const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

export function CreateIssueModal({
  projectId,
  columns,
  team,
  sprints,
}: {
  projectId: string;
  columns: KanbanColumn[];
  team: TeamMember[];
  sprints: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createIssue(projectId, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  return (
    <>
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        <i className="fa fa-plus" /> Create Issue
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create Issue" size="md">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Title</label>
            <input className="input" name="title" required autoFocus />
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" name="description" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Type</label>
              <select className="select" name="type" defaultValue="Task">
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Priority</label>
              <select className="select" name="priority" defaultValue="Medium">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Column</label>
              <select className="select" name="status_column_id" defaultValue={sortedColumns[0]?.id}>
                {sortedColumns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Assignee</label>
              <select className="select" name="assignee_id" defaultValue="">
                <option value="">—</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Sprint</label>
            <select className="select" name="sprint_id" defaultValue="">
              <option value="">—</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
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
              {pending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
