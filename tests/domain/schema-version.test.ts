import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, emptyStore } from '@/domain/types';
import { STORE_KEY, loadStore } from '@/core/storage';

afterEach(() => localStorage.clear());

describe('schema version 4.0.0 (assessment domain + IndexedDB)', () => {
  it('the app version is 4.0.0', () => {
    expect(SCHEMA_VERSION).toBe('4.0.0');
    expect(emptyStore().schema_version).toBe('4.0.0');
  });

  it('an empty store carries an error_patterns collection', () => {
    expect(emptyStore().error_patterns).toEqual([]);
  });

  it('a 3.2.0 store (no error-identity fields) loads intact, is stamped current, and gains an empty error_patterns', () => {
    const legacy = {
      schema_version: '3.2.0',
      courses: [
        {
          schema_version: '3.2.0', course_id: 'course_1', title: 'C',
          created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
          sections: [{
            section_id: 'section_1', title: 'S', order: 0,
            topics: [{
              topic_id: 'topic_a', title: 'T', status: 'practising', conf: 3,
              strength: 1, k_factor: 8.4, cards: 0,
              last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
              drift_history: [], review_history: [
                { event_id: 'event_1', date: '2026-08-01T00:00:00.000Z',
                  kind: 'study_review', source: 'session', source_id: 'session_1',
                  confidence_reported: 3 },
              ], error_log: [],
            }],
          }],
        },
      ],
      exams: [],
      sessions: [],
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(legacy));

    const store = loadStore();

    // Stamped to current, error_patterns defaulted, but NO field invented on the
    // historical event/topic (never invent evidence — UPGRADE.md §24). The
    // localStorage shape is unchanged at 4.0.0 — the assessment domain lives in
    // IndexedDB, so a 3.2.0/3.3.0 localStorage store loads verbatim.
    expect(store.schema_version).toBe('4.0.0');
    expect(store.error_patterns).toEqual([]);
    const topic = store.courses[0]!.sections[0]!.topics[0]!;
    expect(topic.prerequisites).toBeUndefined();
    const event = topic.review_history[0]!;
    expect(event.assessment).toBeUndefined();
    expect(event.provenance).toBeUndefined();
    expect(event.assessment_ref).toBeUndefined();
    expect(topic.error_log).toEqual([]);
    expect(store.courses).toHaveLength(1);
  });

  it('a 3.3.0 store with existing error_patterns preserves them on load', () => {
    const withPatterns = {
      ...emptyStore(),
      error_patterns: [
        {
          pattern_id: 'pattern_1', signature: 'sign-error-neg-mult', error_type: 'conceptual',
          topic_ids: ['topic_a'], severity: 'high', occurrence_ids: ['error_1'],
          first_seen: '2026-08-01T00:00:00.000Z', last_seen: '2026-08-02T00:00:00.000Z',
        },
      ],
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(withPatterns));

    const store = loadStore();
    expect(store.error_patterns).toHaveLength(1);
    expect(store.error_patterns[0]!.pattern_id).toBe('pattern_1');
  });
});
