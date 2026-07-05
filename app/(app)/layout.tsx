import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { getCurrentProject } from "@/lib/data/project";
import { getSettingsData } from "@/lib/data/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const project = await getCurrentProject();

  if (!project) {
    return (
      <div className="auth-shell">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <i className="fa fa-lock" style={{ fontSize: 32, opacity: 0.4, marginBottom: 12 }} />
          <p>You&apos;re signed in, but not assigned to any project yet.</p>
          <p className="text-sm text-muted" style={{ marginTop: 8 }}>
            Ask a Super Admin to add you to a project.
          </p>
          <div style={{ marginTop: 16 }}>
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const { team, orgUnits } = await getSettingsData(project.id);

  return (
    <>
      <Sidebar />
      <div id="main">
        <Header project={project} team={team} orgUnits={orgUnits} />
        <div id="content">{children}</div>
      </div>
      <div id="toast-container" />
    </>
  );
}
