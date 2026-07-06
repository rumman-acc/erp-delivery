import { getCurrentProject } from "@/lib/data/project";
import { getMyConnection, getMyMeetings, getLinkedMeetings } from "@/lib/data/agent";
import { canViewModule } from "@/lib/permissions";
import { ConnectionCard } from "@/components/agent/ConnectionCard";
import { MeetingsList } from "@/components/agent/MeetingsList";
import { LinkedMeetingsList } from "@/components/agent/LinkedMeetingsList";

const ERROR_MESSAGES: Record<string, string> = {
  microsoft_denied: "Microsoft sign-in was cancelled or denied.",
  invalid_state: "That sign-in link expired or was already used — please try connecting again.",
  connection_failed: "Something went wrong finishing the connection. Please try again.",
};

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; agent_error?: string }>;
}) {
  const project = await getCurrentProject();
  if (!project) return null;

  const canView = await canViewModule(project.id, "agent");
  if (!canView) {
    return (
      <div className="page active" id="page-agent">
        <div className="empty-state">
          <i className="fa fa-lock" />
          <p>You don&apos;t have access to the AI Agent module on this project.</p>
        </div>
      </div>
    );
  }

  const [connection, meetingsResult, linkedMeetings, params] = await Promise.all([
    getMyConnection(),
    getMyMeetings(project.id),
    getLinkedMeetings(project.id),
    searchParams,
  ]);

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

      <ConnectionCard connection={connection} />

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa fa-calendar-days" /> Your Meetings
          </span>
        </div>
        <MeetingsList projectId={project.id} result={meetingsResult} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fa fa-link" /> Linked Meetings
          </span>
        </div>
        <LinkedMeetingsList meetings={linkedMeetings} />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fa fa-list-check" /> Review Queue
          </span>
        </div>
        <div className="empty-state text-sm">
          <p>Extracted suggestions from processed meetings will show up here for approval.</p>
        </div>
      </div>
    </div>
  );
}
