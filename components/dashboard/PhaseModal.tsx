"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertPhase } from "@/lib/actions/dashboard";
import type { Phase } from "@/lib/seed-data";

export function PhaseModal({
  projectId,
  phase,
  trigger,
}: {
  projectId: string;
  phase?: Phase;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (phase) formData.set("id", phase.id);
    const result = await upsertPhase(projectId, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <button className="btn btn-secondary btn-sm">
            <i className="fa fa-plus" /> Add Phase
          </button>
        )}
      </span>
      <Modal open={open} onClose={() => setOpen(false)} title={phase ? "Edit Phase" : "Add Phase"} size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Name</label>
            <input className="input" name="name" defaultValue={phase?.name} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Start</label>
              <input className="input" type="date" name="start" defaultValue={phase?.start || ""} />
            </div>
            <div className="form-group">
              <label className="label">End</label>
              <input className="input" type="date" name="end" defaultValue={phase?.end || ""} />
            </div>
          </div>
          <p className="text-sm text-muted">Leave Start/End blank if the timeline isn&apos;t set yet.</p>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Color</label>
              <input className="input" type="color" name="color" defaultValue={phase?.color || "#6366f1"} />
            </div>
            <div className="form-group">
              <label className="label">Progress (%)</label>
              <input className="input" type="number" name="progress" min={0} max={100} defaultValue={phase?.progress ?? 0} />
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
