import { describe, it, expect } from 'vitest';
import { examTopicSmeared, recomputeLapseContamination } from '@/core/migrations';
import { importBundle } from '@/core/transfer';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Exam, type ReviewEvent, type Store } from '@/domain/types';

function smearedExamEvent(i: number): ReviewEvent {
  return {
    event_id: `event_${i}`,
    date: `2026-08-0${i + 1}T09:00:00Z`,
    kind: 'test_fail',
    source: 'exam',
    source_id: 'exam_1',
    confidence_reported: 3,
    test: { score: 3, out_of: 10, actual_retention: 0.3 }, // smeared flag absent (legacy)
  };
}

function contaminatedStore(): Store {
  const course: Course = {
    schema_version: '3.0.0',
    course_id: 'course_1',
    title: 'C',
    created_at: '2026-08-01T00:00:00Z',
    source: 'manual',
    sections: [
      {
        section_id: 'section_1',
        title: 'S',
        order: 0,
        topics: [
          {
            topic_id: 'topic_a',
            title: 'T',
            status: 'practising',
            conf: 3,
            strength: 3,
            // k tuned away from DECAY_K by the (legacy, smeared) exam; drift stored
            k_factor: 6.3,
            cards: 0,
            last_reviewed: '2026-08-03T09:00:00Z',
            mastered_at: null,
            drift_history: [-0.3, -0.3, -0.3],
            review_history: [smearedExamEvent(0), smearedExamEvent(1), smearedExamEvent(2)],
            error_log: [],
          },
        ],
      },
    ],
  };
  const exam: Exam = {
    schema_version: '3.0.0',
    exam_id: 'exam_1',
    title: 'E',
    date: '2026-08-03T09:00:00Z',
    linked_topic_ids: ['topic_a'],
    score: 3,
    max_score: 10, // no breakdown → smeared
  };
  const s = emptyStore();
  s.courses.push(course);
  s.exams.push(exam);
  return s;
}

describe('examTopicSmeared', () => {
  it('unresolvable exam → smeared (cautious)', () => {
    expect(examTopicSmeared(undefined, 'topic_a')).toBe(true);
  });
  it('no breakdown → smeared', () => {
    expect(examTopicSmeared({ breakdown: undefined } as Exam, 'topic_a')).toBe(true);
  });
  it('topic present in breakdown → not smeared', () => {
    const e = { breakdown: [{ topic_id: 'topic_a', points_earned: 1, points_possible: 2 }] } as Exam;
    expect(examTopicSmeared(e, 'topic_a')).toBe(false);
  });
});

describe('recomputeLapseContamination', () => {
  it('backfills smeared and recomputes k back to DECAY_K when all tuning was smeared', () => {
    const s = contaminatedStore();
    recomputeLapseContamination(s);
    const t = s.courses[0]!.sections[0]!.topics[0]!;
    expect(t.review_history.every((e) => e.smeared === true)).toBe(true);
    expect(t.k_factor).toBe(CONFIG.DECAY_K);
    expect(t.drift_history).toEqual([]);
  });

  it('is idempotent', () => {
    const s = contaminatedStore();
    recomputeLapseContamination(s);
    const once = JSON.stringify(s);
    recomputeLapseContamination(s);
    expect(JSON.stringify(s)).toBe(once);
  });

  // THE discriminating test: without it, "purged correctly" and "join failed,
  // wiped everything to DECAY_K" are indistinguishable (both leave k===DECAY_K).
  it('PRESERVES legitimate tuning from breakdown-backed exams (join resolves)', () => {
    // Five breakdown-backed exams, each a real per-topic fail → real drift → real k move.
    // Five (not three): the first event replays from genesis (last_reviewed null →
    // predictRetention null → no drift pushed), so N events yield N-1 drift samples;
    // DRIFT_MIN is 3, so we need ≥4 events for k to actually tune.
    const exams: Exam[] = [0, 1, 2, 3, 4].map((i) => ({
      schema_version: '3.0.0',
      exam_id: `exam_${i}`,
      title: `E${i}`,
      date: `2026-08-0${i + 1}T09:00:00Z`,
      linked_topic_ids: ['topic_a'],
      score: 2,
      max_score: 10,
      breakdown: [{ topic_id: 'topic_a', points_earned: 2, points_possible: 10 }],
    }));
    const events: ReviewEvent[] = exams.map((ex) => ({
      event_id: `event_${ex.exam_id}`,
      date: ex.date,
      kind: 'test_fail',
      source: 'exam',
      source_id: ex.exam_id,
      confidence_reported: 3,
      test: { score: 2, out_of: 10, actual_retention: 0.2 },
    }));
    const course: Course = {
      schema_version: '3.0.0',
      course_id: 'course_1',
      title: 'C',
      created_at: '2026-08-01T00:00:00Z',
      source: 'manual',
      sections: [
        {
          section_id: 'section_1',
          title: 'S',
          order: 0,
          topics: [
            {
              topic_id: 'topic_a',
              title: 'T',
              status: 'practising',
              conf: 3,
              strength: 3,
              k_factor: 8.4,
              cards: 0,
              last_reviewed: '2026-08-03T09:00:00Z',
              mastered_at: null,
              drift_history: [],
              review_history: events,
              error_log: [],
            },
          ],
        },
      ],
    };
    const s = emptyStore();
    s.courses.push(course);
    s.exams.push(...exams);

    const counts = recomputeLapseContamination(s);
    const t = s.courses[0]!.sections[0]!.topics[0]!;
    expect(counts.unresolved).toBe(0); // every source_id resolved to an exam
    expect(t.review_history.every((e) => e.smeared === false)).toBe(true);
    expect(t.drift_history.length).toBeGreaterThan(0); // legitimate drift survived
    expect(t.k_factor).not.toBe(CONFIG.DECAY_K); // legitimate tuning survived
  });
});

describe('importBundle migration', () => {
  it('importBundle recomputes contaminated k from an old bundle', () => {
    const s = contaminatedStore();
    const bundle = JSON.stringify({
      kind: 'studyos-export',
      schema_version: '3.0.0',
      exported_at: '2026-08-08T00:00:00Z',
      store: s,
    });
    const res = importBundle(bundle);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const t = res.store.courses[0]!.sections[0]!.topics[0]!;
      expect(t.k_factor).toBe(CONFIG.DECAY_K);
    }
  });
});
