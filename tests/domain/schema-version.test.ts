import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, emptyStore } from '@/domain/types';
import { STORE_KEY, loadStore } from '@/core/storage';

afterEach(() => localStorage.clear());

describe('schema version 3.2.0 (Performance contract)', () => {
  it('the app version is 3.2.0', () => {
    expect(SCHEMA_VERSION).toBe('3.2.0');
    expect(emptyStore().schema_version).toBe('3.2.0');
  });

  it('a 3.1.0 store (no assessment / prerequisites fields) loads intact and is stamped current', () => {
    const legacy = {
      schema_version: '3.1.0',
      courses: [
        {
          schema_version: '3.1.0', course_id: 'course_1', title: 'C',
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

    // Stamped to current, but no field invented on the historical event/topic.
    expect(store.schema_version).toBe('3.2.0');
    const topic = store.courses[0]!.sections[0]!.topics[0]!;
    expect(topic.prerequisites).toBeUndefined();
    expect(topic.review_history[0]!.assessment).toBeUndefined();
    expect(store.courses).toHaveLength(1);
  });
});
