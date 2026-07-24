import { describe, expect, it } from 'vitest';
import { buildExamView, type TopicIndex } from '@/engine/exams';
import { allTopics, emptyStore, type Course, type Exam, type Store } from '@/domain/types';

function course(id: string, title: string, topics: Array<[string, string]>): Course {
  return {
    schema_version: '2.0.0',
    course_id: id,
    title,
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [
      {
        section_id: `section_${id}`,
        title: 'S',
        order: 0,
        topics: topics.map(([tid, ttitle]) => ({
          topic_id: tid,
          title: ttitle,
          status: 'practising',
          conf: 3,
          strength: 1,
          k_factor: 8.4,
          cards: 0,
          last_reviewed: '2026-07-10T12:00:00Z',
          mastered_at: null,
          drift_history: [],
          review_history: [],
          error_log: [],
        })),
      },
    ],
  };
}

function storeWith(...courses: Course[]): Store {
  return { ...emptyStore(), courses };
}

/** The topic index buildExamView now takes — built exactly as examViews does. */
function indexOf(store: Store): TopicIndex {
  return new Map(
    allTopics(store).map(({ topic, course }) => [topic.topic_id, { title: topic.title, course }]),
  );
}

describe('E5-S3 — exam view (Document 3 §5.4)', () => {
  it('marks a pass (≥80%) boosted and a fail flagged', () => {
    const store = storeWith(
      course('course_1', 'Calculus I', [
        ['topic_eps', 'Epsilon-delta'],
        ['topic_chain', 'Chain rule'],
      ]),
    );
    const exam: Exam = {
      schema_version: '2.0.0',
      exam_id: 'exam_1',
      title: 'Midterm 1',
      date: '2026-07-15T10:00:00Z',
      linked_topic_ids: ['topic_eps', 'topic_chain'],
      score: 30,
      max_score: 40,
      breakdown: [
        { topic_id: 'topic_eps', points_earned: 18, points_possible: 20 },
        { topic_id: 'topic_chain', points_earned: 12, points_possible: 20 },
      ],
    };

    const view = buildExamView(exam, indexOf(store));
    const rows = view.groups[0]!.topics;
    expect(rows.find((r) => r.title === 'Epsilon-delta')!.effect).toBe('boosted'); // 90%
    expect(rows.find((r) => r.title === 'Chain rule')!.effect).toBe('flagged'); // 60%
    expect(view.scorePct).toBe(75);
  });

  it('groups the breakdown by parent course when an exam spans courses (Doc 1 §4)', () => {
    const store = storeWith(
      course('course_1', 'Calculus I', [['topic_eps', 'Epsilon-delta']]),
      course('course_2', 'Org Chem', [['topic_sn2', 'SN2 mechanisms']]),
    );
    const exam: Exam = {
      schema_version: '2.0.0',
      exam_id: 'exam_2',
      title: 'General assessment',
      date: '2026-07-15T10:00:00Z',
      linked_topic_ids: ['topic_eps', 'topic_sn2'],
      score: 30,
      max_score: 40,
    };

    const view = buildExamView(exam, indexOf(store));
    expect(view.groups).toHaveLength(2);
    expect(view.groups.map((g) => g.courseTitle).sort()).toEqual(['Calculus I', 'Org Chem']);
  });

  it('uses the overall score for a uniform-fallback exam (no breakdown)', () => {
    const store = storeWith(course('course_1', 'Calculus I', [['topic_eps', 'Epsilon-delta']]));
    const exam: Exam = {
      schema_version: '2.0.0',
      exam_id: 'exam_3',
      title: 'Quiz',
      date: '2026-07-15T10:00:00Z',
      linked_topic_ids: ['topic_eps'],
      score: 18,
      max_score: 20,
    };

    const view = buildExamView(exam, indexOf(store));
    const row = view.groups[0]!.topics[0]!;
    expect(row.earned).toBeNull(); // signals "applied overall" in the UI
    expect(row.effect).toBe('boosted'); // 90%
  });

  it('labels a topic whose course was removed rather than dropping the row', () => {
    const store = storeWith(course('course_1', 'Calculus I', [['topic_eps', 'Epsilon-delta']]));
    const exam: Exam = {
      schema_version: '2.0.0',
      exam_id: 'exam_4',
      title: 'Old exam',
      date: '2026-07-15T10:00:00Z',
      linked_topic_ids: ['topic_gone'],
      score: 10,
      max_score: 20,
    };

    const view = buildExamView(exam, indexOf(store));
    expect(view.groups[0]!.courseTitle).toBe('Removed course');
    expect(view.groups[0]!.topics[0]!.title).toBe('topic_gone');
  });
});
