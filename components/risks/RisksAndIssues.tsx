"use client";

import { useState } from "react";
import type { RiskRow, IssueLogRow } from "@/lib/data/risks";
import type { TeamOption } from "@/lib/data/team";
import { riskScore, riskScoreClass, statusBadgeClass } from "@/lib/ui-helpers";
import { deleteIssueLog, deleteRisk } from "@/lib/actions/risks";
import { RiskModal } from "@/components/risks/RiskModal";
import { IssueLogModal } from "@/components/risks/IssueLogModal";
import { DeleteButton } from "@/components/ui/DeleteButton";

export function RisksAndIssues({
  projectId,
  team,
  risks,
  issuesLog,
}: {
  projectId: string;
  team: TeamOption[];
  risks: RiskRow[];
  issuesLog: IssueLogRow[];
}) {
  const [tab, setTab] = useState<"risks" | "issues">("risks");

  return (
    <div>
      <div className="tab-bar">
        <div className={`tab-item${tab === "risks" ? " active" : ""}`} onClick={() => setTab("risks")}>
          Risks ({risks.length})
        </div>
        <div className={`tab-item${tab === "issues" ? " active" : ""}`} onClick={() => setTab("issues")}>
          Issues Log ({issuesLog.length})
        </div>
      </div>

      {tab === "risks" ? (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa fa-triangle-exclamation" /> Risk Register
            </span>
            <RiskModal
              projectId={projectId}
              team={team}
              trigger={
                <button className="btn btn-secondary btn-sm">
                  <i className="fa fa-plus" /> Add Risk
                </button>
              }
            />
          </div>
          <table className="table-auto">
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Category</th>
                <th>Probability</th>
                <th>Impact</th>
                <th>Score</th>
                <th>Owner</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {risks.map((r) => (
                <tr key={r.dbId}>
                  <td className="text-sm text-muted">{r.id}</td>
                  <td style={{ maxWidth: 320 }}>{r.description}</td>
                  <td>{r.category}</td>
                  <td>{r.probability}</td>
                  <td>{r.impact}</td>
                  <td>
                    <span className={riskScoreClass(r.probability, r.impact)}>{riskScore(r.probability, r.impact)}</span>
                  </td>
                  <td className="text-sm text-muted">{r.owner}</td>
                  <td>
                    <span className={statusBadgeClass(r.status)}>{r.status}</span>
                  </td>
                  <td className="row-actions" style={{ display: "flex", gap: 4 }}>
                    <RiskModal
                      projectId={projectId}
                      team={team}
                      risk={r}
                      trigger={
                        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                          <i className="fa fa-pen" />
                        </button>
                      }
                    />
                    <DeleteButton action={deleteRisk.bind(null, projectId, r.dbId)} confirmText="Delete this risk?" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa fa-list-check" /> Issues Log
            </span>
            <IssueLogModal
              projectId={projectId}
              team={team}
              trigger={
                <button className="btn btn-secondary btn-sm">
                  <i className="fa fa-plus" /> Add Issue
                </button>
              }
            />
          </div>
          <table className="table-auto">
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {issuesLog.map((i) => (
                <tr key={i.dbId}>
                  <td className="text-sm text-muted">{i.id}</td>
                  <td style={{ maxWidth: 320 }}>{i.description}</td>
                  <td>{i.category}</td>
                  <td>{i.severity}</td>
                  <td className="text-sm text-muted">{i.owner}</td>
                  <td className="text-sm text-muted">{i.due}</td>
                  <td>
                    <span className={statusBadgeClass(i.status)}>{i.status}</span>
                  </td>
                  <td className="row-actions" style={{ display: "flex", gap: 4 }}>
                    <IssueLogModal
                      projectId={projectId}
                      team={team}
                      entry={i}
                      trigger={
                        <button className="icon-btn" style={{ width: 24, height: 24, fontSize: 11 }} title="Edit">
                          <i className="fa fa-pen" />
                        </button>
                      }
                    />
                    <DeleteButton action={deleteIssueLog.bind(null, projectId, i.dbId)} confirmText="Delete this issue?" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
