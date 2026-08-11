import { describe, expect, it } from 'vitest';
import { mergeInto, resolveExamAssessment } from '@/core/merge';
import { emptyStore, type AssessmentEvidence, type Course, type Exam, type Store, type StudySession } from '@/domain/types';

function storeWithTopic(id = 'topic_a'): Store {
  const course: Course = {
    schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: id, title: 'T', status: 'practising', conf: 3, strength: 1,
      k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z',
      mastered_at: null, drift_history: [], review_history: [], error_log: [],
    }] }],
  };
  const s = emptyStore(); s.courses.push(course); return s;
}

function lastEvent(s: Store, topicId = 'topic_a') {
  return s.courses[0]!.sections[0]!.topics.find((t) => t.topic_id === topicId)!.review_history.at(-1)!;
}

describe('resolveExamAssessment — three-case cold fallback', () => {
  it('CASE 1: per-breakdown cold wins over exam-level cold', () => {
    expect(resolveExamAssessment({ cold: false }, true)).toEqual({ cold: false });
  });
  it('CASE 2: block present without cold → exam-level cold fills it, other dims preserved', () => {
    expect(resolveExamAssessment({ difficulty: 3 }, true)).toEqual({ difficulty: 3, cold: true });
  });
  it('CASE 3: no block at all + exam cold → constructs a minimal { cold: true }', () => {
    expect(resolveExamAssessment(undefined, true)).toEqual({ cold: true });
  });
  it('exam not cold + no block → nothing to attach', () => {
    expect(resolveExamAssessment(undefined, false)).toBeUndefined();
  });
  it('exam not cold + block present → block passes through unchanged', () => {
    expect(resolveExamAssessment({ difficulty: 2 }, false)).toEqual({ difficulty: 2 });
  });
  it('does not mutate the caller’s block', () => {
    const input: AssessmentEvidence = { difficulty: 3 };
    resolveExamAssessment(input, true);
    expect(input).toEqual({ difficulty: 3 });
  });
});

describe('mergeSession — assessment pass-through', () => {
  it('copies a topic’s assessment onto the event', () => {
    const s = storeWithTopic();
    const session: StudySession = {
      schema_version: '3.2.0', session_id: 'session_1', course_id: 'course_1',
      date: '2026-08-08T00:00:00.000Z', duration_minutes: 0,
      topics_covered: [{ topic_id: 'topic_a', confidence_reported: 4,
        assessment: { independence: 3, transfer_level: 2 } }],
    };
    mergeInto(s, 'session', session);
    expect(lastEvent(s).assessment).toEqual({ independence: 3, transfer_level: 2 });
  });
  it('leaves assessment undefined when the tutor supplied none', () => {
    const s = storeWithTopic();
    const session: StudySession = {
      schema_version: '3.2.0', session_id: 'session_1', course_id: 'course_1',
      date: '2026-08-08T00:00:00.000Z', duration_minutes: 0,
      topics_covered: [{ topic_id: 'topic_a', confidence_reported: 4 }],
    };
    mergeInto(s, 'session', session);
    expect(lastEvent(s).assessment).toBeUndefined();
  });
});

describe('mergeExam — cold fallback applied per topic', () => {
  it('CASE 3 via the no-breakdown (smeared) path: cold paper tags every event', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10, cold: true,
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toEqual({ cold: true });
  });
  it('CASE 2: breakdown assessment without cold gets cold filled', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10, cold: true,
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10, assessment: { difficulty: 4 } }],
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toEqual({ difficulty: 4, cold: true });
  });
  it('non-cold exam with a breakdown assessment passes it through untouched', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10,
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10, assessment: { difficulty: 4 } }],
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toEqual({ difficulty: 4 });
  });
  it('non-cold exam with no assessment leaves the event assessment undefined', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10,
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toBeUndefined();
  });
});
