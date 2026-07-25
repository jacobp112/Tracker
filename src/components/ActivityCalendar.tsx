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

/** Floor for the intensity ceiling to prevent single-session spikes from maxing contrast. */
const MIN_CEILING = 4;

export interface ActivityDay {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  count: number;
}

/**
 * Local-time YYYY-MM-DD formatter.
 * Avoids UTC shifts from `toISOString()` that misattribute late-night sessions.
 */
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

function formatSessionCount(count: number): string {
  if (count === 0) return 'No study activity';
  return `${count} ${count === 1 ? 'review session' : 'review sessions'}`;
}

/**
 * 90-day study-activity calendar heatmap.
 * Encodes session volume using accent hue intensity.
 */
export function ActivityCalendar({
  days,
  today = new Date(),
}: {
  days: readonly ActivityDay[];
  today?: Date;
}) {
  const todayKey = toLocalDateKey(today);

  const { cells, monthLabels, todayIdx, ceiling } = useMemo(() => {
    const [y, m, d] = todayKey.split('-').map(Number) as [number, number, number];
    // Anchor to local noon to safeguard against DST boundary shifts during day arithmetic
    const anchor = new Date(y, m - 1, d, 12, 0, 0);

    // Align row 0 to Sunday of the starting week
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
      const what = future ? 'Upcoming' : formatSessionCount(count);

      out.push({ key, date: day, count, label: `${when} — ${what}`, future });
    }

    // Dynamic month labels dynamically anchored to column shifts
    const labels: Array<{ text: string; column: number }> = [];
    for (let c = 0; c < COLUMNS; c++) {
      const currentCell = out[c * ROWS];
      if (!currentCell) continue;

      const month = currentCell.date.getMonth();
      const prevCell = c === 0 ? null : out[(c - 1) * ROWS];
      const prevMonth = prevCell ? prevCell.date.getMonth() : -1;

      if (month !== prevMonth) {
        const monthName = MONTH_NAMES[month];
        if (monthName) labels.push({ text: monthName, column: c + 1 });
      }
    }

    // Drop leading label if space is insufficient under column 1
    if (labels.length > 1 && (labels[1]?.column ?? 0) - (labels[0]?.column ?? 0) < 2) {
      labels.shift();
    }

    const observed = out.reduce((mx, c) => Math.max(mx, c.count), 0);

    return {
      cells: out,
      monthLabels: labels,
      todayIdx: out.findIndex((c) => c.key === todayKey),
      ceiling: Math.max(observed, MIN_CEILING),
    };
  }, [days, todayKey]);

  const isEmpty = !cells.some((c) => c.count > 0);
  const maxNavigableIdx = todayIdx >= 0 ? todayIdx : ACTIVITY_WINDOW_DAYS - 1;

  const gridRef = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const roving = focusIdx ?? Math.max(todayIdx, 0);

  // Sync DOM focus if set externally or during initialization
  useEffect(() => {
    if (focusIdx == null) return;
    const el = gridRef.current?.children[focusIdx];
    if (el instanceof HTMLElement) el.focus();
  }, [focusIdx]);

  const moveFocus = (nextIdx: number) => {
    const clamped = Math.max(0, Math.min(maxNavigableIdx, nextIdx));
    setFocusIdx(clamped);

    // Direct synchronous focus for immediate feedback
    const target = gridRef.current?.children[clamped];
    if (target instanceof HTMLElement) {
      target.focus();
    }
  };

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
    moveFocus(roving + step);
  };

  return (
    <>
      <div className="heatmap-wrap">
        <div
          ref={gridRef}
          className={`heatmap ${isEmpty ? 'is-empty' : ''}`}
          role={isEmpty ? undefined : 'grid'}
          aria-label={isEmpty ? undefined : 'Study activity, last 13 weeks'}
          onKeyDown={isEmpty ? undefined : onKeyDown}
          aria-hidden={isEmpty || undefined}
        >
          {cells.map((c, i) => {
            const isNavigable = !isEmpty && !c.future;
            const isFocused = i === roving;

            return (
              <button
                type="button"
                key={c.key}
                className={`cell l${c.future ? 0 : activityStep(c.count, ceiling)}${
                  c.future ? ' is-future' : ''
                }`}
                title={isEmpty ? undefined : c.label}
                tabIndex={isNavigable && isFocused ? 0 : -1}
                onFocus={() => setFocusIdx(i)}
                role="gridcell"
                aria-label={c.label}
                aria-disabled={c.future || undefined}
              />
            );
          })}
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