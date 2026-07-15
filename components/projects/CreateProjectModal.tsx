"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { createProject } from "@/lib/actions/projects";

export function CreateProjectModal({ onCreated }: { onCreated: (projectId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createProject({
      name: String(formData.get("name") ?? ""),
      client: String(formData.get("client") ?? ""),
      issuePrefix: String(formData.get("issue_prefix") ?? ""),
    });
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    if (result?.id) onCreated(result.id);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <i className="fa fa-plus" /> New Project
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Project" size="sm">
        <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Project Name</label>
            <input className="input" name="name" placeholder="e.g. Client Onboarding Portal" required autoFocus />
          </div>
          <div className="form-group">
            <label className="label">Client</label>
            <input className="input" name="client" defaultValue="Accelance" />
          </div>
          <div className="form-group">
            <label className="label">Issue Prefix</label>
            <input className="input" name="issue_prefix" placeholder="e.g. COP" maxLength={10} required />
          </div>
          <p className="text-sm text-muted">
            Starts with a blank Kanban board and the full team roster — budget starts at 0, add real numbers later in
            Settings.
          </p>
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
              {pending ? "Creating…" : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
