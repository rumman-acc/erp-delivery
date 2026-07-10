"use client";

import { useState } from "react";
import { commitSuggestionBatch, type CommittedRow, type ProcessRef } from "@/lib/actions/suggestions";
import { formatDateTime } from "@/lib/ui-helpers";
import type { ProcessOption, SuggestionBatch, SuggestionRow } from "@/lib/data/agent";

type Confidence = SuggestionRow["confidence"];
type Common = { key: string; suggestionId: string | null; checked: boolean; wasEdited: boolean; supportingQuote: string | null; confidence: Confidence };

type RowState =
  | (Common & { suggestionType: "requirement"; description: string; reqType: string; priority: string; processRef: ProcessRef })
  | (Common & { suggestionType: "new_process"; name: string; suggestedCode: string; level: 1 | 2 | 3; description: string; priority: string })
  | (Common & { suggestionType: "action_item"; title: string; priority: string; dueDate: string | null })
  | (Common & { suggestionType: "risk"; description: string; category: string; probability: string; impact: string; mitigation: string })
  | (Common & { suggestionType: "issue"; description: string; category: string; severity: string; rootCause: string });

type SuggestionType = RowState["suggestionType"];

const TYPE_LABEL: Record<SuggestionType, string> = {
  requirement: "Requirement",
  new_process: "New Process",
  action_item: "Action Item",
  risk: "Risk",
  issue: "Issue",
};
const TYPE_BADGE: Record<SuggestionType, string> = {
  requirement: "badge-info",
  new_process: "badge-purple",
  action_item: "badge-warning",
  risk: "badge-danger",
  issue: "badge-neutral",
};
const CONFIDENCE_BADGE: Record<string, string> = { high: "badge-success", medium: "badge-warning", low: "badge-neutral" };

function toRowState(s: SuggestionRow): RowState {
  const base: Common = { key: s.id, suggestionId: s.id, checked: false, wasEdited: false, supportingQuote: s.supportingQuote, confidence: s.confidence };
  switch (s.suggestionType) {
    case "requirement":
      return { ...base, suggestionType: "requirement", description: s.description, reqType: s.reqType, priority: s.priority, processRef: { type: "existing", id: "" } };
    case "new_process":
      return { ...base, suggestionType: "new_process", name: s.name, suggestedCode: s.suggestedCode, level: s.level, description: s.description, priority: s.priority };
    case "action_item":
      return { ...base, suggestionType: "action_item", title: s.title, priority: s.priority, dueDate: s.dueDate };
    case "risk":
      return { ...base, suggestionType: "risk", description: s.description, category: s.category, probability: s.probability, impact: s.impact, mitigation: s.mitigation };
    case "issue":
      return { ...base, suggestionType: "issue", description: s.description, category: s.category, severity: s.severity, rootCause: s.rootCause };
  }
}

function blankRow(type: SuggestionType): RowState {
  const base: Common = { key: `new-${crypto.randomUUID()}`, suggestionId: null, checked: true, wasEdited: false, supportingQuote: null, confidence: null };
  switch (type) {
    case "requirement":
      return { ...base, suggestionType: "requirement", description: "", reqType: "Functional", priority: "Medium", processRef: { type: "existing", id: "" } };
    case "new_process":
      return { ...base, suggestionType: "new_process", name: "", suggestedCode: "", level: 1, description: "", priority: "M" };
    case "action_item":
      return { ...base, suggestionType: "action_item", title: "", priority: "Medium", dueDate: null };
    case "risk":
      return { ...base, suggestionType: "risk", description: "", category: "", probability: "M", impact: "M", mitigation: "" };
    case "issue":
      return { ...base, suggestionType: "issue", description: "", category: "", severity: "Medium", rootCause: "" };
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

function toCommittedRow(r: RowState): CommittedRow {
  switch (r.suggestionType) {
    case "requirement":
      return { suggestionId: r.suggestionId, suggestionType: "requirement", description: r.description, reqType: r.reqType, priority: r.priority, processRef: r.processRef, wasEdited: r.wasEdited };
    case "new_process":
      return { suggestionId: r.suggestionId, suggestionType: "new_process", tempKey: r.key, name: r.name, suggestedCode: r.suggestedCode, level: r.level, description: r.description, priority: r.priority, wasEdited: r.wasEdited };
    case "action_item":
      return { suggestionId: r.suggestionId, suggestionType: "action_item", title: r.title, priority: r.priority, dueDate: r.dueDate, wasEdited: r.wasEdited };
    case "risk":
      return { suggestionId: r.suggestionId, suggestionType: "risk", description: r.description, category: r.category, probability: r.probability, impact: r.impact, mitigation: r.mitigation, wasEdited: r.wasEdited };
    case "issue":
      return { suggestionId: r.suggestionId, suggestionType: "issue", description: r.description, category: r.category, severity: r.severity, rootCause: r.rootCause, wasEdited: r.wasEdited };
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
  }
}

function BatchCard({
  batch,
  projectId,
  processes,
  onCommitted,
}: {
  batch: SuggestionBatch;
  projectId: string;
  processes: ProcessOption[];
  onCommitted: () => void;
}) {
  const [rows, setRows] = useState<RowState[]>(() => batch.suggestions.map(toRowState));
  const [addType, setAddType] = useState<SuggestionType>("requirement");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(key: string, patch: Record<string, unknown>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? ({ ...r, ...patch, wasEdited: r.suggestionId ? true : r.wasEdited } as RowState) : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(addType)]);
  }

  async function handleProceed() {
    const approved = rows.filter((r) => r.checked).map(toCommittedRow);
    setPending(true);
    setError(null);
    const result = await commitSuggestionBatch(projectId, batch.meetingSourceId, batch.batchId, approved);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onCommitted();
  }

  const newProcessOptions = rows.filter(
    (r): r is Extract<RowState, { suggestionType: "new_process" }> => r.suggestionType === "new_process" && r.checked
  );

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">{batch.meetingSubject}</span>
        <span className="text-sm text-muted">{formatDateTime(batch.meetingStartTime)}</span>
      </div>
      {rows.map((r) => (
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
            <RowFields row={r} processes={processes} newProcessOptions={newProcessOptions} onChange={(patch) => updateRow(r.key, patch)} />
            {r.supportingQuote && (
              <div className="text-sm text-muted" style={{ marginTop: 8, fontStyle: "italic" }}>
                <i className="fa fa-quote-left" /> {r.supportingQuote}
              </div>
            )}
          </div>
        </div>
      ))}
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
  projectId,
  batches,
  processes,
}: {
  projectId: string;
  batches: SuggestionBatch[];
  processes: ProcessOption[];
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
          projectId={projectId}
          processes={processes}
          onCommitted={() => setCommitted((prev) => new Set(prev).add(batch.batchId))}
        />
      ))}
    </div>
  );
}
