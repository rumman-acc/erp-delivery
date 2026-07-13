"use client";

import { useState } from "react";
import { linkMeeting } from "@/lib/actions/agent";
import { formatDateTime } from "@/lib/ui-helpers";
import type { MeetingsResult, MyMeeting } from "@/lib/data/agent";

function LinkButton({ projectId, meeting }: { projectId: string; meeting: MyMeeting }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("graph_event_id", meeting.graphEventId);
    formData.set("subject", meeting.subject);
    formData.set("organizer_email", meeting.organizerEmail);
    formData.set("start_time", meeting.start);
    formData.set("end_time", meeting.end);
    if (meeting.joinUrl) formData.set("join_url", meeting.joinUrl);
    const result = await linkMeeting(projectId, formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={handleClick} disabled={pending}>
        {pending ? "Linking…" : "Link to this project"}
      </button>
      {error && (
        <div className="text-sm" style={{ color: "var(--danger)", marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function MeetingsList({ projectId, result }: { projectId: string; result: MeetingsResult }) {
  if (result.status === "no_connection") {
    return (
      <div className="empty-state text-sm">
        <p>Connect your Microsoft account above to see your Teams meetings here.</p>
      </div>
    );
  }

  if (result.status === "needs_reconnect") {
    return (
      <div className="empty-state text-sm">
        <i className="fa fa-triangle-exclamation" style={{ color: "var(--warning)" }} />
        <p>Your Microsoft connection needs to be refreshed — disconnect and reconnect above.</p>
      </div>
    );
  }

  if (result.meetings.length === 0) {
    return (
      <div className="empty-state text-sm">
        <p>No finished Teams meetings found in the last 7 days.</p>
      </div>
    );
  }

  return (
    <table className="table-auto">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Organizer</th>
          <th>When</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {result.meetings.map((m) => (
          <tr key={m.graphEventId}>
            <td>{m.subject}</td>
            <td className="text-sm text-muted">{m.organizerEmail}</td>
            <td className="text-sm text-muted">{formatDateTime(m.start)}</td>
            <td>
              {m.linkedProjectId === null ? (
                <LinkButton projectId={projectId} meeting={m} />
              ) : m.linkedProjectId === projectId ? (
                <span className="badge badge-success">Linked to this project</span>
              ) : (
                <span className="badge badge-neutral">Linked to {m.linkedProjectName ?? "another project"}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
