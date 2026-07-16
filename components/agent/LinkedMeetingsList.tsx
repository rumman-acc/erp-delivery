import { formatDateTime } from "@/lib/ui-helpers";
import type { LinkedMeeting } from "@/lib/data/agent";

const STATUS_BADGE: Record<LinkedMeeting["transcriptStatus"], string> = {
  pending: "badge-warning",
  fetched: "badge-success",
  unavailable: "badge-neutral",
  error: "badge-danger",
};

const STATUS_LABEL: Record<LinkedMeeting["transcriptStatus"], string> = {
  pending: "Waiting for transcript",
  fetched: "Transcript ready",
  unavailable: "No transcript",
  error: "Error",
};

export function LinkedMeetingsList({ meetings }: { meetings: LinkedMeeting[] }) {
  if (meetings.length === 0) {
    return (
      <div className="empty-state text-sm">
        <p>No meetings linked to any project yet — link one from &quot;Your Meetings&quot; above.</p>
      </div>
    );
  }

  return (
    <table className="table-auto">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Project</th>
          <th>When</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {meetings.map((m) => (
          <tr key={`${m.id}-${m.projectId}`}>
            <td>{m.subject}</td>
            <td className="text-sm text-muted">{m.projectName}</td>
            <td className="text-sm text-muted">{formatDateTime(m.startTime)}</td>
            <td>
              <span className={`badge ${STATUS_BADGE[m.transcriptStatus]}`}>{STATUS_LABEL[m.transcriptStatus]}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
