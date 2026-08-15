import { describe, it, expect } from 'vitest';
import { effectiveStrength } from '@/engine/stability';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

/**
 * V5 — effective strength must never be served stale.
 *
 * The old memo was keyed on the `review_history` array *reference*, so if the
 * same array is reused while its event contents change (e.g. an in-place
 * migration backfill), a later read could return the earlier fold. This spec
 * reuses one array reference across a content change and pins that the second
 * read reflects the new contents.
 */

const passEv = (): ReviewEvent => ({
  event_id: 'event_p', date: '2026-08-02T09:00:00Z', kind: 'test_pass', source: 'exam',
  source_id: 'exam_2', confidence_reported: 5, test: { score: 10, out_of: 10, actual_retention: 1 },
});
const hardFailEv = (): ReviewEvent => ({
  event_id: 'event_f', date: '2026-08-01T09:00:00Z', kind: 'test_fail', source: 'exam',
  source_id: 'exam_1', confidence_reported: 3, test: { score: 0, out_of: 10, actual_retention: 0 },
});

function topic(history: ReviewEvent[], strength: number): Topic {
  return {
    topic_id: 'topic_m', title: 'M', status: 'practising', conf: 3, strength, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-02T09:00:00Z', mastered_at: null,
    drift_history: [], review_history: history, error_log: [],
  };
}

describe('V5 — effectiveStrength does not serve a stale fold', () => {
  it('recomputes when a reused history array changes contents in place', () => {
    const history: ReviewEvent[] = [passEv()];
    // First read: no fail → P = 1 → s_eff = strength.
    expect(effectiveStrength(topic(history, 4))).toBeCloseTo(4, 6);

    // Same array reference, contents mutated to a hard fail (P = PENALTY_FLOOR).
    history[0] = hardFailEv();
    const expected = Math.max(CONFIG.S_EFF_MIN, 4 * CONFIG.PENALTY_FLOOR);
    expect(effectiveStrength(topic(history, 4))).toBeCloseTo(expected, 6);
  });
});
