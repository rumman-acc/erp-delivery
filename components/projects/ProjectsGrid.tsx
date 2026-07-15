"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCurrentProject } from "@/lib/actions/projects";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import type { ProjectSummary, ProjectStats } from "@/lib/data/project";

export function ProjectsGrid({
  projects,
  stats,
  currentProjectId,
  isSuperAdmin,
}: {
  projects: ProjectSummary[];
  stats: ProjectStats[];
  currentProjectId: string;
  isSuperAdmin: boolean;
}) {
  const statsByProjectId = new Map(stats.map((s) => [s.projectId, s]));
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchTo(projectId: string) {
    if (projectId === currentProjectId) {
      router.push("/dashboard");
      return;
    }
    setPendingId(projectId);
    startTransition(async () => {
      await setCurrentProject(projectId);
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <>
      {isSuperAdmin && (
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <span className="text-sm text-muted">{projects.length} project(s)</span>
          <CreateProjectModal onCreated={(id) => switchTo(id)} />
        </div>
      )}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {projects.map((p) => {
          const isCurrent = p.id === currentProjectId;
          const s = statsByProjectId.get(p.id);
          return (
            <div
              key={p.id}
              className="kpi-card"
              onClick={() => switchTo(p.id)}
              style={{ borderColor: isCurrent ? "var(--accent)" : undefined, opacity: isPending && pendingId === p.id ? 0.6 : 1 }}
            >
              <div className="flex-between" style={{ marginBottom: 8 }}>
                <span className="kpi-label">{p.issuePrefix}</span>
                {isCurrent && <span className="badge badge-info">Current</span>}
              </div>
              <div className="kpi-value" style={{ fontSize: 16 }}>
                {p.name}
              </div>
              <div className="kpi-sub">
                <i className="fa fa-building" /> {p.client || "—"}
              </div>
              <div className="kpi-sub">
                <i className="fa fa-sack-dollar" /> ${p.budget.toLocaleString()}
              </div>
              {s && (
                <div className="kpi-sub">
                  <i className="fa fa-table-columns" /> {s.openIssues} open issues · {s.openRisks} open risks
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
