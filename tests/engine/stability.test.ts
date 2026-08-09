import { describe, it, expect } from 'vitest';
import { penaltyFrom, lapseFactor, effectiveStrength } from '@/engine/stability';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

const failEv = (a: number, smeared = false): ReviewEvent => ({
  event_id: 'event_f', date: '2026-08-01T09:00:00Z', kind: 'test_fail', source: 'exam',
  source_id: 'exam_1', confidence_reported: 3, test: { score: a * 10, out_of: 10, actual_retention: a }, smeared,
});
const passEv = (): ReviewEvent => ({
  event_id: 'event_p', date: '2026-08-02T09:00:00Z', kind: 'test_pass', source: 'exam',
  source_id: 'exam_2', confidence_reported: 5, test: { score: 10, out_of: 10, actual_retention: 1 },
});

describe('penaltyFrom', () => {
  it('is 1.0 at the pass mark and PENALTY_FLOOR at 0, and monotonic', () => {
    expect(penaltyFrom(CONFIG.TEST_PASS_MARK)).toBeCloseTo(1, 6);
    expect(penaltyFrom(0)).toBeCloseTo(CONFIG.PENALTY_FLOOR, 6);
    expect(penaltyFrom(0.4)).toBeGreaterThan(penaltyFrom(0.2));
  });
});

describe('lapseFactor', () => {
  it('is 1 with no fails', () => expect(lapseFactor([passEv()])).toBe(1));
  it('a hard fail then one pass leaves P = FLOOR*RECOVERY < 1', () => {
    const P = lapseFactor([failEv(0), passEv()]);
    expect(P).toBeCloseTo(CONFIG.PENALTY_FLOOR * CONFIG.LAPSE_RECOVERY, 6);
    expect(P).toBeLessThan(1);
  });
  it('pins the recovery crossover: penaltyFrom(0.533)*RECOVERY ≈ 1 (§2.5)', () => {
    // Below this actual_retention a single pass cannot fully erase the fail;
    // above it, it can. Pinned so re-tuning PENALTY_FLOOR/LAPSE_RECOVERY shows up.
    expect(penaltyFrom(0.533) * CONFIG.LAPSE_RECOVERY).toBeCloseTo(1, 2);
  });
  it('smeared fail is weighted toward 1 (no-op at weight 1.0 = same as non-smeared)', () => {
    expect(lapseFactor([failEv(0.3, true)])).toBeCloseTo(lapseFactor([failEv(0.3, false)]), 6);
  });
});

describe('effectiveStrength', () => {
  const topic = (over: Partial<Topic>): Topic => ({
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 3, strength: 3, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-01T00:00:00Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...over,
  });
  it('floors at S_EFF_MIN for a fully-lapsed topic', () => {
    const t = topic({ strength: 0.3, review_history: [failEv(0), failEv(0)] });
    expect(effectiveStrength(t)).toBe(CONFIG.S_EFF_MIN);
  });
  it('equals raw strength when unlapsed', () => {
    expect(effectiveStrength(topic({ strength: 3, review_history: [passEv()] }))).toBe(3);
  });
});
