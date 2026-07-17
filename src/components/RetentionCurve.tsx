import { useMemo } from 'react';
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';
import { daysBetween } from '@/engine/retention';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const VB_W = 320;
const VB_H = 140;
const PAD_L = 30;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 26;

/**
 * The retention curve — Document 3 §5.3, Document 4 E4-S5.
 *
 * Draws the Ebbinghaus decay from the last review, a dashed line at
 * `DUE_THRESHOLD`, and a "now" marker on the current decay point. Extends past
 * `now` so the user can see where the curve is heading, not just where it is.
 *
 * For a not-yet-reviewed topic it renders a plain "not yet reviewed" state
 * rather than an empty axis (§5.3).
 */
export function RetentionCurve({ topic, now = new Date() }: { topic: Topic; now?: Date }) {
  const reduced = useReducedMotion();

  const model = useMemo(() => {
    if (topic.last_reviewed === null || topic.status === 'not_started' || topic.strength <= 0) {
      return null;
    }
    const reviewed = new Date(topic.last_reviewed);
    if (Number.isNaN(reviewed.getTime())) return null;

    const elapsed = Math.max(0, daysBetween(reviewed, now));
    // Show the whole story: at least a fortnight, and always some runway past
    // today so the trajectory is legible.
    const span = Math.max(14, Math.ceil(elapsed * 1.5), elapsed + 5);

    const ks = topic.k_factor * topic.strength;
    const x = (d: number) => PAD_L + (d / span) * (VB_W - PAD_L - PAD_R);
    const y = (r: number) => PAD_T + (1 - r) * (VB_H - PAD_T - PAD_B);

    let path = '';
    for (let d = 0; d <= span; d += 0.5) {
      const r = Math.exp(-d / ks);
      path += `${d === 0 ? 'M' : ' L'}${x(d).toFixed(1)},${y(r).toFixed(1)}`;
    }

    const nowR = Math.exp(-elapsed / ks);
    // Where the curve crosses the threshold (Document 2 §2.1).
    const dueDay = -ks * Math.log(CONFIG.DUE_THRESHOLD);

    return {
      path,
      span,
      x,
      y,
      elapsed,
      nowR,
      nowX: x(elapsed),
      nowY: y(nowR),
      thresholdY: y(CONFIG.DUE_THRESHOLD),
      dueX: dueDay <= span ? x(dueDay) : null,
      reviewed,
    };
  }, [topic, now]);

  if (!model) {
    return (
      <div
        style={{
          padding: 'var(--space-12) var(--space-8)',
          textAlign: 'center',
          color: 'var(--ink-secondary)',
          fontSize: 'var(--fs-secondary)',
        }}
      >
        Not yet reviewed — the curve starts once you log a session.
      </div>
    );
  }

  const pct = Math.round(model.nowR * 100);
  const dueLabel = `${Math.round(CONFIG.DUE_THRESHOLD * 100)}%`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
      role="img"
      aria-label={`Retention curve. Currently ${pct}%, ${model.elapsed} days since the last review. Review threshold ${dueLabel}.`}
    >
      <defs>
        <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* y axis: 100 / threshold / 0 */}
      {[1, CONFIG.DUE_THRESHOLD, 0].map((r) => (
        <text
          key={r}
          x={PAD_L - 6}
          y={model.y(r) + 3}
          textAnchor="end"
          style={{ fontSize: 8, fill: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {Math.round(r * 100)}%
        </text>
      ))}

      {/* area under the curve */}
      <path
        d={`${model.path} L${model.x(model.span).toFixed(1)},${model.y(0).toFixed(1)} L${PAD_L},${model
          .y(0)
          .toFixed(1)} Z`}
        fill="url(#curve-fill)"
        stroke="none"
      />

      {/* the dashed DUE_THRESHOLD line (Doc 3 §5.3) */}
      <line
        x1={PAD_L}
        x2={VB_W - PAD_R}
        y1={model.thresholdY}
        y2={model.thresholdY}
        stroke="var(--warning)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <text
        x={VB_W - PAD_R}
        y={model.thresholdY - 4}
        textAnchor="end"
        style={{ fontSize: 8, fill: 'var(--warning)', fontFamily: 'var(--font-mono)' }}
      >
        review at {dueLabel}
      </text>

      {/* where it crosses */}
      {model.dueX !== null && (
        <line
          x1={model.dueX}
          x2={model.dueX}
          y1={model.thresholdY}
          y2={model.y(0)}
          stroke="var(--border-strong)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}

      <path
        d={model.path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        className={reduced ? undefined : 'spark-draw'}
      />

      {/* "now" marker */}
      <line
        x1={model.nowX}
        x2={model.nowX}
        y1={PAD_T}
        y2={model.y(0)}
        stroke="var(--ink-muted)"
        strokeWidth="1"
        opacity="0.4"
      />
      <circle className="pulse-dot" cx={model.nowX} cy={model.nowY} r="4" fill="var(--accent)" opacity="0.5" />
      <circle
        cx={model.nowX}
        cy={model.nowY}
        r="4"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="2.5"
      />
      <text
        x={model.nowX}
        y={model.y(0) + 12}
        textAnchor="middle"
        style={{ fontSize: 8, fill: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}
      >
        now
      </text>
    </svg>
  );
}
