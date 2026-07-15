import Link from "next/link";
import { formatDate } from "@/lib/ui-helpers";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { SettingsButton } from "@/components/shell/SettingsModal";
import { SignOutButton } from "@/components/shell/SignOutButton";
import type { ProjectConfig } from "@/lib/data/project";

export function Header({ project }: { project: ProjectConfig }) {
  return (
    <div id="header">
      <div className="header-project">
        <div className="header-project-name">
          {project.name}{" "}
          <Link href="/projects" className="icon-btn" title="Switch project" style={{ fontSize: 13 }}>
            <i className="fa fa-right-left" />
          </Link>
        </div>
        <div className="header-project-meta">
          <span>
            <i className="fa fa-building" /> {project.client}
          </span>
          <span>
            <i className="fa fa-server" /> {project.erp}
          </span>
          <span>
            <i className="fa fa-flag-checkered" /> Go-Live: {formatDate(project.goLive)}
          </span>
        </div>
      </div>
      <div className="header-actions">
        <ThemeToggle />
        <SettingsButton project={project} />
        <SignOutButton />
      </div>
    </div>
  );
}
