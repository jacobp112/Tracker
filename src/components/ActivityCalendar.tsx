import { useMemo } from 'react';
import { activityStep } from '@/design/scale';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Days rendered in the window. 13 columns × 7 rows. */
export const ACTIVITY_WINDOW_DAYS = 91;

export interface ActivityDay {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  count: number;
}

/** Local-time YYYY-MM-DD. Deliberately not toISOString(), which shifts to UTC
 *  and can land a late-evening session on the wrong day. */
export function toLocalDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 90-day study-activity calendar (Document 3 §5.2, ramp §2.2(b)).
 *
 * Encodes *session volume*, not retention — which is why it is the one place
 * the accent hue is used as data.
 */
export function ActivityCalendar({
  days,
  today = new Date(),
}: {
  days: readonly ActivityDay[];
  today?: Date;
}) {
  const { cells, months } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d.count]));

    const out: Array<{ key: string; count: number; label: string }> = [];
    for (let i = 0; i < ACTIVITY_WINDOW_DAYS; i++) {
      const daysAgo = ACTIVITY_WINDOW_DAYS - 1 - i;
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const key = toLocalDateKey(d);
      const count = byDate.get(key) ?? 0;
      const noun = count === 1 ? 'review session' : 'review sessions';
      const label = `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()} — ${
        count === 0 ? 'No study activity' : `${count} ${noun}`
      }`;
      out.push({ key, count, label });
    }

    const monthAt = (daysAgo: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      return MONTH_NAMES[d.getMonth()]!;
    };

    return {
      cells: out,
      months: [monthAt(90), monthAt(45), monthAt(0)],
    };
  }, [days, today]);

  const max = useMemo(() => cells.reduce((m, c) => Math.max(m, c.count), 0), [cells]);

  /* Nothing logged in the whole window. A full-strength grid of level-0 cells
   * is visually indistinguishable from a grid that failed to load, so the empty
   * case says so in words and drops the grid back to scenery. */
  const isEmpty = max === 0;

  return (
    <>
      <div className="heatmap-wrap">
        <div
          className={`heatmap ${isEmpty ? 'is-empty' : ''}`}
          /* With no activity, 91 cells each announcing "No study activity" is
           * noise, not information — the caption below carries the meaning. */
          aria-hidden={isEmpty || undefined}
        >
          {cells.map((c) => (
            <div
              key={c.key}
              className={`cell l${activityStep(c.count, max)}`}
              title={isEmpty ? undefined : c.label}
              tabIndex={isEmpty ? -1 : 0}
              role="img"
              aria-label={c.label}
            />
          ))}
        </div>
        {isEmpty && <p className="heatmap-empty-note">No study activity in the last 90 days.</p>}
      </div>
      <div className="activity-foot">
        <div className="months">
          {months.map((m, i) => (
            <span key={`${m}-${i}`}>{m}</span>
          ))}
        </div>
        <div className="legend">
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={`cell l${l}`} aria-hidden="true" />
          ))}
          More
        </div>
      </div>
    </>
  );
}
