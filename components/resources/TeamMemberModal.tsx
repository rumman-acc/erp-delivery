"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { upsertTeamMember } from "@/lib/actions/resources";
import type { TeamMember } from "@/lib/seed-data";

export function TeamMemberModal({
  projectId,
  member,
  trigger,
}: {
  projectId: string;
  member?: TeamMember;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    if (member) formData.set("id", member.id);
    const result = await upsertTeamMember(projectId, formData);
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
      <Modal open={open} onClose={() => setOpen(false)} title={member ? "Edit Team Member" : "Add Team Member"} size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Name</label>
            <input className="input" name="name" defaultValue={member?.name} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Role</label>
              <input className="input" name="role" defaultValue={member?.role} required />
            </div>
            <div className="form-group">
              <label className="label">Location</label>
              <input className="input" name="location" defaultValue={member?.location} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Planned Hours</label>
              <input className="input" type="number" name="planned_hours" defaultValue={member?.plannedHours ?? 0} />
            </div>
            <div className="form-group">
              <label className="label">Rate ($/hr)</label>
              <input className="input" type="number" name="rate" defaultValue={member?.rate ?? 0} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Logged Hours</label>
            <input className="input" type="number" name="logged_hours" defaultValue={member?.loggedHours ?? 0} />
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
