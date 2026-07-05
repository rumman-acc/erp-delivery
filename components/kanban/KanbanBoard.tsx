"use client";

import { useState } from "react";
import type { KanbanColumn, TeamMember } from "@/lib/seed-data";
import type { IssueRow } from "@/lib/data/kanban";
import { avatarColor, avatarInitials, issueTypeMeta, priorityBadgeClass } from "@/lib/ui-helpers";
import { deleteIssue, updateIssueStatus } from "@/lib/actions/kanban";
import { CreateIssueModal } from "@/components/kanban/CreateIssueModal";
import { DeleteButton } from "@/components/ui/DeleteButton";

type Props = {
  projectId: string;
  columns: KanbanColumn[];
  issues: IssueRow[];
  team: TeamMember[];
  sprints: { id: string; name: string }[];
};

export function KanbanBoard({ projectId, columns, issues, team, sprints }: Props) {
  const [view, setView] = useState<"board" | "backlog" | "list">("board");
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order);

  function memberOf(id: string) {
    return team.find((t) => t.id === id);
  }

  async function handleStatusChange(issueId: string, statusColumnId: string) {
    const result = await updateIssueStatus(projectId, issueId, statusColumnId);
    if (result?.error) alert(result.error);
  }

  return (
    <>
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
        <div className="tab-bar" style={{ marginBottom: 0, border: "none" }}>
          {(["board", "backlog", "list"] as const).map((v) => (
            <div key={v} className={`tab-item${view === v ? " active" : ""}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </div>
          ))}
        </div>
        <CreateIssueModal projectId={projectId} columns={columns} team={team} sprints={sprints} />
      </div>

      {view === "board" && (
        <div className="kanban-board" style={{ padding: "16px" }}>
          {sortedColumns.map((col) => {
            const colIssues = issues.filter((i) => i.status === col.id);
            const overWip = col.wipLimit != null && colIssues.length > col.wipLimit;
            return (
              <div key={col.id} className={`kanban-col${overWip ? " wip-exceeded" : ""}`}>
                <div className="kanban-col-header">
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    <span className="rag-dot" style={{ background: col.color, marginRight: 6 }} />
                    {col.name} ({colIssues.length}
                    {col.wipLimit != null ? `/${col.wipLimit}` : ""})
                  </span>
                </div>
                <div className="kanban-col-body">
                  {colIssues.map((iss) => {
                    const meta = issueTypeMeta(iss.type);
                    const assignee = memberOf(iss.assignee);
                    return (
                      <div key={iss.dbId} className="kanban-card" style={{ borderLeftColor: meta.color }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div className="kanban-card-key">
                            <i className={`fa ${meta.icon}`} style={{ color: meta.color }} /> {iss.id}
                          </div>
                          <DeleteButton action={deleteIssue.bind(null, projectId, iss.dbId)} confirmText="Delete this issue?" />
                        </div>
                        <div className="kanban-card-title">{iss.title}</div>
                        <div className="kanban-card-footer">
                          <span className={priorityBadgeClass(iss.priority)}>{iss.priority}</span>
                          {assignee && (
                            <span
                              className="avatar"
                              style={{ background: avatarColor(assignee.name), color: "#fff", width: 22, height: 22, fontSize: 10 }}
                              title={assignee.name}
                            >
                              {avatarInitials(assignee.name)}
                            </span>
                          )}
                          <select
                            className="select"
                            style={{ marginLeft: "auto", width: "auto", fontSize: 11, padding: "2px 6px" }}
                            value={col.id}
                            onChange={(e) => handleStatusChange(iss.dbId, e.target.value)}
                          >
                            {sortedColumns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view !== "board" && (
        <div style={{ padding: 16, overflowY: "auto" }}>
          <table className="table-auto">
            <thead>
              <tr>
                <th>Key</th>
                <th>Type</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issues.map((iss) => {
                const meta = issueTypeMeta(iss.type);
                const assignee = memberOf(iss.assignee);
                const col = columns.find((c) => c.id === iss.status);
                return (
                  <tr key={iss.dbId}>
                    <td className="text-sm text-muted">{iss.id}</td>
                    <td>
                      <i className={`fa ${meta.icon}`} style={{ color: meta.color }} /> {iss.type}
                    </td>
                    <td>{iss.title}</td>
                    <td>
                      <span className={priorityBadgeClass(iss.priority)}>{iss.priority}</span>
                    </td>
                    <td>{col?.name ?? iss.status}</td>
                    <td className="text-sm text-muted">{assignee?.name ?? "—"}</td>
                    <td>
                      <DeleteButton action={deleteIssue.bind(null, projectId, iss.dbId)} confirmText="Delete this issue?" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
