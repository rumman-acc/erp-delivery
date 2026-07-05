"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertRisk } from "@/lib/actions/risks";
import type { RiskRow } from "@/lib/data/risks";
import type { TeamOption } from "@/lib/data/team";

const LEVELS = ["H", "M", "L"] as const;
const STATUSES = ["Open", "Mitigated", "Accepted", "Closed"] as const;

export function RiskModal({
  projectId,
  team,
  risk,
  trigger,
}: {
  projectId: string;
  team: TeamOption[];
  risk?: RiskRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (risk) formData.set("id", risk.dbId);
    const result = await upsertRisk(projectId, formData);
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
      <Modal open={open} onClose={() => setOpen(false)} title={risk ? "Edit Risk" : "Add Risk"} size="md">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Code</label>
              <input className="input" name="code" defaultValue={risk?.code ?? ""} placeholder="RSK-004" />
            </div>
            <div className="form-group">
              <label className="label">Category</label>
              <input className="input" name="category" defaultValue={risk?.category} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" name="description" defaultValue={risk?.description} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Probability</label>
              <select className="select" name="probability" defaultValue={risk?.probability ?? "M"}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Impact</label>
              <select className="select" name="impact" defaultValue={risk?.impact ?? "M"}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Mitigation</label>
            <textarea className="textarea" name="mitigation" defaultValue={risk?.mitigation} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Owner</label>
              <select className="select" name="owner_id" defaultValue={risk?.ownerId ?? ""}>
                <option value="">—</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="select" name="status" defaultValue={risk?.status ?? "Open"}>
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
