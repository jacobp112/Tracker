import { describe, it, expect } from 'vitest';
import { retentionSeries } from '@/engine/history';
import type { Course, ReviewEvent } from '@/domain/types';

const study: ReviewEvent = {
  event_id: 'event_s', date: '2026-08-01T09:00:00Z', kind: 'study_review',
  source: 'session', source_id: 'session_1', confidence_reported: 4,
};
const lateFail: ReviewEvent = {
  event_id: 'event_f', date: '2026-08-09T09:00:00Z', kind: 'test_fail', source: 'exam',
  source_id: 'exam_1', confidence_reported: 3, test: { score: 1, out_of: 10, actual_retention: 0.1 },
};

function course(history: ReviewEvent[]): Course {
  return {
    schema_version: '3.1.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00Z',
    source: 'manual', sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: 'topic_a', title: 'T', status: 'practising', conf: 4, strength: 2, k_factor: 8.4,
      cards: 0, last_reviewed: history.at(-1)!.date, mastered_at: null, drift_history: [],
      review_history: history, error_log: [],
    }] }],
  };
}

describe('retentionSeries — no future leakage', () => {
  it('the Aug 3 point is identical whether or not an Aug 9 fail exists (no future leakage)', () => {
    const now = new Date('2026-08-10T09:00:00Z');
    const withoutFail = retentionSeries(course([study]), 10, now);
    const withFail = retentionSeries(course([study, lateFail]), 10, now);
    const aug3 = (s: typeof withFail) => s.find((p) => p.date.toISOString().startsWith('2026-08-03'))!.value;
    expect(aug3(withFail)).toBe(aug3(withoutFail));
  });
});
