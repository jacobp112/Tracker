import { emptyStore, type Course, type ReviewEvent, type Store } from '@/domain/types';

function ev(i: number, kind: ReviewEvent['kind'], a: number, smeared = false): ReviewEvent {
  return {
    event_id: `event_${i}`, date: `2026-07-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
    kind, source: kind === 'study_review' ? 'session' : 'exam',
    source_id: kind === 'study_review' ? `session_${i}` : `exam_${i}`,
    confidence_reported: 4,
    ...(kind === 'study_review' ? {} : { test: { score: a * 10, out_of: 10, actual_retention: a }, smeared }),
  };
}

/** Two topics: one improving, one lapsing (incl. a smeared exam). */
export function fixtureStore(): Store {
  const topics = [
    { id: 'topic_a', evs: [ev(0, 'study_review', 0), ev(3, 'test_pass', 0.85), ev(9, 'test_pass', 0.92)] },
    { id: 'topic_b', evs: [ev(1, 'study_review', 0), ev(5, 'test_fail', 0.30), ev(8, 'test_fail', 0.20, true)] },
  ];
  const course: Course = {
    schema_version: '3.1.0', course_id: 'course_1', title: 'C',
    created_at: '2026-07-01T00:00:00Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: topics.map((t) => ({
      topic_id: t.id, title: t.id, status: 'practising', conf: 4, strength: 1, k_factor: 8.4,
      cards: 0, last_reviewed: t.evs.at(-1)!.date, mastered_at: null, drift_history: [],
      review_history: t.evs, error_log: [],
    })) }],
  };
  const s = emptyStore(); s.courses.push(course); return s;
}
