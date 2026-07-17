import { describe, expect, it } from 'vitest';
import { mergeInto } from '@/core/merge';
import { commit, ingest } from '@/core/pipeline';
import { exportBundle, importBundle } from '@/core/transfer';
import { emptyStore, findTopic, type Course, type Store } from '@/domain/types';

/** Build a realistic store: a course, a logged session, and a logged exam —
 *  so topics carry both session- and exam-derived events. */
function realisticStore(): Store {
  const course: Course = {
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
            strength: 1,
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

  let store: Store = { ...emptyStore(), courses: [course] };

  const session = ingest(
    JSON.stringify({
      schema_version: '2.0.0',
      session_id: 'session_01J8ZXAA',
      course_id: 'course_01J8ZX3K',
      date: '2026-07-10T18:00:00Z',
      duration_minutes: 45,
      topics_covered: [{ topic_id: 'topic_01J8ZXA1', confidence_reported: 4 }],
    }),
    'session',
    store,
  );
  if (!session.ok) throw new Error('session invalid');
  store = commit('session', session.value, store, mergeInto);

  const exam = ingest(
    JSON.stringify({
      schema_version: '2.0.0',
      exam_id: 'exam_01J8ZXD5',
      title: 'Midterm',
      date: '2026-07-14T10:00:00Z',
      linked_topic_ids: ['topic_01J8ZXA1'],
      score: 15,
      max_score: 20,
      confidence_reported: 4,
    }),
    'exam',
    store,
  );
  if (!exam.ok) throw new Error('exam invalid');
  store = commit('exam', exam.value, store, mergeInto);

  return store;
}

describe('E8-S1 — export / import round-trip', () => {
  it('reproduces identical state (export → import into empty)', () => {
    const store = realisticStore();
    const result = importBundle(exportBundle(store));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.store).toEqual(store);
  });

  /**
   * The double-count trap: the bundle carries both the exam object AND the
   * exam-derived events already on the topic. If import re-ran the ingestion
   * merge, applyEvent would fire again and the topic would gain a second exam
   * event (and extra strength). Restore-not-reingest is what prevents this.
   */
  it('does not re-apply exams — the topic keeps exactly its original events', () => {
    const store = realisticStore();
    const before = findTopic(store, 'topic_01J8ZXA1')!;
    expect(before.review_history).toHaveLength(2); // one session + one exam

    const result = importBundle(exportBundle(store));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = findTopic(result.store, 'topic_01J8ZXA1')!;
    expect(after.review_history).toHaveLength(2);
    expect(after.strength).toBe(before.strength);
    expect(after.drift_history).toEqual(before.drift_history);
  });

  it('is idempotent across a second round-trip', () => {
    const store = realisticStore();
    const once = importBundle(exportBundle(store));
    if (!once.ok) throw new Error('first import failed');
    const twice = importBundle(exportBundle(once.store));
    expect(twice.ok).toBe(true);
    if (twice.ok) expect(twice.store).toEqual(store);
  });
});

describe('E8-S1 — import validation (full E2 checks)', () => {
  it('rejects a file that is not a StudyOS export', () => {
    const r = importBundle(JSON.stringify({ some: 'json' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toMatch(/doesn't look like a StudyOS export/i);
  });

  it('rejects non-JSON', () => {
    const r = importBundle('not json at all');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toMatch(/isn't valid JSON/i);
  });

  it('rejects a bundle whose objects fail schema validation', () => {
    const store = realisticStore();
    const bundle = JSON.parse(exportBundle(store));
    bundle.store.courses[0].sections[0].topics[0].conf = 105; // invalid 1–5
    const r = importBundle(JSON.stringify(bundle));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /confidence/i.test(e.message))).toBe(true);
  });

  it('rejects a bundle with a dangling exam reference', () => {
    const store = realisticStore();
    const bundle = JSON.parse(exportBundle(store));
    bundle.store.exams[0].linked_topic_ids = ['topic_ghost0001'];
    const r = importBundle(JSON.stringify(bundle));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /doesn't exist/i.test(e.message))).toBe(true);
  });

  it('imports an empty store cleanly', () => {
    const r = importBundle(exportBundle(emptyStore()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.store).toEqual(emptyStore());
  });
});
