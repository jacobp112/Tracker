import { describe, expect, it } from 'vitest';
import { mergeInto, testKind } from '@/core/merge';
import { commit, ingest } from '@/core/pipeline';
import { CONFIG } from '@/config/constants';
import { emptyStore, findTopic, type Course, type Store } from '@/domain/types';

function course(): Course {
  return {
    schema_version: '2.0.0',
    course_id: 'course_01J8ZX3K',
    title: 'Calculus I',
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [
      {
        section_id: 'section_01J8ZX9P',
        title: 'Limits',
        order: 0,
        topics: [
          {
            topic_id: 'topic_01J8ZXA1',
            title: 'Chain rule',
            status: 'not_started',
            conf: 1,
            strength: 0,
            k_factor: 8.4,
            cards: 0,
            last_reviewed: null,
            mastered_at: null,
            drift_history: [],
            review_history: [],
            error_log: [],
          },
        ],
      },
    ],
  };
}

function storeWith(): Store {
  return { ...emptyStore(), courses: [course()] };
}

const SESSION = JSON.stringify({
  schema_version: '2.0.0',
  session_id: 'session_01J8ZXAA',
  course_id: 'course_01J8ZX3K',
  date: '2026-07-14T18:00:00Z',
  duration_minutes: 45,
  topics_covered: [
    {
      topic_id: 'topic_01J8ZXA1',
      confidence_reported: 4,
      notes: 'Shaky on proofs.',
      errors: [{ error_type: 'conceptual', description: 'Mixed up the definitions.' }],
    },
  ],
});

describe('E2-S4 — atomic commit', () => {
  it('does not mutate the original store (partial writes impossible)', () => {
    const store = storeWith();
    const before = structuredClone(store);

    const r = ingest(SESSION, 'session', store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    commit('session', r.value, store, mergeInto);

    // The live store is untouched until the caller adopts the draft.
    expect(store).toEqual(before);
  });

  it('leaves the store untouched if the merge throws mid-way', () => {
    const store = storeWith();
    const before = structuredClone(store);

    expect(() =>
      commit('session', { topics_covered: [{ topic_id: 'topic_GHOST' }] }, store, mergeInto),
    ).toThrow();

    expect(store).toEqual(before);
  });

  it('decomposes a session into an append-only ReviewEvent + ErrorLogEntry (Doc 1 §6.3)', () => {
    const store = storeWith();
    const r = ingest(SESSION, 'session', store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const next = commit('session', r.value, store, mergeInto);
    const topic = findTopic(next, 'topic_01J8ZXA1')!;

    expect(topic.review_history).toHaveLength(1);
    const event = topic.review_history[0]!;
    expect(event.kind).toBe('study_review');
    expect(event.source).toBe('session');
    expect(event.source_id).toBe('session_01J8ZXAA');
    expect(event.confidence_reported).toBe(4);
    // study_review events carry no test block (Doc 1 §2.4).
    expect(event.test).toBeUndefined();

    expect(topic.error_log).toHaveLength(1);
    expect(topic.error_log[0]!.resolved).toBe(false);
    expect(topic.error_log[0]!.error_type).toBe('conceptual');
  });
});

describe('course merge — mastered_at normalisation (Doc 1 v0.2.1 §2.3)', () => {
  /**
   * `mastered_at` is engine-managed and optional on input — the §8 course prompt
   * doesn't ask for it. Ingestion must normalise it to null so the stored shape
   * matches the domain type, rather than leaving a required field undefined.
   */
  it('normalises a missing mastered_at to null on ingestion', () => {
    const raw = JSON.parse(JSON.stringify(course()));
    delete raw.sections[0].topics[0].mastered_at;

    const r = ingest(JSON.stringify(raw), 'course', emptyStore());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const next = commit('course', r.value, emptyStore(), mergeInto);
    const topic = findTopic(next, 'topic_01J8ZXA1')!;
    expect(topic.mastered_at).toBeNull();
    expect('mastered_at' in topic).toBe(true);
  });

  it('preserves a mastered_at that is supplied', () => {
    const raw = JSON.parse(JSON.stringify(course()));
    raw.sections[0].topics[0].status = 'mastered';
    raw.sections[0].topics[0].mastered_at = '2026-07-01T00:00:00Z';

    const r = ingest(JSON.stringify(raw), 'course', emptyStore());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const next = commit('course', r.value, emptyStore(), mergeInto);
    expect(findTopic(next, 'topic_01J8ZXA1')!.mastered_at).toBe('2026-07-01T00:00:00Z');
  });
});

describe('testKind — Document 2 §1 pass mark', () => {
  it('passes at exactly the 80% mark, fails below', () => {
    expect(testKind(16, 20)).toBe('test_pass'); // exactly 0.80
    expect(testKind(15.9, 20)).toBe('test_fail');
    expect(testKind(20, 20)).toBe('test_pass');
    expect(testKind(0, 20)).toBe('test_fail');
  });

  it('uses the configured constant, not an inline literal', () => {
    expect(CONFIG.TEST_PASS_MARK).toBe(0.8);
  });
});

describe('exam merge — Document 1 §6.3 / Document 2 §4.2', () => {
  const examWithBreakdown = JSON.stringify({
    schema_version: '2.0.0',
    exam_id: 'exam_01J8ZXD5',
    title: 'Midterm 1',
    date: '2026-07-15T10:00:00Z',
    linked_topic_ids: ['topic_01J8ZXA1'],
    score: 11,
    max_score: 20,
    confidence_reported: 4,
    breakdown: [{ topic_id: 'topic_01J8ZXA1', points_earned: 11, points_possible: 20 }],
  });

  it('derives kind and actual_retention from the marks, not from the AI', () => {
    const store = storeWith();
    const r = ingest(examWithBreakdown, 'exam', store);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const next = commit('exam', r.value, store, mergeInto);
    const event = findTopic(next, 'topic_01J8ZXA1')!.review_history[0]!;

    expect(event.kind).toBe('test_fail'); // 11/20 = 0.55 < 0.80
    expect(event.source).toBe('exam');
    expect(event.test).toEqual({ score: 11, out_of: 20, actual_retention: 0.55 });
  });

  it('applies the overall score uniformly when there is no breakdown (§4.2)', () => {
    const store = storeWith();
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD6',
        title: 'Quiz',
        date: '2026-07-15T10:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1'],
        score: 18,
        max_score: 20,
      }),
      'exam',
      store,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const next = commit('exam', r.value, store, mergeInto);
    const event = findTopic(next, 'topic_01J8ZXA1')!.review_history[0]!;

    expect(event.kind).toBe('test_pass'); // 18/20 = 0.90
    expect(event.test!.actual_retention).toBe(0.9);
  });

  it('records the exam itself so the exams screen can list it', () => {
    const store = storeWith();
    const r = ingest(examWithBreakdown, 'exam', store);
    if (!r.ok) throw new Error('expected valid');
    const next = commit('exam', r.value, store, mergeInto);
    expect(next.exams).toHaveLength(1);
  });
});

describe('running merge — Document 1 §5.1', () => {
  it('computes pace on ingestion rather than trusting the input', () => {
    const store = emptyStore();
    // A deliberately wrong pace: it must be recomputed, not preserved.
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        activity_id: 'activity_01J8ZXE1',
        date: '2026-07-14',
        distance_km: 8,
        duration_seconds: 2400,
        pace_sec_per_km: 999,
        type: 'tempo',
      }),
      'running',
      store,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const next = commit('running', r.value, store, mergeInto);
    expect(next.runs[0]!.pace_sec_per_km).toBe(300); // 2400 / 8
  });
});
