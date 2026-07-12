import { formatDateTime } from "@/lib/ui-helpers";
import type { AuditLogEntry } from "@/lib/data/agent";

const ACTION_LABELS: Record<string, string> = {
  "connection.created": "Connected Microsoft account",
  "connection.revoked": "Disconnected Microsoft account",
  "meeting.linked": "Linked a meeting to this project",
  "suggestions.created": "Extracted suggestions from a transcript",
  "suggestions.batch_reviewed": "Reviewed a suggestion batch",
  "suggestion.redacted": "Redacted sensitive content in a transcript",
};

function describe(entry: AuditLogEntry): string {
  const d = entry.details ?? {};
  switch (entry.action) {
    case "connection.created":
      return typeof d.microsoft_email === "string" ? d.microsoft_email : "";
    case "meeting.linked":
      return typeof d.subject === "string" ? d.subject : "";
    case "suggestions.created":
      return `${d.count ?? "?"} suggestion(s)`;
    case "suggestions.batch_reviewed":
      return `${d.approved ?? "?"} approved`;
    case "suggestion.redacted":
      return `${d.redactions ?? "?"} pattern(s) — value never logged`;
    default:
      return Object.keys(d).length ? JSON.stringify(d) : "";
  }
}

export function AuditLogTable({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="empty-state text-sm">
        <p>No agent activity logged yet.</p>
      </div>
    );
  }

  return (
    <table className="table-auto">
      <thead>
        <tr>
          <th>When</th>
          <th>Actor</th>
          <th>Action</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id}>
            <td className="text-sm text-muted" style={{ whiteSpace: "nowrap" }}>
              {formatDateTime(e.createdAt)}
            </td>
            <td>
              {e.actorType === "agent" ? (
                <span className="badge badge-purple">
                  <i className="fa fa-robot" /> AI Agent
                </span>
              ) : (
                <span className="text-sm">{e.actorName ?? "Unknown user"}</span>
              )}
            </td>
            <td className="text-sm">{ACTION_LABELS[e.action] ?? e.action}</td>
            <td className="text-sm text-muted">{describe(e)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
