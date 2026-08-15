import { describe, it, expect } from 'vitest';
import { localDateInputToISO, todayLocalDateInput } from '@/core/dates';

/**
 * V6 — a bare `YYYY-MM-DD` from a <input type="date"> must be anchored at local
 * midday, not parsed as UTC midnight. UTC midnight shifts the recorded instant
 * across the day boundary for any non-UTC timezone, perturbing intra-first-day
 * decay. A noon anchor keeps the calendar date stable everywhere (±12h margin).
 */

describe('localDateInputToISO', () => {
  it('anchors the local instant at noon, not midnight', () => {
    // Built from a *local* noon, so local hours are 12 in every timezone —
    // whereas the old `new Date("2026-08-15")` is UTC midnight (local hours ≠ 12
    // outside UTC, and 0 inside it).
    expect(new Date(localDateInputToISO('2026-08-15')).getHours()).toBe(12);
  });

  it('preserves the calendar date through the round trip', () => {
    const iso = localDateInputToISO('2026-08-15');
    const d = new Date(iso);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(local).toBe('2026-08-15');
  });
});

describe('todayLocalDateInput', () => {
  it('returns today as a local YYYY-MM-DD string', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayLocalDateInput(now)).toBe(expected);
  });
});
