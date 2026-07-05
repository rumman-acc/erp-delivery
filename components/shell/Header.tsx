import { formatDate } from "@/lib/ui-helpers";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { SettingsButton } from "@/components/shell/SettingsModal";
import { SignOutButton } from "@/components/shell/SignOutButton";
import type { ProjectConfig } from "@/lib/data/project";
import type { OrgUnit, TeamMember } from "@/lib/seed-data";

export function Header({
  project,
  team,
  orgUnits,
}: {
  project: ProjectConfig;
  team: TeamMember[];
  orgUnits: OrgUnit[];
}) {
  return (
    <div id="header">
      <div className="header-project">
        <div className="header-project-name">{project.name}</div>
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
        <SettingsButton project={project} team={team} orgUnits={orgUnits} />
        <SignOutButton />
      </div>
    </div>
  );
}
