import { Children, type HTMLAttributes, type ReactNode } from 'react';
import { Card, Hint } from './primitives';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Props row — Document 3 §3: *one* card subdivided by internal borders, never N
 * separate cards.
 *
 * Column count is derived from the children rather than hardcoded. The previous
 * fixed `repeat(4, 1fr)` was the source of a real defect — Overview put three
 * props into it and rendered a dead fourth cell (Document 3 v0.4 §0.0 item 2).
 * Deriving it means a props row cannot be wrong about its own arity.
 *
 * The dividers are grid *gaps* showing the card's background through, not
 * per-child borders. That is what makes this correct at any column count and
 * across the wrap at 920px: there is no "which child is last in its row"
 * question to get wrong, because no child draws a border at all.
 */
export function PropsRow({
  children,
  className,
  style,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const cols = Children.count(children);
  return (
    <Card
      className={cx('props-card', className)}
      style={{ ['--cols' as string]: cols, ...style }}
      {...rest}
    >
      {children}
    </Card>
  );
}

/**
 * One column of a props row. `value` is always set in the mono/tabular face —
 * Document 3 §2.4's "single most important typographic decision".
 */
export function Prop({
  icon,
  label,
  value,
  caption,
  hint,
  className,
  accent,
  after,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  /** One-line explanation of what the metric means, for labels that are jargon
   *  on their own (e.g. Calibration). Surfaced as an info marker carrying the
   *  text, so a reader who doesn't know the term can find out in place. */
  hint?: string;
  className?: string;
  /** Tints the value with `--accent` — the Due-review emphasis (§5.2). */
  accent?: boolean;
  /** Slot beside the label, e.g. the live-pulse dot. */
  after?: ReactNode;
}) {
  return (
    <div className={cx('prop', accent && 'prop-due', className)}>
      <div className="prop-top">
        {icon}
        <span>{label}</span>
        {hint && <Hint text={hint} label={`About ${label}`} />}
        {after}
      </div>
      <div className="prop-value mono-num">{value}</div>
      {caption !== undefined && <div className="prop-caption">{caption}</div>}
    </div>
  );
}
