import { formatDate } from "@/lib/format";

export function ScoreHistoryChart({
  points,
}: {
  points: { date: string; score: number }[];
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Re-analyze this repository later to start building a risk trend for
        this file.
      </p>
    );
  }

  const width = 480;
  const height = 120;
  const pad = 8;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - (p.score / 100) * (height - pad * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Risk score history">
        <line
          x1={pad}
          y1={height - pad - (70 / 100) * (height - pad * 2)}
          x2={width - pad}
          y2={height - pad - (70 / 100) * (height - pad * 2)}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <path d={path} fill="none" stroke="var(--brand-accent)" strokeWidth={2} />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3} fill="var(--brand-primary)" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(points[0].date)}</span>
        <span>{formatDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
