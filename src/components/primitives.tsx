import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { healthStop, retentionStop, type Stop } from '@/design/scale';

/** Map a §2.2(a) stop to the class suffix the stylesheet uses. */
const STOP_CLASS: Record<Stop, 'ok' | 'warn' | 'bad'> = {
  success: 'ok',
  warning: 'warn',
  danger: 'bad',
};

export function stopClass(stop: Stop): 'ok' | 'warn' | 'bad' {
  return STOP_CLASS[stop];
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ── Card ────────────────────────────────────────────────────────
 * The inset top edge comes from the `.card` class (Doc 3 §3) — it is the
 * material cue and is not optional.
 */
export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card', className)} {...rest}>
      {children}
    </div>
  );
}

/* ── Eyebrow ─────────────────────────────────────────────────── */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('eyebrow', className)}>{children}</div>;
}

/* ── Hint ────────────────────────────────────────────────────────
 * The "?" beside a metric whose name doesn't explain itself (Calibration,
 * Health, decay k…). A real tooltip, not a native `title`: it opens on hover
 * AND on focus/tap, so keyboard and touch users get the same explanation.
 * The trigger is a button wired to the tip via aria-describedby; screen
 * readers announce the text on focus without needing the visual popup.
 */
export function Hint({ text, label }: { text: string; label?: string }) {
  const id = useId();
  return (
    <span className="hint">
      <button type="button" className="hint-btn" aria-label={label ?? 'What is this?'} aria-describedby={id}>
        ?
      </button>
      <span role="tooltip" id={id} className="hint-tip">
        {text}
      </span>
    </span>
  );
}

/* ── Buttons ─────────────────────────────────────────────────── */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function Button({ children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx('btn-primary', className)} {...rest}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx('btn-secondary', className)} {...rest}>
      {children}
    </button>
  );
}

/**
 * The destructive variant. It is a named component rather than a restyled
 * SecondaryButton because "this action destroys data" is a semantic property of
 * the control, not a colour a screen paints on at the call site — and screens
 * that hand-tint their own delete buttons drift apart from each other.
 *
 * Colour is not the only signal: the danger read comes from the label's verb
 * and the confirm step in front of it, which is why this stays a plain button
 * rather than an alarming fill.
 */
export function DangerButton({ children, className, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cx('btn-danger', className)} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({
  children,
  label,
  className,
  ...rest
}: ButtonProps & { label: string }) {
  return (
    <button type="button" className={cx('icon-btn', className)} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

/* ── Delta chip ──────────────────────────────────────────────── */
export function DeltaChip({ delta, unit = 'pts' }: { delta: number; unit?: string }) {
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
  return (
    <span className={cx('delta-chip', dir)}>
      {arrow} {Math.abs(delta)}
      {unit}
    </span>
  );
}

/* ── Tag / diagnostic badge (Doc 2 §8) ───────────────────────── */
export type TagTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'accent';

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: TagTone }) {
  return <span className={cx('tag', tone)}>{children}</span>;
}

/* ── Status pill — the Doc 2 §7 four-state ladder ────────────── */
export type Status = 'Not Started' | 'Learning' | 'Practising' | 'Mastered';

const STATUS_CLASS: Record<Status, string> = {
  'Not Started': 'not-started',
  Learning: 'learning',
  Practising: 'practising',
  Mastered: 'mastered',
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={cx('status-pill', STATUS_CLASS[status])}>{status}</span>;
}

/* ── Health chip (Doc 2 §6) ──────────────────────────────────── */
export function HealthChip({ score }: { score: number }) {
  const rounded = Math.round(score);
  return (
    <span className={cx('health-chip', stopClass(healthStop(rounded)))}>
      {rounded}
      <span className="sr-only"> health</span>
    </span>
  );
}

/* ── Status dot ──────────────────────────────────────────────── */
export function Dot({ retention }: { retention: number | null }) {
  if (retention === null) return <span className="dot none" aria-hidden="true" />;
  return <span className={cx('dot', stopClass(retentionStop(retention)))} aria-hidden="true" />;
}
