"use client";

import { useState } from "react";
import { disconnectMicrosoft } from "@/lib/actions/agent";
import { formatDate } from "@/lib/ui-helpers";
import type { AgentConnection } from "@/lib/data/agent";

export function ConnectionCard({ connection }: { connection: AgentConnection | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    if (!confirm("Disconnect your Microsoft account? Linked meetings already processed are unaffected, but no new meetings can be linked until you reconnect.")) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await disconnectMicrosoft();
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <span className="card-title">
          <i className="fa-brands fa-microsoft" /> Microsoft Account
        </span>
      </div>
      {connection ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              <span className="badge badge-success" style={{ marginRight: 8 }}>
                Connected
              </span>
              {connection.microsoftEmail}
            </div>
            <div className="text-sm text-muted" style={{ marginTop: 4 }}>
              Connected on {formatDate(connection.connectedAt)}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleDisconnect} disabled={pending}>
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p className="text-sm text-muted">
            Connect your Microsoft account to link Teams meetings to this project. Only your own calendar and meeting
            transcripts are accessed — nothing tenant-wide.
          </p>
          <a className="btn btn-primary btn-sm" href="/api/integrations/microsoft/connect" style={{ whiteSpace: "nowrap" }}>
            <i className="fa-brands fa-microsoft" /> Connect Microsoft Account
          </a>
        </div>
      )}
      {error && (
        <div className="text-sm" style={{ color: "var(--danger)", marginTop: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}
