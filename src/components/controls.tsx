import { useEffect, useState, type ReactNode } from 'react';
import { healthStop } from '@/design/scale';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { stopClass } from './primitives';

/* ── Segmented control (Document 3 §3) ───────────────────────────
 * Uses tablist semantics so arrow keys move between segments.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              move(1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              move(-1);
            }
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Progress ring (Document 3 §3) ───────────────────────────── */
export function ProgressRing({
  value,
  size = 88,
  stroke = 7,
  children,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  /*
   * Draw-in: the arc sweeps from empty to its value on mount over --dur-draw.
   *
   * Reduced-motion guard is in JS, not CSS, and by design: the global
   * transition:none block already neutralises the CSS transition, so the guard
   * exists specifically to prevent the one-frame *empty* ring before the sweep
   * would start. `drawn` is seeded to `reduced`, so a reduced-motion viewer
   * renders at the target offset from the very first paint — no empty→full
   * frame at all, rather than an animation that is merely skipped.
   */
  const reduced = useReducedMotion();
  const [drawn, setDrawn] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  const shownOffset = drawn ? offset : circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`var(--${healthStop(clamped)})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={shownOffset}
          style={{ transition: 'stroke-dashoffset var(--dur-draw) var(--ease)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children ?? (
          <span className="mono-num" style={{ fontSize: 'var(--fs-prop)', fontWeight: 700 }}>
            {Math.round(clamped)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Calibration indicator (Document 2 §5) ───────────────────────
 * OCI > +0.10 overconfident, < −0.10 underconfident, else stable.
 * Thresholds are Document 3 §5.2's ±0.10 labelling band.
 */
export const OCI_LABEL_BAND = 0.1;

export function ociLabel(oci: number): 'Overconfident' | 'Underconfident' | 'Stable' {
  if (oci > OCI_LABEL_BAND) return 'Overconfident';
  if (oci < -OCI_LABEL_BAND) return 'Underconfident';
  return 'Stable';
}

export function CalibrationIndicator({ oci }: { oci: number }) {
  const signed = `${oci >= 0 ? '+' : ''}${oci.toFixed(2)}`;
  return (
    <>
      <div className="prop-value mono-num">{signed}</div>
      <div className="prop-caption">{ociLabel(oci)}</div>
    </>
  );
}

/* ── Data table (Document 3 §3) ──────────────────────────────── */
export interface Column<T> {
  key: string;
  header: string;
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  caption,
}: {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  getRowKey: (row: T) => string;
  caption?: string;
}) {
  return (
    <table className="data-table">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} className={c.numeric ? 'num' : undefined} scope="col">
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowKey(row)}>
            {columns.map((c) => (
              <td key={c.key} className={c.numeric ? 'num' : undefined}>
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export { stopClass };
