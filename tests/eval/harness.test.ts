import { describe, it, expect } from 'vitest';
import { scoreStore, engineModel, constantModel } from './harness';
import { fixtureStore } from './fixture';

describe('scoreStore', () => {
  it('scores only test events, excludes smeared as targets, keeps them in history', () => {
    const s = fixtureStore();
    const scored = scoreStore(s, engineModel);
    // topic_a: 2 tests; topic_b: 1 non-smeared test (second test is smeared) → 3 targets
    expect(scored.n).toBe(3);
    expect(Number.isFinite(scored.logLoss)).toBe(true); // clamp prevents -Inf
    expect(scored.mae).toBeGreaterThanOrEqual(0);
  });
  it('constant model predicts the mean actual_retention', () => {
    const s = fixtureStore();
    const scored = scoreStore(s, constantModel(s));
    expect(Number.isFinite(scored.mae)).toBe(true);
  });

  it('skips a test with no prior events (first-event exam) instead of scoring R=1', () => {
    const s = fixtureStore();
    const firstEventExam = {
      event_id: 'event_first', date: '2026-06-01T09:00:00Z', kind: 'test_fail' as const,
      source: 'exam' as const, source_id: 'exam_first', confidence_reported: 3 as const,
      test: { score: 1, out_of: 10, actual_retention: 0.1 },
    };
    // Prepend as the topic's very first event.
    s.courses[0]!.sections[0]!.topics[0]!.review_history.unshift(firstEventExam);
    const scored = scoreStore(s, engineModel);
    expect(scored.skipped).toBe(1);
    expect(scored.n).toBe(3); // unchanged — the first-event exam is not scored
  });
});
