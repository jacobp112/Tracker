import { useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** viewBox geometry (Document 3 §5.2). */
const VB_W = 320;
const VB_H = 100;
const PAD_X = 8;
const PAD_TOP = 8;
const PAD_BOT = 92;
const RIGHT = 312;
/** Fixed scale so the goal line sits near the top rather than drifting. */
const V_MIN = 45;
const V_MAX = 85;

export interface SparkPoint {
  value: number;
  date: Date;
}

interface Pt {
  x: number;
  y: number;
  v: number;
  date: Date;
}

/**
 * Catmull-Rom → cubic bezier. A plain polyline reads as a chart; this reads as
 * a curve, which is the whole point of the hero (Document 3 §5.2).
 */
function smoothPath(pts: readonly Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(
      1,
    )},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * The hero's interactive retention sparkline (Document 3 §5.2):
 * gradient stroke, fade fill, dashed goal line, pulsing endpoint, and a
 * hover/touch crosshair with a value+date readout.
 */
export function Sparkline({
  data,
  goal,
  idPrefix = 'spark',
}: {
  data: readonly SparkPoint[];
  goal: number;
  idPrefix?: string;
}) {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Pt | null>(null);

  const { pts, line, fill, goalY } = useMemo(() => {
    const n = data.length;
    const x = (i: number) => (n <= 1 ? PAD_X : PAD_X + (i / (n - 1)) * (RIGHT - PAD_X));
    const y = (v: number) => PAD_TOP + (1 - (v - V_MIN) / (V_MAX - V_MIN)) * (PAD_BOT - PAD_TOP);

    const p: Pt[] = data.map((d, i) => ({ x: x(i), y: y(d.value), v: d.value, date: d.date }));
    const l = smoothPath(p);
    const f =
      p.length > 1
        ? `${l} L${p[p.length - 1]!.x.toFixed(1)},96 L${p[0]!.x.toFixed(1)},96 Z`
        : '';
    return { pts: p, line: l, fill: f, goalY: y(goal) };
  }, [data, goal]);

  const end = pts[pts.length - 1];

  const move = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || pts.length === 0) return;
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * VB_W;
    let idx = Math.round(((px - PAD_X) / (RIGHT - PAD_X)) * (pts.length - 1));
    idx = Math.max(0, Math.min(pts.length - 1, idx));
    setHover(pts[idx] ?? null);
  };

  // Readout is positioned in the wrapper's pixel space, from viewBox coords.
  const readout = (() => {
    if (!hover || !wrapRef.current) return null;
    const cr = wrapRef.current.getBoundingClientRect();
    return {
      left: (hover.x / VB_W) * cr.width,
      top: 18 + (hover.y / VB_H) * (cr.height - 18) - 8,
    };
  })();

  const lineId = `${idPrefix}-line`;
  const fillId = `${idPrefix}-fill`;

  return (
    <div className="hero-chart" ref={wrapRef}>
      <span className="goal-label">Goal {goal}%</span>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ cursor: 'crosshair' }}
        onMouseMove={(e) => move(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) move(t.clientX);
        }}
        onTouchEnd={() => setHover(null)}
        role="img"
        aria-label={`Average retention trend over the last ${data.length} days, currently ${
          end?.v ?? 0
        }%. Goal ${goal}%.`}
      >
        <defs>
          <linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1="0"
          x2={RIGHT}
          y1={goalY}
          y2={goalY}
          stroke="var(--border-strong)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />

        <path d={fill} fill={`url(#${fillId})`} stroke="none" />
        <path
          d={line}
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={reduced ? undefined : 'spark-draw'}
        />

        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1="4"
              y2="96"
              stroke="var(--accent)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle
              cx={hover.x}
              cy={hover.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="2.5"
            />
          </>
        )}

        {end && (
          <>
            <circle className="pulse-dot" cx={end.x} cy={end.y} r="4" fill="var(--accent)" opacity="0.5" />
            <circle
              cx={end.x}
              cy={end.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--accent-2)"
              strokeWidth="2.5"
            />
          </>
        )}
      </svg>

      {hover && readout && (
        <div className="spark-readout" style={{ left: readout.left, top: readout.top, opacity: 1 }}>
          <span className="ro-val">{hover.v}%</span>
          <span className="ro-date">
            {MONTH_NAMES[hover.date.getMonth()]} {hover.date.getDate()}
          </span>
        </div>
      )}
    </div>
  );
}
