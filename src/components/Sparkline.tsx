import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Insets in CSS pixels from the edges of the rendered box (Document 3 §5.2). */
const PAD_X = 8;
const PAD_TOP = 8;
const PAD_BOT = 8;
const BASELINE_INSET = 4;

/**
 * Minimum value window. The domain only ever grows outward from this, so the
 * goal line keeps its place near the top instead of drifting with the data —
 * but points outside the window still render inside the box.
 */
const DOMAIN_MIN = 45;
const DOMAIN_MAX = 85;

/** Fallback box used for the first paint, before the ResizeObserver reports. */
const FALLBACK_W = 320;
const FALLBACK_H = 100;

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
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(
      1,
    )} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Measures the wrapper so the SVG can draw in 1:1 pixel space. */
function useBoxSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: FALLBACK_W, h: FALLBACK_H });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      setSize((prev) => {
        const w = Math.max(1, Math.round(box.width));
        const h = Math.max(1, Math.round(box.height));
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

/**
 * The hero's interactive retention sparkline (Document 3 §5.2):
 * gradient stroke, fade fill, dashed goal line, pulsing endpoint, and a
 * pointer/keyboard crosshair with a value+date readout.
 */
export function Sparkline({
  data,
  goal,
  idPrefix,
  label = 'Average retention',
  locale,
}: {
  data: readonly SparkPoint[];
  goal: number;
  /** Optional stable id for the gradients. Defaults to a React-generated one. */
  idPrefix?: string;
  /** What the series measures — used in the accessible description. */
  label?: string;
  /** Overrides the runtime locale for the date readout. */
  locale?: string;
}) {
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const autoId = useId().replace(/:/g, '');
  const prefix = idPrefix ?? `spark-${autoId}`;
  const lineId = `${prefix}-line`;
  const fillId = `${prefix}-fill`;

  const { w, h } = useBoxSize(wrapRef);

  /** Index rather than the point itself, so redundant moves don't re-render. */
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    [locale],
  );

  const { pts, line, fill, goalY } = useMemo(() => {
    const right = Math.max(PAD_X + 1, w - PAD_X);
    const bottom = Math.max(PAD_TOP + 1, h - PAD_BOT);

    // Grow the fixed window to fit anything that escapes it.
    let lo = DOMAIN_MIN;
    let hi = DOMAIN_MAX;
    for (const d of data) {
      if (d.value < lo) lo = d.value;
      if (d.value > hi) hi = d.value;
    }
    lo = Math.min(lo, goal);
    hi = Math.max(hi, goal);
    const span = hi - lo || 1;

    const n = data.length;
    const x = (i: number) => (n <= 1 ? PAD_X : PAD_X + (i / (n - 1)) * (right - PAD_X));
    const y = (v: number) => PAD_TOP + (1 - (v - lo) / span) * (bottom - PAD_TOP);

    const p: Pt[] = data.map((d, i) => ({ x: x(i), y: y(d.value), v: d.value, date: d.date }));
    const l = smoothPath(p);
    const base = h - BASELINE_INSET;
    const f =
      p.length > 1
        ? `${l} L${p[p.length - 1]!.x.toFixed(1)},${base} L${p[0]!.x.toFixed(1)},${base} Z`
        : '';

    return { pts: p, line: l, fill: f, goalY: y(goal) };
  }, [data, goal, w, h]);

  const end = pts[pts.length - 1];
  const active = activeIdx == null ? null : (pts[activeIdx] ?? null);

  const pick = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || pts.length === 0) return;

      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const r = svg.getBoundingClientRect();
        if (r.width === 0) return;
        const px = clientX - r.left;
        const right = Math.max(PAD_X + 1, r.width - PAD_X);
        const raw = Math.round(((px - PAD_X) / (right - PAD_X)) * (pts.length - 1));
        const idx = Math.max(0, Math.min(pts.length - 1, raw));
        setActiveIdx((prev) => (prev === idx ? prev : idx));
      });
    },
    [pts.length],
  );

  const clear = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setActiveIdx(null);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Drop the crosshair if the series shrinks underneath it.
  useEffect(() => {
    setActiveIdx((prev) => (prev != null && prev >= pts.length ? null : prev));
  }, [pts.length]);

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => pick(e.clientX);

  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (pts.length === 0) return;
    const last = pts.length - 1;
    const from = activeIdx ?? last;
    let next: number | null = null;

    if (e.key === 'ArrowLeft') next = Math.max(0, from - 1);
    else if (e.key === 'ArrowRight') next = Math.min(last, from + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') {
      clear();
      return;
    } else return;

    e.preventDefault();
    setActiveIdx(next);
  };

  if (data.length === 0) {
    return (
      <div className="hero-chart hero-chart--empty" ref={wrapRef}>
        <span className="goal-label">Goal {goal}%</span>
        <p className="spark-empty">No readings yet. Data appears after the first sync.</p>
      </div>
    );
  }

  const describe = (p: Pt) => `${formatValue(p.v)}% on ${dateFmt.format(p.date)}`;

  return (
    <div className="hero-chart" ref={wrapRef}>
      <span className="goal-label">Goal {goal}%</span>

      <svg
        ref={svgRef}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
        tabIndex={0}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onKeyDown={onKeyDown}
        onFocus={() => setActiveIdx((prev) => prev ?? pts.length - 1)}
        onBlur={clear}
        role="img"
        aria-label={`${label} over the last ${data.length} days, currently ${formatValue(
          end?.v ?? 0,
        )}%. Goal ${goal}%. Use the arrow keys to read individual days.`}
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
          x1={PAD_X}
          x2={w - PAD_X}
          y1={goalY}
          y2={goalY}
          stroke="var(--border-strong)"
          strokeWidth="1"
          strokeDasharray="3 4"
        />

        {fill && <path d={fill} fill={`url(#${fillId})`} stroke="none" />}
        {line && (
          <path
            // Restarts the draw-on animation when the series changes.
            key={reduced ? 'static' : `${data.length}-${w}`}
            d={line}
            fill="none"
            stroke={`url(#${lineId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={reduced ? undefined : 'spark-draw'}
          />
        )}

        {active && (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={BASELINE_INSET}
              y2={h - BASELINE_INSET}
              stroke="var(--accent)"
              strokeWidth="1"
              opacity="0.5"
            />
            <circle
              cx={active.x}
              cy={active.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="2.5"
            />
          </>
        )}

        {end && (
          <>
            {!reduced && (
              <circle
                className="pulse-dot"
                cx={end.x}
                cy={end.y}
                r="4"
                fill="var(--accent)"
                opacity="0.5"
              />
            )}
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

      {active && (
        <div
          className="spark-readout"
          style={{
            // Clamped so the bubble never hangs off either edge.
            left: Math.min(Math.max(active.x, 32), Math.max(32, w - 32)),
            top: active.y - 8,
            opacity: 1,
          }}
        >
          <span className="ro-val">{formatValue(active.v)}%</span>
          <span className="ro-date">{dateFmt.format(active.date)}</span>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {active ? describe(active) : ''}
      </span>
    </div>
  );
}
