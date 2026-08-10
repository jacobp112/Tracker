import { describe, expect, it } from 'vitest';
import { observedSuccess, isIndependent, independenceTier, mean, successGatedMean, weightedComposite } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('observedSuccess — commensurability fallback (design §D)', () => {
  it('prefers a test score (actual_retention)', () => {
    expect(observedSuccess(makeEvent({ performance_quality: 2 }, { test: { score: 9, out_of: 10 } }))).toBe(0.9);
  });
  it('falls back to performance_quality / 5 when there is no test', () => {
    expect(observedSuccess(makeEvent({ performance_quality: 4 }))).toBe(0.8);
  });
  it('is undefined when neither a test nor quality exists (never fabricated)', () => {
    expect(observedSuccess(makeEvent({ difficulty: 3 }))).toBeUndefined();
  });
});

describe('independence tiers — strict boundary', () => {
  it('independence 3 is independent', () => {
    expect(isIndependent(makeEvent({ independence: 3 }))).toBe(true);
    expect(independenceTier(makeEvent({ independence: 3 }))).toBe('independent');
  });
  it('independence 2 is lightly_assisted, NOT independent', () => {
    expect(isIndependent(makeEvent({ independence: 2 }))).toBe(false);
    expect(independenceTier(makeEvent({ independence: 2 }))).toBe('lightly_assisted');
  });
  it('independence 0–1 is assisted', () => {
    expect(independenceTier(makeEvent({ independence: 1 }))).toBe('assisted');
    expect(independenceTier(makeEvent({ independence: 0 }))).toBe('assisted');
  });
  it('no independence value → undefined tier', () => {
    expect(independenceTier(makeEvent({ difficulty: 2 }))).toBeUndefined();
  });
  it('isIndependent is false for assisted levels 0 and 1', () => {
    expect(isIndependent(makeEvent({ independence: 0 }))).toBe(false);
    expect(isIndependent(makeEvent({ independence: 1 }))).toBe(false);
  });
});

describe('successGatedMean — difficulty/novelty earn credit only WITH success (§18)', () => {
  it('a solved hard attempt banks proportional credit', () => {
    // difficulty 5/5 × success 0.9 = 0.9
    expect(successGatedMean(
      [makeEvent({ difficulty: 5 }, { test: { score: 9, out_of: 10 } })],
      (e) => e.assessment?.difficulty, 5,
    )).toBeCloseTo(0.9);
  });
  it('a FAILED hard attempt banks ~0 — difficulty cannot lift the score without success', () => {
    // difficulty 5/5 × success 0 = 0
    expect(successGatedMean(
      [makeEvent({ difficulty: 5 }, { test: { score: 0, out_of: 10 } })],
      (e) => e.assessment?.difficulty, 5,
    )).toBe(0);
  });
  it('is null when no event has both the dimension and an outcome', () => {
    expect(successGatedMean(
      [makeEvent({ difficulty: 5 })], // no test, no quality → no observedSuccess
      (e) => e.assessment?.difficulty, 5,
    )).toBeNull();
  });
  it('averages ONLY qualifying events in a mixed array — a non-qualifying event is excluded, not counted as 0', () => {
    // One event qualifies (difficulty 4, success 1.0 → 0.8); one lacks any outcome
    // (no test, no quality → observedSuccess undefined) and must be EXCLUDED, not
    // averaged in as 0 (which would drag the mean to 0.4).
    const events = [
      makeEvent({ difficulty: 4 }, { test: { score: 10, out_of: 10 } }),
      makeEvent({ difficulty: 2 }), // no outcome → excluded
    ];
    expect(successGatedMean(events, (e) => e.assessment?.difficulty, 5)).toBeCloseTo(0.8);
  });
});

describe('mean / weightedComposite', () => {
  it('mean is null for an empty set (no false zero)', () => {
    expect(mean([])).toBeNull();
    expect(mean([0.2, 0.4])).toBeCloseTo(0.3);
  });
  it('weightedComposite re-normalises over present (non-null) parts', () => {
    // Only accuracy present → returns accuracy regardless of the other weights.
    expect(weightedComposite([
      { weight: 0.3, score: 0.9 },
      { weight: 0.7, score: null },
    ])).toBeCloseTo(0.9);
  });
  it('weightedComposite is null when no part has a score', () => {
    expect(weightedComposite([{ weight: 0.3, score: null }])).toBeNull();
  });
  it('weightedComposite re-normalises across MULTIPLE present parts with different weights', () => {
    // present: {0.3,0.9} and {0.2,0.5}; {0.5,null} drops out.
    // (0.3*0.9 + 0.2*0.5) / (0.3 + 0.2) = 0.37 / 0.5 = 0.74
    expect(weightedComposite([
      { weight: 0.3, score: 0.9 },
      { weight: 0.2, score: 0.5 },
      { weight: 0.5, score: null },
    ])).toBeCloseTo(0.74);
  });
});
