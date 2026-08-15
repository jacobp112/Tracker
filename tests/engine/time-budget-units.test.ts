import { describe, expect, it } from 'vitest';
import { deriveTimeBudget } from '@/engine/planning';
import { CONFIG } from '@/config/constants';
import { emptyStore } from '@/domain/types';

/**
 * V4 — `sessionsRemaining` must always be a session count, never a raw day
 * count. The deadline branch previously assigned `days` directly, mixing units
 * with the availableMinutes branch (which divides by SESSION_MINUTES).
 */

const NOW = new Date('2026-08-15T00:00:00.000Z');

describe('V4 — deriveTimeBudget reports sessions, not days', () => {
  it('converts a deadline N days out into N × sessions-per-day', () => {
    const deadline = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
    const budget = deriveTimeBudget(emptyStore(), { deadline }, NOW);
    expect(budget.sessionsRemaining).toBe(10 * CONFIG.DEFAULT_SESSIONS_PER_DAY);
  });

  it('never reports zero sessions while a future deadline remains', () => {
    const deadline = new Date(NOW.getTime() + 6 * 60 * 60 * 1000); // same day, hours away
    const budget = deriveTimeBudget(emptyStore(), { deadline }, NOW);
    expect(budget.sessionsRemaining).toBeGreaterThanOrEqual(1);
  });

  it('still derives sessions from availableMinutes when given', () => {
    const budget = deriveTimeBudget(emptyStore(), { availableMinutes: 90 }, NOW);
    expect(budget.sessionsRemaining).toBe(Math.floor(90 / CONFIG.PROGRESS.SESSION_MINUTES));
  });
});
