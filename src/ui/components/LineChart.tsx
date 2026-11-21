import { useEffect, useRef, useState } from 'react';

export interface Point {
  x: number; // epoch ms
  y: number;
  breakBefore?: boolean;
}

export function LineChart({ points, yLabel, format = (n) => String(Math.round(n * 10) / 10), emptyMessage = 'No data yet — complete this exercise in a workout to see progress.' }: {
  points: Point[]; yLabel: string; format?: (n: number) => string; emptyMessage?: string;
}) {
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  const hasPoints = points.length > 0;
  useEffect(() => {
    const element = chart.current;
    if (!element) return;
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasPoints]);
  if (points.length === 0) return <p className="muted">{emptyMessage}</p>;
  const W = width, H = 260;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const pad = (maxY - minY) * 0.1;
  minY -= pad; maxY += pad;
  const ticks = [0, 0.5, 1].map((t) => minY + (maxY - minY) * t);
  const tickLabel = (n: number) => {
    const label = format(n);
    return label.length > 9 ? n.toExponential(2) : label;
  };
  const P = { l: Math.max(48, ...ticks.map((t) => tickLabel(t).length * 7 + 10)), r: 16, t: 16, b: 34 };
  const sx = (x: number) => P.l + (maxX === minX ? (W - P.l - P.r) / 2 : ((x - minX) / (maxX - minX)) * (W - P.l - P.r));
  const sy = (y: number) => H - P.b - ((y - minY) / (maxY - minY)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i && !p.breakBefore ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  const date = (x: number) => new Date(x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <svg ref={chart} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} over time, ${points.length} data points`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} style={{ stroke: 'var(--chart-grid)' }} />
          <text x={P.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--muted)' }}>{tickLabel(t)}</text>
        </g>
      ))}
      {minX === maxX ? (
        <text x={sx(minX)} y={H - 8} fontSize="11" style={{ fill: 'var(--muted)' }} textAnchor="middle">{date(minX)}</text>
      ) : (
        <>
          <text x={P.l} y={H - 8} fontSize="11" style={{ fill: 'var(--muted)' }}>{date(minX)}</text>
          <text x={W - P.r} y={H - 8} fontSize="11" style={{ fill: 'var(--muted)' }} textAnchor="end">{date(maxX)}</text>
        </>
      )}
      <path d={path} fill="none" strokeWidth="2.5" style={{ stroke: 'var(--chart-line)' }} />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="4" style={{ fill: 'var(--chart-line)' }}>
          <title>{`${date(p.x)}: ${format(p.y)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
