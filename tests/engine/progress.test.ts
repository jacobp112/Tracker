import { describe, expect, it } from 'vitest';
import { retrievable } from '@/engine/progress';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

const NOW = new Date('2026-07-20T12:00:00Z');

function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 't', title: 'T', status: 'practising',
    conf: 4, strength: 3, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: NOW.toISOString(), mastered_at: null,
    drift_history: [], review_history: [], error_log: [],
    ...over,
  };
}

function storeOf(topics: Topic[]): Store {
  const course: Course = {
    schema_version: '2.0.0', course_id: 'c', title: 'C',
    created_at: '2026-07-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }],
  };
  return { ...emptyStore(), courses: [course] };
}

describe('retrievable — live EXP', () => {
  it('is zero on an empty store', () => {
    expect(retrievable(emptyStore(), NOW)).toEqual({ exp: 0, ceiling: 0 });
  });

  it('excludes not_started topics from both exp and ceiling', () => {
    const store = storeOf([topic({ topic_id: 'a' }), topic({ topic_id: 'b', status: 'not_started' })]);
    const { ceiling } = retrievable(store, NOW);
    expect(ceiling).toBe(1);
  });

  it('a topic reviewed today contributes ~1 (retention pinned to 1 at t=0)', () => {
    const { exp, ceiling } = retrievable(storeOf([topic()]), NOW);
    expect(ceiling).toBe(1);
    expect(exp).toBeCloseTo(1, 5);
  });

  it('exp never exceeds ceiling, and falls as time passes with no new events', () => {
    const store = storeOf([topic(), topic({ topic_id: 't2' })]);
    const today = retrievable(store, NOW);
    const laterDate = new Date(NOW.getTime() + 30 * 86_400_000);
    const later = retrievable(store, laterDate);
    expect(today.exp).toBeLessThanOrEqual(today.ceiling);
    expect(later.exp).toBeLessThan(today.exp); // decay
    expect(later.ceiling).toBe(today.ceiling); // ceiling unchanged
  });

  it('clamps a backdated (future last_reviewed) topic to <= ceiling', () => {
    // last_reviewed in the future relative to now → retention would be 1, not >1
    const future = topic({ last_reviewed: new Date(NOW.getTime() + 5 * 86_400_000).toISOString() });
    const { exp, ceiling } = retrievable(storeOf([future]), NOW);
    expect(exp).toBeLessThanOrEqual(ceiling);
  });
});
