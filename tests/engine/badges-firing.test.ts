import { describe, it, expect } from 'vitest';
import { badges } from '@/engine/metrics';
import { applyEvent } from '@/engine/recalculate';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

function build(events: ReviewEvent[]): Topic {
  let t: Topic = {
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 4, strength: 0, k_factor: CONFIG.DECAY_K,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [],
  };
  for (const e of events) t = applyEvent(t, e, new Date(e.date));
  return t;
}
const study = (i: number, c: 1 | 2 | 3 | 4 | 5): ReviewEvent => ({
  event_id: `event_s${i}`, date: `2026-08-0${i + 1}T09:00:00Z`, kind: 'study_review',
  source: 'session', source_id: `session_${i}`, confidence_reported: c,
});
const pass = (i: number, a: number): ReviewEvent => ({
  event_id: `event_p${i}`, date: `2026-08-0${i + 1}T09:00:00Z`, kind: 'test_pass',
  source: 'exam', source_id: `exam_${i}`, confidence_reported: 4,
  test: { score: a * 10, out_of: 10, actual_retention: a },
});

describe('badge firing under continuous gain (documents the intended rates)', () => {
  it('a near-miss pass no longer reads as slow growth', () => {
    // 3 confident studies + one 82% pass → velocity high enough to clear SLOW_V
    const t = build([study(0, 4), study(1, 4), study(2, 4), pass(3, 0.82)]);
    const ids = badges(t).map((b) => b.id);
    expect(ids).not.toContain('slow_growth');
    expect(ids).toContain('ready_to_test');
  });
});
