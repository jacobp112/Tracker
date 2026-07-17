import { ProgressRing } from '@/components/controls';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, Eyebrow } from './primitives';

/**
 * The ring variant of the §3 hero stat — same card treatment (`--shadow-hero` +
 * corner bloom), same "one per screen, maximum" rule, but the outsized figure
 * sits *inside* a progress ring rather than standing alone.
 *
 * This exists as a shared primitive rather than a per-screen composition
 * because Overview's hero is a ring (Document 3 v0.4 §5.1) while the course
 * dashboard's is a bare figure — two shapes of one component, not two
 * components. Document 3 §3: the builder does not invent per-screen variants.
 *
 * The score is rendered in text inside the ring, so the ring's arc never
 * carries the value alone (§6).
 */
export function HeroRing({
  eyebrow,
  value,
  caption,
  className,
  style,
}: {
  eyebrow: string;
  /** 0–100. */
  value: number;
  caption: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shown = useCountUp(value);

  return (
    <Card className={`hero-stat hero-ring ${className ?? ''}`} style={style}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="hero-ring-body">
        <ProgressRing value={value} size={168} stroke={12}>
          <span className="hero-ring-num mono-num">{shown}</span>
        </ProgressRing>
      </div>
      <div className="hero-sub">{caption}</div>
    </Card>
  );
}
