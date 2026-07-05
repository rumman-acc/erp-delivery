"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertGate } from "@/lib/actions/dashboard";
import type { GateRow } from "@/lib/data/dashboard";
import type { TeamOption } from "@/lib/data/team";

const STATUSES = ["green", "amber", "red", "grey"] as const;

export function GateModal({
  projectId,
  team,
  gate,
  trigger,
}: {
  projectId: string;
  team: TeamOption[];
  gate?: GateRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (gate) formData.set("id", gate.id);
    const result = await upsertGate(projectId, formData);
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
      <Modal open={open} onClose={() => setOpen(false)} title={gate ? "Edit Gate" : "Add Gate"} size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Name</label>
            <input className="input" name="name" defaultValue={gate?.name} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Date</label>
              <input className="input" type="date" name="date" defaultValue={gate?.date} />
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="select" name="status" defaultValue={gate?.status ?? "grey"}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Responsible</label>
            <select className="select" name="responsible_id" defaultValue={gate?.responsibleId ?? ""}>
              <option value="">—</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="textarea" name="notes" defaultValue={gate?.notes} />
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
