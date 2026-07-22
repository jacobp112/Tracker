import type { ReactNode } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, DeltaChip, Eyebrow, Hint } from './primitives';

/**
 * The outsized figure + delta + embedded chart (Document 3 §3, §5.2).
 * One per screen, maximum — it carries `--shadow-hero` and the corner bloom.
 */
export function HeroStat({
  eyebrow,
  hint,
  value,
  unit = '%',
  caption,
  delta,
  children,
  className,
  style,
}: {
  eyebrow: string;
  /** Plain-language explanation, surfaced as a "?" tooltip beside the eyebrow. */
  hint?: string;
  /** null when the metric has no basis yet — rendered as an em-dash, not 0
   *  (the empty-value rule: a genuine zero shows 0, a missing one shows —). */
  value: number | null;
  unit?: string;
  caption: string;
  delta?: number;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  // The hook can't be called conditionally; feed it 0 when there's no value and
  // simply don't show its output.
  const shown = useCountUp(value ?? 0);

  return (
    <Card className={`hero-stat ${className ?? ''}`} style={style}>
      <div className="eyebrow-row">
        <Eyebrow>{eyebrow}</Eyebrow>
        {hint && <Hint text={hint} label={`About ${eyebrow}`} />}
      </div>
      {value === null ? (
        <div className="hero-number mono-num is-empty">—</div>
      ) : (
        <div className="hero-number mono-num">
          {shown}
          {unit}
        </div>
      )}
      <div className="hero-sub">
        {caption}
        {delta !== undefined && <DeltaChip delta={delta} />}
      </div>
      {children}
    </Card>
  );
}
