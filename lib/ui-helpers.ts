// Ported from the source app's App.UI helpers — same algorithms, so avatar
// colors/initials and badge mappings render identically to the source.

export function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
}

export function avatarInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
}

const AVATAR_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export function avatarColor(name: string | null | undefined): string {
  let hash = 0;
  for (const c of name || "") hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const PRIORITY_BADGE: Record<string, string> = { Critical: "danger", High: "warning", Medium: "info", Low: "neutral" };
export function priorityBadgeClass(p: string | null | undefined): string {
  return `badge badge-${PRIORITY_BADGE[p ?? ""] ?? "neutral"}`;
}

const STATUS_BADGE: Record<string, string> = {
  Open: "info",
  "In Progress": "warning",
  Resolved: "success",
  Closed: "neutral",
  Done: "success",
  Mitigated: "success",
  Accepted: "neutral",
};
export function statusBadgeClass(s: string | null | undefined): string {
  return `badge badge-${STATUS_BADGE[s ?? ""] ?? "neutral"}`;
}

const ISSUE_TYPE_META: Record<string, { icon: string; color: string }> = {
  Epic: { icon: "fa-bolt", color: "#8b5cf6" },
  Story: { icon: "fa-book-open", color: "#3b82f6" },
  Task: { icon: "fa-check-circle", color: "#10b981" },
  Bug: { icon: "fa-bug", color: "#ef4444" },
  "Sub-task": { icon: "fa-circle-dot", color: "#6366f1" },
};
export function issueTypeMeta(type: string) {
  return ISSUE_TYPE_META[type] ?? { icon: "fa-circle", color: "#6b7280" };
}

export function totalEffort(effortByRole: Record<string, number> | undefined): number {
  if (!effortByRole) return 0;
  return Object.values(effortByRole).reduce((a, b) => (a || 0) + (b || 0), 0);
}

const RAG_COLOR: Record<string, string> = { green: "#10b981", amber: "#f59e0b", red: "#ef4444", grey: "#94a3b8" };
export function ragColor(status: string): string {
  return RAG_COLOR[status] ?? "#94a3b8";
}

const SCORE_MAP: Record<string, number> = { H: 3, M: 2, L: 1 };
export function riskScore(probability: string, impact: string): number {
  return (SCORE_MAP[probability] ?? 1) * (SCORE_MAP[impact] ?? 1);
}

export function riskScoreClass(probability: string, impact: string): string {
  return `badge risk-score-${riskScore(probability, impact)}`;
}
