import { retentionStop } from '@/design/scale';
import { Dot, stopClass, Tag, type TagTone } from './primitives';

export interface RetentionRowProps {
  title: string;
  /** Live retention 0–100, or `null` for a never-reviewed topic. */
  retention: number | null;
  /** Diagnostic badges (Document 2 §8). */
  badges?: Array<{ label: string; tone: TagTone }>;
  onReview?: () => void;
  onSelect?: () => void;
}

/**
 * One topic in the Retention matrix (Document 3 §5.2).
 *
 * Contract (Document 4 E4-S2): the `%` is always rendered in text next to the
 * bar and dot. Colour never carries the value alone — that is what discharges
 * the colour-independence requirement (Document 3 §6), so the `.pct` span must
 * not be made conditional on anything.
 *
 * A never-reviewed topic renders `—`, never `0%` (Document 3 §2.2a).
 *
 * Semantics: the mockup makes the whole row clickable *and* nests a "Review →"
 * action inside it. Marking the row itself as a button would nest interactive
 * content inside interactive content — invalid ARIA, and ambiguous to a screen
 * reader. Instead the title is the button and is stretched over the row via
 * `.topic-btn::after`, with the action lifted above it on the z-axis. Same hit
 * area, two cleanly separable controls.
 */
export function RetentionRow({ title, retention, badges = [], onReview, onSelect }: RetentionRowProps) {
  const notStarted = retention === null;
  const tone = notStarted ? 'none' : stopClass(retentionStop(retention));
  const label = notStarted ? '—' : `${Math.round(retention)}%`;
  const width = notStarted ? '0%' : `${Math.round(retention)}%`;

  return (
    <div className="row">
      <div className="row-left">
        <Dot retention={retention} />
        {onSelect ? (
          <button type="button" className="topic topic-btn" onClick={onSelect}>
            {title}
          </button>
        ) : (
          <span className="topic">{title}</span>
        )}
        {badges.map((b) => (
          <Tag key={b.label} tone={b.tone}>
            {b.label}
          </Tag>
        ))}
      </div>
      <div className="row-right">
        <div className="bar-track" aria-hidden="true">
          <div className={`bar-fill ${tone}`} style={{ ['--w' as string]: width }} />
        </div>
        <span className="pct">
          {label}
          <span className="sr-only">{notStarted ? ' — not yet reviewed' : ' retention'}</span>
        </span>
        {onReview && (
          <button type="button" className="row-action" onClick={onReview}>
            Review →
          </button>
        )}
      </div>
    </div>
  );
}
