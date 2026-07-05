"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertOrgUnit } from "@/lib/actions/settings";
import type { OrgUnit } from "@/lib/seed-data";

const REGIONS = ["NA", "EMEA", "APAC", "LATAM", "MEA", "Global HQ", "Other"];
const TYPES = ["Headquarters", "Regional Office", "Sales Office", "Distribution Center", "Manufacturing Plant", "Shared Services Center", "R&D Center", "Other"];

export function OrgUnitModal({
  projectId,
  orgUnit,
  trigger,
}: {
  projectId: string;
  orgUnit?: OrgUnit;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (orgUnit) formData.set("id", orgUnit.id);
    const result = await upsertOrgUnit(projectId, formData);
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
      <Modal open={open} onClose={() => setOpen(false)} title={orgUnit ? "Edit Org Unit" : "Add Org Unit"} size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Location</label>
            <input className="input" name="location" defaultValue={orgUnit?.location} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Region</label>
              <select className="select" name="region" defaultValue={orgUnit?.region ?? REGIONS[0]}>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Type</label>
              <select className="select" name="type" defaultValue={orgUnit?.type ?? TYPES[0]}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Strategic BU</label>
              <input className="input" name="strategic_bu" defaultValue={orgUnit?.strategicBU} />
            </div>
            <div className="form-group">
              <label className="label">Business Unit</label>
              <input className="input" name="business_unit" defaultValue={orgUnit?.businessUnit} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" name="in_scope" defaultChecked={orgUnit?.inScope ?? true} /> In Scope
          </label>
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
