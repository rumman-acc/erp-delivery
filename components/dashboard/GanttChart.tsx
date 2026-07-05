import type { Phase } from "@/lib/seed-data";

// Ported from the source app's App.Pages.Dashboard.renderGantt() — same
// scaling math, rendered as JSX <rect>/<text> instead of a template string.
export function GanttChart({ phases }: { phases: Phase[] }) {
  if (!phases.length) {
    return (
      <div className="empty-state">
        <i className="fa fa-timeline" />
        <p>No phases defined</p>
      </div>
    );
  }

  const today = new Date();
  const allDates = phases.flatMap((p) => [new Date(p.start), new Date(p.end)]);
  const minD = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxD = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const totalDays = (maxD.getTime() - minD.getTime()) / (1000 * 86400) || 1;
  const W = 700;
  const rowH = 36;
  const paddingTop = 36;
  const svgH = paddingTop + phases.length * rowH + 10;
  const toX = (d: Date | string) => ((new Date(d).getTime() - minD.getTime()) / (1000 * 86400) / totalDays) * (W - 160);
  const todayX = Math.max(0, Math.min(W - 160, toX(today)));

  const monthLabels: { x: number; label: string }[] = [];
  const cur = new Date(minD);
  cur.setDate(1);
  while (cur <= maxD) {
    monthLabels.push({
      x: toX(cur) + 160,
      label: cur.toLocaleDateString("en", { month: "short", year: "2-digit" }),
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  const todayLineX = todayX + 160;

  return (
    <svg className="gantt-svg" width="100%" viewBox={`0 0 ${W} ${svgH}`} style={{ minWidth: 600 }}>
      {monthLabels.map((m, i) => (
        <text key={i} x={m.x} y={16} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
          {m.label}
        </text>
      ))}
      <line x1={160} y1={paddingTop} x2={W} y2={paddingTop} stroke="var(--border)" strokeWidth={0.5} />
      {phases.map((ph, i) => {
        const y = paddingTop + i * rowH;
        const x1 = toX(ph.start) + 160;
        const x2 = toX(ph.end) + 160;
        const bw = Math.max(x2 - x1, 4);
        const fillW = bw * (ph.progress / 100);
        return (
          <g key={ph.id}>
            <text x={150} y={y + 22} fontSize={11} fill="var(--text-muted)" textAnchor="end" dominantBaseline="middle">
              {ph.name}
            </text>
            <rect x={x1} y={y + 6} width={bw} height={24} rx={4} fill={`${ph.color}33`} stroke={ph.color} strokeWidth={1} />
            <rect x={x1} y={y + 6} width={fillW} height={24} rx={4} fill={ph.color} opacity={0.7} />
            <text x={x1 + bw / 2} y={y + 20} fontSize={10} fill="var(--text)" textAnchor="middle">
              {ph.progress}%
            </text>
          </g>
        );
      })}
      <line x1={todayLineX} y1={paddingTop} x2={todayLineX} y2={svgH - 10} stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="4,3" />
      <text x={todayLineX + 3} y={paddingTop - 2} fontSize={9} fill="var(--danger)">
        Today
      </text>
    </svg>
  );
}
