import { describe, it, expect } from 'vitest';
import { applyEvent } from '@/engine/recalculate';
import { predictRetention } from '@/engine/retention';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

function baseTopic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 3,
    strength: 2, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: '2026-08-01T09:00:00Z', mastered_at: null,
    // three prior drift samples so a fourth would tune k
    drift_history: [-0.2, -0.2, -0.2],
    review_history: [], error_log: [], ...over,
  };
}
function testEvent(over: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    event_id: 'event_x', date: '2026-08-08T09:00:00Z', kind: 'test_fail',
    source: 'exam', source_id: 'exam_1', confidence_reported: 4,
    test: { score: 3, out_of: 10, actual_retention: 0.3 }, ...over,
  };
}

describe('applyEvent drift skip for smeared events', () => {
  it('a smeared test does NOT tune k_factor or push drift', () => {
    const before = baseTopic();
    const after = applyEvent(before, testEvent({ smeared: true }));
    expect(after.k_factor).toBe(before.k_factor);
    expect(after.drift_history).toEqual(before.drift_history);
  });
  it('a non-smeared test DOES push drift and tune k_factor', () => {
    const before = baseTopic();
    const after = applyEvent(before, testEvent({ smeared: false }));
    // toBe(+1), not toBeGreaterThan(-1): the latter passes even when nothing was pushed.
    expect(after.drift_history.length).toBe(before.drift_history.length + 1);
    expect(after.k_factor).not.toBe(before.k_factor);
  });
});

describe('drift-order invariant', () => {
  it('drift is scored against the curve BEFORE the event lands (excludes its own penalty)', () => {
    const before = baseTopic({ strength: 3, review_history: [], drift_history: [] });
    const rBefore = predictRetention(before, new Date('2026-08-08T09:00:00Z'))!;
    const after = applyEvent(before, testEvent({ smeared: false, test: { score: 3, out_of: 10, actual_retention: 0.3 } }));
    const pushed = after.drift_history.at(-1)!;
    expect(pushed).toBeCloseTo(0.3 - rBefore, 6); // NOT 0.3 - R(after the fail)
  });
});
