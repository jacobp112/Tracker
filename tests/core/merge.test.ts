import { describe, it, expect } from 'vitest';
import { mergeInto } from '@/core/merge';
import { emptyStore, type Course, type Exam, type Store } from '@/domain/types';

function storeWithTopic(id = 'topic_a'): Store {
  const course: Course = {
    schema_version: '3.1.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: id, title: 'T', status: 'practising', conf: 3, strength: 1,
      k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00Z',
      mastered_at: null, drift_history: [], review_history: [], error_log: [],
    }] }],
  };
  const s = emptyStore(); s.courses.push(course); return s;
}

describe('mergeExam smeared marking', () => {
  it('marks a uniform-fallback exam event smeared: true', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.1.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00Z',
      linked_topic_ids: ['topic_a'], score: 4, max_score: 10, // no breakdown
    };
    mergeInto(s, 'exam', exam);
    const ev = s.courses[0]!.sections[0]!.topics[0]!.review_history.at(-1)!;
    expect(ev.smeared).toBe(true);
    expect(ev.fanout).toBe(1); // linked_topic_ids.length, stamped for a future 1/√N option
  });
  it('marks a breakdown-backed exam event smeared: false', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.1.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00Z',
      linked_topic_ids: ['topic_a'], score: 4, max_score: 10,
      breakdown: [{ topic_id: 'topic_a', points_earned: 4, points_possible: 10 }],
    };
    mergeInto(s, 'exam', exam);
    const ev = s.courses[0]!.sections[0]!.topics[0]!.review_history.at(-1)!;
    expect(ev.smeared).toBe(false);
  });
});
