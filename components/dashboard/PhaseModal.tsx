"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertPhase } from "@/lib/actions/dashboard";

export function PhaseModal({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
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
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <i className="fa fa-plus" /> Add Phase
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Phase" size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Name</label>
            <input className="input" name="name" required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Start</label>
              <input className="input" type="date" name="start" required />
            </div>
            <div className="form-group">
              <label className="label">End</label>
              <input className="input" type="date" name="end" required />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Color</label>
              <input className="input" type="color" name="color" defaultValue="#6366f1" />
            </div>
            <div className="form-group">
              <label className="label">Progress (%)</label>
              <input className="input" type="number" name="progress" min={0} max={100} defaultValue={0} />
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
