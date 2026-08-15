import { describe, it, expect } from 'vitest';
import { mastery } from '@/engine/prerequisites';
import type { ReviewEvent, Topic } from '@/domain/types';

/**
 * Phase 1 Task 1 — L = health/100 for ANY status (D1 + watch-item #2).
 * `health()` is computable for any topic; `shouldShowHealth` is only a
 * presentation gate, so mastery must not zero a learning topic with real
 * evidence (which would falsely hard-block its dependents).
 */

const NOW = new Date('2026-08-15T00:00:00Z');
function topic(o: Partial<Topic> = {}): Topic {
  return { topic_id: 't', title: 't', status: 'practising', conf: 4, strength: 3, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-14T00:00:00Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...o };
}
const pass: ReviewEvent = { event_id: 'e', date: '2026-08-14T00:00:00Z', kind: 'test_pass',
  source: 'exam', source_id: 'x', confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 } };

describe('mastery (L = health/100, any status)', () => {
  it('is within [0,1]', () => {
    const m = mastery(topic(), NOW);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(1);
  });
  it('grants credit to a LEARNING topic with a passed test (not falsely 0)', () => {
    const learned = topic({ status: 'learning', review_history: [pass] });
    expect(mastery(learned, NOW)).toBeGreaterThan(0);
  });
});
