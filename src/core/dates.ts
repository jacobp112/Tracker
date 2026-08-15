/**
 * Date-input helpers (V6).
 *
 * A `<input type="date">` yields a bare `YYYY-MM-DD`. Passing that straight to
 * `new Date(str)` parses it as UTC midnight, which lands on the previous or next
 * calendar day once converted to a non-UTC local time — silently shifting when a
 * logged exam is considered to have happened. Anchoring at local **noon** keeps
 * the intended calendar date stable in every timezone (a ±12h safety margin).
 */

/** Convert a bare `YYYY-MM-DD` date-input value to an ISO instant anchored at
 *  local midday, so the calendar date survives timezone conversion. */
export function localDateInputToISO(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toISOString();
}

/** Today as a local `YYYY-MM-DD` — the correct default for a date input,
 *  unlike `toISOString().slice(0, 10)` which is the UTC date. */
export function todayLocalDateInput(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
