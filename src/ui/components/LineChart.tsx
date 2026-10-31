export interface Point {
  x: number; // epoch ms
  y: number;
}

export function LineChart({ points, yLabel, format = (n) => String(Math.round(n * 10) / 10) }: {
  points: Point[]; yLabel: string; format?: (n: number) => string;
}) {
  if (points.length === 0) return <p className="muted">No data yet — complete this exercise in a workout to see progress.</p>;
  const W = 600, H = 260, P = { l: 48, r: 16, t: 16, b: 34 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const pad = (maxY - minY) * 0.1;
  minY -= pad; maxY += pad;
  const sx = (x: number) => P.l + (maxX === minX ? (W - P.l - P.r) / 2 : ((x - minX) / (maxX - minX)) * (W - P.l - P.r));
  const sy = (y: number) => H - P.b - ((y - minY) / (maxY - minY)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const ticks = [0, 0.5, 1].map((t) => minY + (maxY - minY) * t);
  const date = (x: number) => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} over time, ${points.length} data points`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} style={{ stroke: 'var(--chart-grid)' }} />
          <text x={P.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--muted)' }}>{format(t)}</text>
        </g>
      ))}
      <text x={P.l} y={H - 8} fontSize="11" style={{ fill: 'var(--muted)' }}>{date(minX)}</text>
      <text x={W - P.r} y={H - 8} fontSize="11" style={{ fill: 'var(--muted)' }} textAnchor="end">{date(maxX)}</text>
      <path d={path} fill="none" strokeWidth="2.5" style={{ stroke: 'var(--chart-line)' }} />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" style={{ fill: 'var(--chart-line)' }}>
          <title>{`${date(p.x)}: ${format(p.y)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
