"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertActionItem } from "@/lib/actions/dashboard";
import type { ActionItemRow } from "@/lib/data/dashboard";
import type { TeamOption } from "@/lib/data/team";

const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;

export function ActionItemModal({
  projectId,
  team,
  item,
  trigger,
}: {
  projectId: string;
  team: TeamOption[];
  item?: ActionItemRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (item) formData.set("id", item.id);
    const result = await upsertActionItem(projectId, formData);
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
      <Modal open={open} onClose={() => setOpen(false)} title={item ? "Edit Action Item" : "Add Action Item"} size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Title</label>
            <input className="input" name="title" defaultValue={item?.title} required />
          </div>
          <div className="form-group">
            <label className="label">Owner</label>
            <select className="select" name="owner_id" defaultValue={item?.ownerId ?? ""}>
              <option value="">—</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Due Date</label>
              <input className="input" type="date" name="due" defaultValue={item?.due} />
            </div>
            <div className="form-group">
              <label className="label">Priority</label>
              <select className="select" name="priority" defaultValue={item?.priority ?? "Medium"}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Status</label>
            <select className="select" name="status" defaultValue={item?.status ?? "Open"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
