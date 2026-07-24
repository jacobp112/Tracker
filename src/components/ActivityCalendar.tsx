import { useEffect, useMemo, useRef, useState } from 'react';
import { activityStep } from '@/design/scale';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const COLUMNS = 13;
const ROWS = 7;
const LEVELS = [0, 1, 2, 3, 4] as const;

/** Days rendered in the window. 13 columns × 7 rows, week-aligned. */
export const ACTIVITY_WINDOW_DAYS = COLUMNS * ROWS;

/** Floor for the intensity ceiling. Without it a single one-session day is the
 *  window maximum and burns at full accent, which reads as a heavy week. */
const MIN_CEILING = 4;

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

interface Cell {
  key: string;
  date: Date;
  count: number;
  label: string;
  future: boolean;
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
  /* A bare `new Date()` default is a fresh identity every render, so memoising
   * on `today` never memoises anything. Key on the calendar day instead. */
  const todayKey = toLocalDateKey(today);

  const { cells, monthLabels, todayIdx, ceiling } = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number) as [number, number, number];
    const anchor = new Date(y, m - 1, d); // local midnight

    /* Anchor the last column to the current week so every row is one weekday.
     * Counting back a flat 91 days puts an arbitrary weekday in row 0 and the
     * grid stops meaning anything. */
    const start = new Date(anchor);
    start.setDate(start.getDate() - ((COLUMNS - 1) * ROWS + anchor.getDay()));

    const byDate = new Map(days.map((a) => [a.date, a.count]));
    const out: Cell[] = [];

    for (let i = 0; i < ACTIVITY_WINDOW_DAYS; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      const key = toLocalDateKey(day);
      const future = day > anchor;
      const count = future ? 0 : (byDate.get(key) ?? 0);
      const when = `${DAY_NAMES[day.getDay()]}, ${MONTH_NAMES[day.getMonth()]} ${day.getDate()}`;
      const what = future
        ? 'Upcoming'
        : count === 0
          ? 'No study activity'
          : `${count} ${count === 1 ? 'review session' : 'review sessions'}`;
      out.push({ key, date: day, count, label: `${when} — ${what}`, future });
    }

    /* Label a column when it opens a new month, rather than pinning three
     * labels to fixed offsets — which drifts out of step with the columns. */
    const labels: Array<{ text: string; column: number }> = [];
    for (let c = 0; c < COLUMNS; c++) {
      const month = out[c * ROWS]!.date.getMonth();
      const prev = c === 0 ? -1 : out[(c - 1) * ROWS]!.date.getMonth();
      if (month !== prev) labels.push({ text: MONTH_NAMES[month]!, column: c + 1 });
    }
    // Drop a leading label with no room to sit under its own column.
    if (labels.length > 1 && labels[1]!.column - labels[0]!.column < 2) labels.shift();

    const observed = out.reduce((mx, c) => Math.max(mx, c.count), 0);

    return {
      cells: out,
      monthLabels: labels,
      todayIdx: out.findIndex((c) => c.key === todayKey),
      ceiling: Math.max(observed, MIN_CEILING),
      observed,
    };
  }, [days, todayKey]);

  const hasActivity = cells.some((c) => c.count > 0);

  /* Nothing logged in the whole window. A full-strength grid of level-0 cells
   * is visually indistinguishable from a grid that failed to load, so the empty
   * case says so in words and drops the grid back to scenery. */
  const isEmpty = !hasActivity;

  /* One tab stop, not 91. Arrows walk the grid: up/down is the next weekday,
   * left/right is the same weekday a week either side. */
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const roving = focusIdx ?? Math.max(todayIdx, 0);

  useEffect(() => {
    if (focusIdx == null) return;
    const el = gridRef.current?.children[focusIdx];
    if (el instanceof HTMLElement) el.focus();
  }, [focusIdx]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowUp' ? -1
      : e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' ? -ROWS
      : e.key === 'ArrowRight' ? ROWS
      : e.key === 'Home' ? -ACTIVITY_WINDOW_DAYS
      : e.key === 'End' ? ACTIVITY_WINDOW_DAYS
      : null;
    if (step == null) return;
    e.preventDefault();
    setFocusIdx(Math.max(0, Math.min(ACTIVITY_WINDOW_DAYS - 1, roving + step)));
  };

  return (
    <>
      <div className="heatmap-wrap">
        <div
          ref={gridRef}
          className={`heatmap ${isEmpty ? 'is-empty' : ''}`}
          role={isEmpty ? undefined : 'group'}
          aria-label={isEmpty ? undefined : 'Study activity, last 13 weeks'}
          onKeyDown={isEmpty ? undefined : onKeyDown}
          /* With no activity, 91 cells each announcing "No study activity" is
           * noise, not information — the caption below carries the meaning. */
          aria-hidden={isEmpty || undefined}
        >
          {cells.map((c, i) => (
            <div
              key={c.key}
              className={`cell l${c.future ? 0 : activityStep(c.count, ceiling)}${
                c.future ? ' is-future' : ''
              }`}
              title={isEmpty ? undefined : c.label}
              tabIndex={isEmpty || c.future ? -1 : i === roving ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              role="img"
              aria-label={c.label}
            />
          ))}
        </div>
        {isEmpty && <p className="heatmap-empty-note">No study activity in the last 90 days.</p>}
      </div>
      <div className="activity-foot">
        <div className="months">
          {monthLabels.map((m) => (
            <span key={`${m.text}-${m.column}`} style={{ gridColumn: m.column }}>
              {m.text}
            </span>
          ))}
        </div>
        <div className="legend">
          Less
          {LEVELS.map((l) => (
            <div key={l} className={`cell l${l}`} aria-hidden="true" />
          ))}
          More
        </div>
      </div>
    </>
  );
}