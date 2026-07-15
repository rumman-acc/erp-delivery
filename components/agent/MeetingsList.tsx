"use client";

import { useState } from "react";
import { linkMeeting } from "@/lib/actions/agent";
import { formatDateTime } from "@/lib/ui-helpers";
import type { MeetingsResult, MyMeeting } from "@/lib/data/agent";
import type { ProjectSummary } from "@/lib/data/project";

function LinkPicker({ projects, meeting }: { projects: ProjectSummary[]; meeting: MyMeeting }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleClick() {
    if (selected.size === 0) {
      setError("Pick at least one project");
      return;
    }
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set("graph_event_id", meeting.graphEventId);
    formData.set("subject", meeting.subject);
    formData.set("organizer_email", meeting.organizerEmail);
    formData.set("start_time", meeting.start);
    formData.set("end_time", meeting.end);
    if (meeting.joinUrl) formData.set("join_url", meeting.joinUrl);
    const result = await linkMeeting([...selected], formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  if (projects.length === 0) {
    return <span className="text-sm text-muted">No project you can edit</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 320 }}>
        {projects.map((p) => (
          <label key={p.id} className="text-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleClick} disabled={pending}>
          {pending ? "Linking…" : "Link"}
        </button>
        {error && (
          <span className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

export function MeetingsList({ projects, result }: { projects: ProjectSummary[]; result: MeetingsResult }) {
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
          <th>Projects — check all that apply (e.g. a shared standup)</th>
        </tr>
      </thead>
      <tbody>
        {result.meetings.map((m) => (
          <tr key={m.graphEventId}>
            <td>{m.subject}</td>
            <td className="text-sm text-muted">{m.organizerEmail}</td>
            <td className="text-sm text-muted">{formatDateTime(m.start)}</td>
            <td>
              {m.linkedProjects.length === 0 ? (
                <LinkPicker projects={projects} meeting={m} />
              ) : (
                <span className="badge badge-success">Linked to {m.linkedProjects.map((p) => p.name).join(", ")}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
