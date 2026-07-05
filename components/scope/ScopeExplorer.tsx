"use client";

import { useMemo, useState } from "react";
import type { ProcessNodeRow, DataElementRow } from "@/lib/data/scope";
import { updateDataElement, updateProcess } from "@/lib/actions/scope";

type Props = { projectId: string; processes: ProcessNodeRow[]; dataElements: DataElementRow[] };

const DETAIL_TABS = ["overview", "orgUnits", "requirements", "dependencies", "kanban"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

const TAB_LABEL: Record<DetailTab, string> = {
  overview: "Overview",
  orgUnits: "Org Units",
  requirements: "Requirements",
  dependencies: "Dependencies",
  kanban: "Kanban",
};

export function ScopeExplorer({ projectId, processes, dataElements }: Props) {
  const [view, setView] = useState<"processes" | "dataElements">("processes");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ FI: true });
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>("FI.1.1");
  const [selectedDeId, setSelectedDeId] = useState<string | null>(dataElements[0]?.id ?? null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [query, setQuery] = useState("");

  const byParent = useMemo(() => {
    const map: Record<string, ProcessNodeRow[]> = {};
    for (const p of processes) {
      const key = p.parent ?? "__root__";
      (map[key] ??= []).push(p);
    }
    return map;
  }, [processes]);

  const selectedProcess = processes.find((p) => p.id === selectedProcessId) ?? null;
  const selectedDe = dataElements.find((d) => d.id === selectedDeId) ?? null;

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function breadcrumb(node: ProcessNodeRow): string {
    const parts: string[] = [node.name];
    let cur = node;
    while (cur.parent) {
      const parent = processes.find((p) => p.id === cur.parent);
      if (!parent) break;
      parts.unshift(parent.name);
      cur = parent;
    }
    return parts.join(" / ");
  }

  function renderNode(node: ProcessNodeRow): React.ReactNode {
    const children = byParent[node.id] ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = !!expanded[node.id];
    const matches = query === "" || node.name.toLowerCase().includes(query.toLowerCase());
    return (
      <div key={node.id}>
        {matches && (
          <div
            className={`tree-node tree-l${node.level}${selectedProcessId === node.id ? " selected" : ""}`}
            style={{ paddingLeft: 12 + (node.level - 1) * 16 }}
            onClick={() => {
              setSelectedProcessId(node.id);
              setDetailTab("overview");
            }}
          >
            <span
              className="tree-node-toggle"
              onClick={(e) => {
                e.stopPropagation();
                if (hasChildren) toggle(node.id);
              }}
            >
              {hasChildren ? <i className={`fa fa-caret-${isExpanded ? "down" : "right"}`} /> : ""}
            </span>
            <span className="tree-node-name">{node.name}</span>
            {!node.inscope && <span className="badge badge-neutral">Out</span>}
          </div>
        )}
        {hasChildren && isExpanded && children.map((c) => renderNode(c))}
      </div>
    );
  }

  const roots = byParent["__root__"] ?? [];
  const total = processes.length;
  const inScopeCount = processes.filter((p) => p.inscope).length;

  return (
    <div className="scope-layout">
      <div className="scope-tree-panel">
        <div className="tree-toolbar">
          <div className="tab-bar" style={{ marginBottom: 0, border: "none" }}>
            <div className={`tab-item${view === "processes" ? " active" : ""}`} onClick={() => setView("processes")}>
              Processes
            </div>
            <div className={`tab-item${view === "dataElements" ? " active" : ""}`} onClick={() => setView("dataElements")}>
              Data Elements
            </div>
          </div>
          {view === "processes" && (
            <input
              className="input"
              placeholder="Search processes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </div>
        <div className="tree-body">
          {view === "processes"
            ? roots.map((r) => renderNode(r))
            : dataElements.map((de) => (
                <div
                  key={de.id}
                  className={`de-item${selectedDeId === de.id ? " selected" : ""}`}
                  onClick={() => {
                    setSelectedDeId(de.id);
                    setDetailTab("overview");
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{de.name}</div>
                  <div className="text-sm text-muted">
                    {de.category} · {de.volume}
                  </div>
                </div>
              ))}
        </div>
        {view === "processes" && (
          <div className="scope-summary">
            <span>{total} processes</span>
            <span>{inScopeCount} in scope</span>
          </div>
        )}
      </div>

      <div className="scope-detail-panel">
        {view === "processes" ? (
          selectedProcess ? (
            <ProcessDetail
              projectId={projectId}
              node={selectedProcess}
              breadcrumb={breadcrumb(selectedProcess)}
              tab={detailTab}
              onTab={setDetailTab}
            />
          ) : (
            <div className="empty-state">
              <i className="fa fa-sitemap" />
              <p>Select a process to view details</p>
            </div>
          )
        ) : selectedDe ? (
          <DataElementDetail projectId={projectId} de={selectedDe} tab={detailTab} onTab={setDetailTab} />
        ) : (
          <div className="empty-state">
            <i className="fa fa-database" />
            <p>Select a data element to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailTabs({ tab, onTab }: { tab: DetailTab; onTab: (t: DetailTab) => void }) {
  return (
    <div className="tab-bar">
      {DETAIL_TABS.map((t) => (
        <div key={t} className={`tab-item${tab === t ? " active" : ""}`} onClick={() => onTab(t)}>
          {TAB_LABEL[t]}
        </div>
      ))}
    </div>
  );
}

function ProcessDetail({
  projectId,
  node,
  breadcrumb,
  tab,
  onTab,
}: {
  projectId: string;
  node: ProcessNodeRow;
  breadcrumb: string;
  tab: DetailTab;
  onTab: (t: DetailTab) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateProcess(projectId, node.dbId, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div>
      <div className="text-sm text-muted" style={{ marginBottom: 4 }}>
        {breadcrumb}
      </div>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{node.name}</h2>
      <DetailTabs tab={tab} onTab={onTab} />
      {tab === "overview" && (
        <form key={node.dbId} action={handleSave} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" name="description" defaultValue={node.description} />
          </div>
          <div className="form-group">
            <label className="label">Notes</label>
            <textarea className="textarea" name="notes" defaultValue={node.notes} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Priority</label>
              <select className="select" name="priority" defaultValue={node.priority}>
                <option value="H">High</option>
                <option value="M">Medium</option>
                <option value="L">Low</option>
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 20 }}>
              <input type="checkbox" name="in_scope" defaultChecked={node.inscope} /> In Scope
            </label>
          </div>
          {error && (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              <i className="fa fa-save" /> {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
      {tab === "orgUnits" && (
        <div className="card">
          {node.orgUnits.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No org units linked</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {node.orgUnits.map((ou) => (
                <span key={ou} className="chip">
                  {ou}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {tab === "requirements" && (
        <div className="card">
          {node.requirements.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No requirements captured</p>
            </div>
          ) : (
            <table className="table-auto">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {node.requirements.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.desc}</td>
                    <td>{r.type}</td>
                    <td>{r.priority}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "dependencies" && (
        <div className="card">
          <div className="empty-state text-sm">
            <p>{node.processDeps.length + node.dataDeps.length === 0 ? "No dependencies" : `${node.processDeps.length} process, ${node.dataDeps.length} data dependencies`}</p>
          </div>
        </div>
      )}
      {tab === "kanban" && (
        <div className="card">
          {node.kanbanLinks.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No linked kanban issues</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {node.kanbanLinks.map((k) => (
                <span key={k} className="chip">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataElementDetail({
  projectId,
  de,
  tab,
  onTab,
}: {
  projectId: string;
  de: DataElementRow;
  tab: DetailTab;
  onTab: (t: DetailTab) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateDataElement(projectId, de.dbId, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div>
      <div className="text-sm text-muted" style={{ marginBottom: 4 }}>
        {de.category}
      </div>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>{de.name}</h2>
      <DetailTabs tab={tab} onTab={onTab} />
      {tab === "overview" && (
        <form key={de.dbId} action={handleSave} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" name="description" defaultValue={de.description} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Source</label>
              <input className="input" name="source" defaultValue={de.source} />
            </div>
            <div className="form-group">
              <label className="label">Target</label>
              <input className="input" name="target" defaultValue={de.target} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Volume</label>
              <input className="input" name="volume" defaultValue={de.volume} />
            </div>
            <div className="form-group">
              <label className="label">Complexity</label>
              <select className="select" name="complexity" defaultValue={de.complexity}>
                <option value="H">High</option>
                <option value="M">Medium</option>
                <option value="L">Low</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-muted">Owner: {de.owner || "—"}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" name="in_scope" defaultChecked={de.inscope} /> In Scope
          </label>
          {error && (
            <div className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              <i className="fa fa-save" /> {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
      {tab === "orgUnits" && (
        <div className="card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {de.orgUnits.map((ou) => (
              <span key={ou} className="chip">
                {ou}
              </span>
            ))}
          </div>
        </div>
      )}
      {tab === "requirements" && (
        <div className="card">
          {de.requirements.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No requirements captured</p>
            </div>
          ) : (
            <table className="table-auto">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {de.requirements.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.desc}</td>
                    <td>{r.type}</td>
                    <td>{r.priority}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "dependencies" && (
        <div className="card">
          {de.linkedProcesses.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No linked processes</p>
            </div>
          ) : (
            <table className="table-auto">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Direction</th>
                </tr>
              </thead>
              <tbody>
                {de.linkedProcesses.map((lp) => (
                  <tr key={lp.pid}>
                    <td>{lp.pid}</td>
                    <td>{lp.direction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {tab === "kanban" && (
        <div className="card">
          {de.kanbanLinks.length === 0 ? (
            <div className="empty-state text-sm">
              <p>No linked kanban issues</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {de.kanbanLinks.map((k) => (
                <span key={k} className="chip">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
