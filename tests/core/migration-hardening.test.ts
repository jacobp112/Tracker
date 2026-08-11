import { afterEach, describe, expect, it } from 'vitest';
import { loadStore, saveStore, STORE_KEY, StorageError } from '@/core/storage';
import { exportBundle, importBundle } from '@/core/transfer';
import { commit } from '@/core/pipeline';
import { mergeInto } from '@/core/merge';
import { emptyStore, allTopics, type Store } from '@/domain/types';

afterEach(() => localStorage.clear());

/**
 * Migration hardening (design §P / UPGRADE.md §24) — the "never invent historical
 * evidence" guarantees, pinned as regression guards across the 3.2.0 → 4.0.0 jump.
 */

function legacy32(): Record<string, unknown> {
  return {
    schema_version: '3.2.0',
    courses: [{
      schema_version: '3.2.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
      sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
        topic_id: 'topic_a', title: 'T', status: 'practising', conf: 3, strength: 1, k_factor: 8.4, cards: 0,
        last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null, drift_history: [],
        review_history: [{ event_id: 'event_1', date: '2026-08-01T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 'session_1', confidence_reported: 3 }],
        error_log: [{ error_id: 'error_1', date: '2026-08-01T00:00:00.000Z', source: 'session', source_id: 'session_1', error_type: 'conceptual', description: 'old mistake', resolved: false, resolved_date: null }],
      }] }],
    }],
    exams: [],
    sessions: [],
  };
}

describe('never invent historical evidence', () => {
  it('a 3.2.0 store loads forward without inventing new fields on legacy records', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(legacy32()));
    const store = loadStore();

    expect(store.schema_version).toBe('4.0.0');
    expect(store.error_patterns).toEqual([]);   // not fabricated from old occurrences
    expect(store.assessment_refs).toEqual([]);

    const topic = store.courses[0]!.sections[0]!.topics[0]!;
    const event = topic.review_history[0]!;
    expect(event.provenance).toBeUndefined();     // no provenance invented
    expect(event.assessment_ref).toBeUndefined();
    expect(event.assessment).toBeUndefined();

    const error = topic.error_log[0]!;
    expect(error.pattern_id).toBeUndefined();      // old errors are NOT auto-clustered
    expect(error.severity).toBeUndefined();
  });

  it('a legacy breakdown-less exam still SMEARS (granularity is not invented for old results)', () => {
    // Seed the store with the legacy course, then ingest an aggregate exam.
    const base = loadStoreFrom(legacy32());
    const examJson = JSON.stringify({
      schema_version: '4.0.0', exam_id: 'exam_1', title: 'Mock', date: '2026-08-05T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 3, max_score: 10, // no breakdown → smeared
    });
    const next = commit('exam', JSON.parse(examJson), base, mergeInto);
    const topic = allTopics(next).find((t) => t.topic.topic_id === 'topic_a')!.topic;
    const examEvent = topic.review_history.find((e) => e.source === 'exam')!;
    expect(examEvent.smeared).toBe(true);
  });

  it('refuses to load a store from a NEWER schema version rather than down-converting', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...legacy32(), schema_version: '5.0.0' }));
    expect(() => loadStore()).toThrow(StorageError);
  });
});

describe('backup round-trip preserves the new collections', () => {
  it('error_patterns and assessment_refs survive export → import', () => {
    const store: Store = {
      ...emptyStore(),
      error_patterns: [{ pattern_id: 'pattern_1', signature: 'sig', error_type: 'conceptual', topic_ids: ['topic_a'], severity: 'high', occurrence_ids: ['error_1'], first_seen: '2026-08-01T00:00:00.000Z', last_seen: '2026-08-02T00:00:00.000Z' }],
      assessment_refs: [{ assessment_id: 'assessment_1', title: 'Paper', provenance: 'past_paper', topic_ids: ['topic_a'], max_marks: 75, created_at: '2026-08-15T00:00:00.000Z' }],
    };
    const res = importBundle(exportBundle(store));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.store.error_patterns).toHaveLength(1);
      expect(res.store.assessment_refs).toHaveLength(1);
    }
  });
});

// Helper: hydrate a store object through the load path (migration) from a raw object.
function loadStoreFrom(raw: Record<string, unknown>): Store {
  localStorage.setItem(STORE_KEY, JSON.stringify(raw));
  const s = loadStore();
  localStorage.clear();
  saveStore(s);
  return s;
}
