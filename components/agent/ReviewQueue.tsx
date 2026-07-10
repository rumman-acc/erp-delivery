"use client";

import { useState } from "react";
import { commitSuggestionBatch, type CommittedRow } from "@/lib/actions/suggestions";
import { formatDateTime } from "@/lib/ui-helpers";
import type { ProcessOption, SuggestionBatch, SuggestionRow } from "@/lib/data/agent";

type RowState = {
  key: string;
  suggestionId: string | null;
  description: string;
  type: string;
  priority: string;
  processId: string;
  checked: boolean;
  wasEdited: boolean;
  supportingQuote: string | null;
  confidence: SuggestionRow["confidence"];
};

const CONFIDENCE_BADGE: Record<string, string> = { high: "badge-success", medium: "badge-warning", low: "badge-neutral" };

function toRowState(s: SuggestionRow): RowState {
  return {
    key: s.id,
    suggestionId: s.id,
    description: s.description,
    type: s.type,
    priority: s.priority,
    processId: "",
    checked: false, // unchecked by default — plan-agentic.md §5 step 5
    wasEdited: false,
    supportingQuote: s.supportingQuote,
    confidence: s.confidence,
  };
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(key: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch, wasEdited: r.suggestionId ? true : r.wasEdited } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${crypto.randomUUID()}`,
        suggestionId: null,
        description: "",
        type: "Functional",
        priority: "Medium",
        processId: "",
        checked: true,
        wasEdited: false,
        supportingQuote: null,
        confidence: null,
      },
    ]);
  }

  async function handleProceed() {
    const checkedRows = rows.filter((r) => r.checked);
    const approved: CommittedRow[] = checkedRows.map((r) => ({
      suggestionId: r.suggestionId,
      description: r.description,
      type: r.type,
      priority: r.priority,
      processId: r.processId,
      wasEdited: r.wasEdited,
    }));

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

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">{batch.meetingSubject}</span>
        <span className="text-sm text-muted">{formatDateTime(batch.meetingStartTime)}</span>
      </div>
      <table className="table-auto">
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th>Description</th>
            <th style={{ width: 140 }}>Type</th>
            <th style={{ width: 110 }}>Priority</th>
            <th style={{ width: 160 }}>Process</th>
            <th style={{ width: 90 }}>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <input type="checkbox" checked={r.checked} onChange={(e) => updateRow(r.key, { checked: e.target.checked })} />
              </td>
              <td>
                <input
                  className="inline-edit"
                  value={r.description}
                  onChange={(e) => updateRow(r.key, { description: e.target.value })}
                />
                {r.supportingQuote && (
                  <div className="text-sm text-muted" style={{ marginTop: 2, fontStyle: "italic" }}>
                    <i className="fa fa-quote-left" /> {r.supportingQuote}
                  </div>
                )}
              </td>
              <td>
                <input className="inline-edit" value={r.type} onChange={(e) => updateRow(r.key, { type: e.target.value })} />
              </td>
              <td>
                <select className="select" value={r.priority} onChange={(e) => updateRow(r.key, { priority: e.target.value })}>
                  {["Critical", "High", "Medium", "Low"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select className="select" value={r.processId} onChange={(e) => updateRow(r.key, { processId: e.target.value })}>
                  <option value="">Pick process…</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {r.confidence ? (
                  <span className={`badge ${CONFIDENCE_BADGE[r.confidence]}`}>{r.confidence}</span>
                ) : (
                  <span className="badge badge-purple">new</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex-between" style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={addRow}>
          <i className="fa fa-plus" /> Add Row
        </button>
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
