"use client";

import { useState } from "react";
import { commitSuggestionBatch, type CommittedRow, type ProcessRef } from "@/lib/actions/suggestions";
import { formatDateTime } from "@/lib/ui-helpers";
import type { ProcessOption, SuggestionBatch, SuggestionRow } from "@/lib/data/agent";

type Confidence = SuggestionRow["confidence"];
type Common = { key: string; suggestionId: string | null; checked: boolean; wasEdited: boolean; supportingQuote: string | null; confidence: Confidence };
// Every type except new_project carries projectId — which of the meeting's
// linked projects this row targets, pre-filled from Claude's guess and
// changeable via the picker rendered for these five types.
type Targeted = { projectId: string };

type RowState =
  | (Common & Targeted & { suggestionType: "requirement"; description: string; reqType: string; priority: string; processRef: ProcessRef })
  | (Common & Targeted & { suggestionType: "new_process"; name: string; suggestedCode: string; level: 1 | 2 | 3; description: string; priority: string })
  | (Common & Targeted & { suggestionType: "action_item"; title: string; priority: string; dueDate: string | null })
  | (Common & Targeted & { suggestionType: "risk"; description: string; category: string; probability: string; impact: string; mitigation: string })
  | (Common & Targeted & { suggestionType: "issue"; description: string; category: string; severity: string; rootCause: string })
  | (Common & { suggestionType: "new_project"; name: string; description: string; suggestedIssuePrefix: string });

type SuggestionType = RowState["suggestionType"];

const TYPE_LABEL: Record<SuggestionType, string> = {
  requirement: "Requirement",
  new_process: "New Process",
  action_item: "Action Item",
  risk: "Risk",
  issue: "Issue",
  new_project: "New Project",
};
const TYPE_BADGE: Record<SuggestionType, string> = {
  requirement: "badge-info",
  new_process: "badge-purple",
  action_item: "badge-warning",
  risk: "badge-danger",
  issue: "badge-neutral",
  new_project: "badge-success",
};
const CONFIDENCE_BADGE: Record<string, string> = { high: "badge-success", medium: "badge-warning", low: "badge-neutral" };

function toRowState(s: SuggestionRow): RowState {
  const base: Common = { key: s.id, suggestionId: s.id, checked: false, wasEdited: false, supportingQuote: s.supportingQuote, confidence: s.confidence };
  switch (s.suggestionType) {
    case "requirement":
      return { ...base, suggestionType: "requirement", projectId: s.projectId, description: s.description, reqType: s.reqType, priority: s.priority, processRef: { type: "existing", id: "" } };
    case "new_process":
      return { ...base, suggestionType: "new_process", projectId: s.projectId, name: s.name, suggestedCode: s.suggestedCode, level: s.level, description: s.description, priority: s.priority };
    case "action_item":
      return { ...base, suggestionType: "action_item", projectId: s.projectId, title: s.title, priority: s.priority, dueDate: s.dueDate };
    case "risk":
      return { ...base, suggestionType: "risk", projectId: s.projectId, description: s.description, category: s.category, probability: s.probability, impact: s.impact, mitigation: s.mitigation };
    case "issue":
      return { ...base, suggestionType: "issue", projectId: s.projectId, description: s.description, category: s.category, severity: s.severity, rootCause: s.rootCause };
    case "new_project":
      return { ...base, suggestionType: "new_project", name: s.name, description: s.description, suggestedIssuePrefix: s.suggestedIssuePrefix };
  }
}

function blankRow(type: SuggestionType, defaultProjectId: string): RowState {
  const base: Common = { key: `new-${crypto.randomUUID()}`, suggestionId: null, checked: true, wasEdited: false, supportingQuote: null, confidence: null };
  switch (type) {
    case "requirement":
      return { ...base, suggestionType: "requirement", projectId: defaultProjectId, description: "", reqType: "Functional", priority: "Medium", processRef: { type: "existing", id: "" } };
    case "new_process":
      return { ...base, suggestionType: "new_process", projectId: defaultProjectId, name: "", suggestedCode: "", level: 1, description: "", priority: "M" };
    case "action_item":
      return { ...base, suggestionType: "action_item", projectId: defaultProjectId, title: "", priority: "Medium", dueDate: null };
    case "risk":
      return { ...base, suggestionType: "risk", projectId: defaultProjectId, description: "", category: "", probability: "M", impact: "M", mitigation: "" };
    case "issue":
      return { ...base, suggestionType: "issue", projectId: defaultProjectId, description: "", category: "", severity: "Medium", rootCause: "" };
    case "new_project":
      return { ...base, suggestionType: "new_project", name: "", description: "", suggestedIssuePrefix: "" };
  }
}

function processRefToValue(ref: ProcessRef): string {
  return ref.type === "existing" ? (ref.id ? `existing:${ref.id}` : "") : `new:${ref.tempKey}`;
}
function valueToProcessRef(value: string): ProcessRef {
  if (value.startsWith("existing:")) return { type: "existing", id: value.slice("existing:".length) };
  if (value.startsWith("new:")) return { type: "new", tempKey: value.slice("new:".length) };
  return { type: "existing", id: "" };
}

// fallbackProjectId anchors a reviewer-added new_project row to one of the
// meeting's linked projects — required by agent_suggestions' NOT NULL
// project_id / RLS check, never shown to or chosen by the reviewer (see
// lib/actions/suggestions.ts's CommittedRow doc comment).
function toCommittedRow(r: RowState, fallbackProjectId: string): CommittedRow {
  switch (r.suggestionType) {
    case "requirement":
      return { suggestionId: r.suggestionId, suggestionType: "requirement", projectId: r.projectId, description: r.description, reqType: r.reqType, priority: r.priority, processRef: r.processRef, wasEdited: r.wasEdited };
    case "new_process":
      return { suggestionId: r.suggestionId, suggestionType: "new_process", projectId: r.projectId, tempKey: r.key, name: r.name, suggestedCode: r.suggestedCode, level: r.level, description: r.description, priority: r.priority, wasEdited: r.wasEdited };
    case "action_item":
      return { suggestionId: r.suggestionId, suggestionType: "action_item", projectId: r.projectId, title: r.title, priority: r.priority, dueDate: r.dueDate, wasEdited: r.wasEdited };
    case "risk":
      return { suggestionId: r.suggestionId, suggestionType: "risk", projectId: r.projectId, description: r.description, category: r.category, probability: r.probability, impact: r.impact, mitigation: r.mitigation, wasEdited: r.wasEdited };
    case "issue":
      return { suggestionId: r.suggestionId, suggestionType: "issue", projectId: r.projectId, description: r.description, category: r.category, severity: r.severity, rootCause: r.rootCause, wasEdited: r.wasEdited };
    case "new_project":
      return { suggestionId: r.suggestionId, suggestionType: "new_project", anchorProjectId: fallbackProjectId, name: r.name, description: r.description, suggestedIssuePrefix: r.suggestedIssuePrefix, wasEdited: r.wasEdited };
  }
}

function RowFields({
  row,
  processes,
  newProcessOptions,
  onChange,
}: {
  row: RowState;
  processes: ProcessOption[];
  newProcessOptions: Extract<RowState, { suggestionType: "new_process" }>[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  switch (row.suggestionType) {
    case "requirement":
      return (
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Description</label>
            <input className="inline-edit" value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Type</label>
            <input className="inline-edit" value={row.reqType} onChange={(e) => onChange({ reqType: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Priority</label>
            <select className="select" value={row.priority} onChange={(e) => onChange({ priority: e.target.value })}>
              {["Critical", "High", "Medium", "Low"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Process</label>
            <select
              className="select"
              value={processRefToValue(row.processRef)}
              onChange={(e) => onChange({ processRef: valueToProcessRef(e.target.value) })}
            >
              <option value="">Pick process…</option>
              {processes.map((p) => (
                <option key={p.id} value={`existing:${p.id}`}>{p.code} — {p.name}</option>
              ))}
              {newProcessOptions.map((np) => (
                <option key={np.key} value={`new:${np.key}`}>→ (new) {np.name || "Untitled process"}</option>
              ))}
            </select>
          </div>
        </div>
      );
    case "new_process":
      return (
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="form-group">
            <label className="label">Name</label>
            <input className="inline-edit" value={row.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Code</label>
            <input className="inline-edit" value={row.suggestedCode} onChange={(e) => onChange({ suggestedCode: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Level</label>
            <select className="select" value={row.level} onChange={(e) => onChange({ level: Number(e.target.value) })}>
              {[1, 2, 3].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Priority</label>
            <select className="select" value={row.priority} onChange={(e) => onChange({ priority: e.target.value })}>
              {["H", "M", "L"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Description</label>
            <input className="inline-edit" value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
        </div>
      );
    case "action_item":
      return (
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Title</label>
            <input className="inline-edit" value={row.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Priority</label>
            <select className="select" value={row.priority} onChange={(e) => onChange({ priority: e.target.value })}>
              {["Critical", "High", "Medium", "Low"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Due Date</label>
            <input className="input" type="date" value={row.dueDate ?? ""} onChange={(e) => onChange({ dueDate: e.target.value || null })} />
          </div>
        </div>
      );
    case "risk":
      return (
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Description</label>
            <input className="inline-edit" value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <input className="inline-edit" value={row.category} onChange={(e) => onChange({ category: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Probability</label>
            <select className="select" value={row.probability} onChange={(e) => onChange({ probability: e.target.value })}>
              {["H", "M", "L"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Impact</label>
            <select className="select" value={row.impact} onChange={(e) => onChange({ impact: e.target.value })}>
              {["H", "M", "L"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Mitigation</label>
            <input className="inline-edit" value={row.mitigation} onChange={(e) => onChange({ mitigation: e.target.value })} />
          </div>
        </div>
      );
    case "issue":
      return (
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Description</label>
            <input className="inline-edit" value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Category</label>
            <input className="inline-edit" value={row.category} onChange={(e) => onChange({ category: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Severity</label>
            <select className="select" value={row.severity} onChange={(e) => onChange({ severity: e.target.value })}>
              {["Critical", "High", "Medium", "Low"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Root Cause</label>
            <input className="inline-edit" value={row.rootCause} onChange={(e) => onChange({ rootCause: e.target.value })} />
          </div>
        </div>
      );
    case "new_project":
      return (
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="form-group">
            <label className="label">Project Name</label>
            <input className="inline-edit" value={row.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Issue Prefix</label>
            <input className="inline-edit" value={row.suggestedIssuePrefix} onChange={(e) => onChange({ suggestedIssuePrefix: e.target.value.toUpperCase() })} />
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="label">Description</label>
            <input className="inline-edit" value={row.description} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
          <div className="text-sm text-muted" style={{ gridColumn: "1 / -1" }}>
            Approving this creates a brand-new project, seeded with the default Kanban board and the full team roster.
          </div>
        </div>
      );
  }
}

function BatchCard({
  batch,
  processesMap,
  onCommitted,
}: {
  batch: SuggestionBatch;
  processesMap: Record<string, ProcessOption[]>;
  onCommitted: () => void;
}) {
  const [rows, setRows] = useState<RowState[]>(() => batch.suggestions.map(toRowState));
  const [addType, setAddType] = useState<SuggestionType>("requirement");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultProjectId = batch.linkedProjects[0]?.id ?? "";

  function updateRow(key: string, patch: Record<string, unknown>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? ({ ...r, ...patch, wasEdited: r.suggestionId ? true : r.wasEdited } as RowState) : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(addType, defaultProjectId)]);
  }

  async function handleProceed() {
    const approved = rows.filter((r) => r.checked).map((r) => toCommittedRow(r, defaultProjectId));
    setPending(true);
    setError(null);
    const result = await commitSuggestionBatch(batch.meetingSourceId, batch.batchId, approved);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onCommitted();
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">
          {batch.meetingSubject}
        </span>
        <span className="text-sm text-muted">{formatDateTime(batch.meetingStartTime)}</span>
      </div>
      <div className="text-sm text-muted" style={{ marginBottom: 12 }}>
        <i className="fa fa-folder-tree" /> Linked to: {batch.linkedProjects.map((p) => p.name).join(", ") || "—"}
      </div>
      {rows.map((r) => {
        // A requirement's process picker should only offer new_process rows
        // targeting the SAME project — a process belongs to one project, so
        // a new_process being created for a different project in this same
        // batch isn't a valid target.
        const newProcessOptions =
          r.suggestionType === "requirement"
            ? rows.filter(
                (o): o is Extract<RowState, { suggestionType: "new_process" }> =>
                  o.suggestionType === "new_process" && o.checked && o.projectId === r.projectId
              )
            : [];
        const processes = "projectId" in r ? processesMap[r.projectId] ?? [] : [];

        return (
          <div key={r.key} style={{ display: "flex", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, marginBottom: 8 }}>
            <input type="checkbox" checked={r.checked} onChange={(e) => updateRow(r.key, { checked: e.target.checked })} style={{ marginTop: 4 }} />
            <div style={{ flex: 1 }}>
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <span className={`badge ${TYPE_BADGE[r.suggestionType]}`}>{TYPE_LABEL[r.suggestionType]}</span>
                {r.confidence ? (
                  <span className={`badge ${CONFIDENCE_BADGE[r.confidence]}`}>{r.confidence} confidence</span>
                ) : (
                  <span className="badge badge-purple">added by you</span>
                )}
              </div>
              {"projectId" in r && batch.linkedProjects.length > 1 && (
                <div className="form-group" style={{ marginBottom: 8, maxWidth: 240 }}>
                  <label className="label">Project</label>
                  <select className="select" value={r.projectId} onChange={(e) => updateRow(r.key, { projectId: e.target.value })}>
                    {batch.linkedProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <RowFields row={r} processes={processes} newProcessOptions={newProcessOptions} onChange={(patch) => updateRow(r.key, patch)} />
              {r.supportingQuote && (
                <div className="text-sm text-muted" style={{ marginTop: 8, fontStyle: "italic" }}>
                  <i className="fa fa-quote-left" /> {r.supportingQuote}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex-between" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="select" value={addType} onChange={(e) => setAddType(e.target.value as SuggestionType)} style={{ width: 160 }}>
            {(Object.keys(TYPE_LABEL) as SuggestionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>
            <i className="fa fa-plus" /> Add Row
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {error && <span className="text-sm" style={{ color: "var(--danger)" }}>{error}</span>}
          <button className="btn btn-primary btn-sm" onClick={handleProceed} disabled={pending}>
            <i className="fa fa-check" /> {pending ? "Processing…" : "Proceed"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewQueue({
  batches,
  processesMap,
}: {
  batches: SuggestionBatch[];
  processesMap: Record<string, ProcessOption[]>;
}) {
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  const remaining = batches.filter((b) => !committed.has(b.batchId));

  if (remaining.length === 0) {
    return (
      <div className="empty-state text-sm">
        <p>Extracted suggestions from processed meetings will show up here for approval.</p>
      </div>
    );
  }

  return (
    <div>
      {remaining.map((batch) => (
        <BatchCard
          key={batch.batchId}
          batch={batch}
          processesMap={processesMap}
          onCommitted={() => setCommitted((prev) => new Set(prev).add(batch.batchId))}
        />
      ))}
    </div>
  );
}
