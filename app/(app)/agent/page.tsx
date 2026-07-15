import { getMyProjects } from "@/lib/data/project";
import {
  getMyConnection,
  getMyMeetings,
  getLinkedMeetings,
  getPendingSuggestionBatches,
  getProjectProcessesMap,
  getAgentAuditLog,
} from "@/lib/data/agent";
import { canViewAgentAnyProject, canViewModule, canEditModule, getIsSuperAdmin } from "@/lib/permissions";
import { ConnectionCard } from "@/components/agent/ConnectionCard";
import { MeetingsList } from "@/components/agent/MeetingsList";
import { LinkedMeetingsList } from "@/components/agent/LinkedMeetingsList";
import { ReviewQueue } from "@/components/agent/ReviewQueue";
import { AuditLogTable } from "@/components/agent/AuditLogTable";
import { AutoPollTrigger } from "@/components/agent/AutoPollTrigger";

const ERROR_MESSAGES: Record<string, string> = {
  microsoft_denied: "Microsoft sign-in was cancelled or denied.",
  invalid_state: "That sign-in link expired or was already used — please try connecting again.",
  connection_failed: "Something went wrong finishing the connection. Please try again.",
};

// AI Agent is a global page, not scoped to whichever project happens to be
// "current" — a standup can be about any project, and an admin reviewing
// suggestions shouldn't have to switch projects to see what's pending
// elsewhere. Every list here spans every project the caller can access.
export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; agent_error?: string }>;
}) {
  const canView = await canViewAgentAnyProject();
  if (!canView) {
    return (
      <div className="page active" id="page-agent">
        <div className="empty-state">
          <i className="fa fa-lock" />
          <p>You don&apos;t have access to the AI Agent module on any project.</p>
        </div>
      </div>
    );
  }

  // getMyProjects() only reflects project membership, not per-module
  // permission — a project's own module matrix can still deny 'agent' view
  // to a given role (same as any other module), so filter down to the
  // projects this caller can actually see agent data for before fetching
  // anything scoped to them.
  const allProjects = await getMyProjects();
  const viewFlags = await Promise.all(allProjects.map((p) => canViewModule(p.id, "agent")));
  const viewableProjects = allProjects.filter((_, i) => viewFlags[i]);
  const projectIds = viewableProjects.map((p) => p.id);

  const editFlags = await Promise.all(viewableProjects.map((p) => canEditModule(p.id, "agent")));
  const editableProjects = viewableProjects.filter((_, i) => editFlags[i]);

  const [connection, meetingsResult, linkedMeetings, suggestionBatches, processesMap, isSuperAdmin, params] = await Promise.all([
    getMyConnection(),
    getMyMeetings(),
    getLinkedMeetings(projectIds),
    getPendingSuggestionBatches(projectIds),
    getProjectProcessesMap(projectIds),
    getIsSuperAdmin(),
    searchParams,
  ]);

  // RLS restricts the audit log to Super Admin anyway, but skip the round
  // trip for everyone else rather than firing a query that just comes back empty.
  const auditLog = isSuperAdmin ? await getAgentAuditLog(projectIds) : [];

  return (
    <div className="page active" id="page-agent">
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>
        <i className="fa fa-robot" /> AI Agent
      </h2>

      {params.connected === "1" && (
        <div className="toast toast-success show" style={{ position: "static", transform: "none", marginBottom: 16, display: "flex" }}>
          <i className="fa fa-check-circle" /> Microsoft account connected.
        </div>
      )}
      {params.agent_error && (
        <div className="toast toast-error show" style={{ position: "static", transform: "none", marginBottom: 16, display: "flex" }}>
          <i className="fa fa-circle-xmark" /> {ERROR_MESSAGES[params.agent_error] ?? "Something went wrong."}
        </div>
      )}

      <AutoPollTrigger
        canEdit={editableProjects.length > 0}
        hasPendingMeetings={linkedMeetings.some((m) => m.transcriptStatus === "pending")}
      />

      <ConnectionCard connection={connection} />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa fa-calendar-days" /> Your Meetings
          </span>
        </div>
        <MeetingsList projects={editableProjects} result={meetingsResult} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa fa-link" /> Linked Meetings
          </span>
        </div>
        <LinkedMeetingsList meetings={linkedMeetings} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          <i className="fa fa-list-check" /> Review Queue
        </h3>
        <ReviewQueue batches={suggestionBatches} processesMap={processesMap} />
      </div>

      {isSuperAdmin && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <i className="fa fa-shield-halved" /> Audit Log
            </span>
          </div>
          <AuditLogTable entries={auditLog} />
        </div>
      )}
    </div>
  );
}
