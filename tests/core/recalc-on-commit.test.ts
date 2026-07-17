import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/config/constants';
import { mergeInto } from '@/core/merge';
import { commit, ingest } from '@/core/pipeline';
import { emptyStore, findTopic, type Course, type Store } from '@/domain/types';

/**
 * E4-S6: "on commit, triggers E3-S3 recalculation for each covered topic".
 * E3-S3: "One code path" — merge must go through the engine, never append to
 * review_history by hand.
 */

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
            status: 'practising',
            conf: 2,
            strength: 1.0,
            k_factor: 7.0,
            cards: 0,
            last_reviewed: '2026-07-01T12:00:00Z',
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

const storeWith = (): Store => ({ ...emptyStore(), courses: [course()] });

function logSession(store: Store, confidence: number) {
  const r = ingest(
    JSON.stringify({
      schema_version: '2.0.0',
      session_id: 'session_01J8ZXAA',
      course_id: 'course_01J8ZX3K',
      date: '2026-07-14T18:00:00Z',
      duration_minutes: 45,
      topics_covered: [{ topic_id: 'topic_01J8ZXA1', confidence_reported: confidence }],
    }),
    'session',
    store,
  );
  if (!r.ok) throw new Error(`expected valid: ${JSON.stringify(r.errors)}`);
  return commit('session', r.value, store, mergeInto);
}

describe('E4-S6 — committing a session runs the engine', () => {
  it('grows strength by the Document 2 §3 increment for the reported confidence', () => {
    const next = logSession(storeWith(), 4);
    const topic = findTopic(next, 'topic_01J8ZXA1')!;
    // 1.0 + 1.0 (conf 4–5 → CONF_HIGH)
    expect(topic.strength).toBe(1.0 + CONFIG.STRENGTH_GAIN.CONF_HIGH);
  });

  it('uses the low-confidence increment for conf ≤ 2', () => {
    const next = logSession(storeWith(), 1);
    expect(findTopic(next, 'topic_01J8ZXA1')!.strength).toBe(1.0 + CONFIG.STRENGTH_GAIN.CONF_LOW);
  });

  it('stamps last_reviewed to the session date, restarting the decay curve', () => {
    const next = logSession(storeWith(), 4);
    expect(findTopic(next, 'topic_01J8ZXA1')!.last_reviewed).toBe('2026-07-14T18:00:00Z');
  });

  it("updates the topic's confidence to what was reported", () => {
    const next = logSession(storeWith(), 5);
    expect(findTopic(next, 'topic_01J8ZXA1')!.conf).toBe(5);
  });

  it('appends exactly one event — not one from merge and one from the engine', () => {
    const next = logSession(storeWith(), 4);
    expect(findTopic(next, 'topic_01J8ZXA1')!.review_history).toHaveLength(1);
  });
});

describe('E5-S2 — an exam drives drift and kFactor through the same path', () => {
  function logExam(store: Store, earned: number) {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD5',
        title: 'Midterm',
        date: '2026-07-14T18:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1'],
        score: earned,
        max_score: 20,
        confidence_reported: 4,
      }),
      'exam',
      store,
    );
    if (!r.ok) throw new Error('expected valid');
    return commit('exam', r.value, store, mergeInto);
  }

  it('records a drift sample from a test, unlike a study review', () => {
    const afterExam = logExam(storeWith(), 6);
    expect(findTopic(afterExam, 'topic_01J8ZXA1')!.drift_history).toHaveLength(1);

    const afterSession = logSession(storeWith(), 4);
    expect(findTopic(afterSession, 'topic_01J8ZXA1')!.drift_history).toHaveLength(0);
  });

  it('applies the test-pass strength increment on a pass', () => {
    const next = logExam(storeWith(), 18); // 90% ≥ 80%
    const topic = findTopic(next, 'topic_01J8ZXA1')!;
    expect(topic.review_history[0]!.kind).toBe('test_pass');
    expect(topic.strength).toBe(1.0 + CONFIG.STRENGTH_GAIN.TEST_PASS);
  });

  it('applies the much smaller test-fail increment on a fail', () => {
    const next = logExam(storeWith(), 6); // 30% < 80%
    const topic = findTopic(next, 'topic_01J8ZXA1')!;
    expect(topic.review_history[0]!.kind).toBe('test_fail');
    expect(topic.strength).toBe(1.0 + CONFIG.STRENGTH_GAIN.TEST_FAIL);
  });

  it('does not tune k_factor from a single sample (DRIFT_MIN is 3)', () => {
    const next = logExam(storeWith(), 6);
    expect(findTopic(next, 'topic_01J8ZXA1')!.k_factor).toBe(7.0);
  });

  it('logs the exam errors against the topic', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD6',
        title: 'Midterm',
        date: '2026-07-14T18:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1'],
        score: 6,
        max_score: 20,
        breakdown: [
          {
            topic_id: 'topic_01J8ZXA1',
            points_earned: 6,
            points_possible: 20,
            errors: [{ error_type: 'procedural', description: 'Sign error in chain rule.' }],
          },
        ],
      }),
      'exam',
      storeWith(),
    );
    if (!r.ok) throw new Error('expected valid');
    const next = commit('exam', r.value, storeWith(), mergeInto);
    const topic = findTopic(next, 'topic_01J8ZXA1')!;
    expect(topic.error_log).toHaveLength(1);
    expect(topic.error_log[0]!.error_type).toBe('procedural');
    expect(topic.error_log[0]!.source).toBe('exam');
  });
});
