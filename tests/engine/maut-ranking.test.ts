import { describe, it, expect } from 'vitest';
import { recommend } from '@/engine/recommend';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * Phase 3 Task 3 — continuous MAUT ranking (workflow §13, §23). Urgent memory
 * work must be able to outrank non-urgent novelty, and ranking must be
 * deterministic. This is the behavioural contract that replaces the static
 * priority/action cascade.
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');
function t(id: string, o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...o };
}
function storeOf(topics: Topic[]): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); return s;
}
const rank = (recs: { target: { id: string } }[], id: string) => recs.findIndex((r) => r.target.id === id);

describe('MAUT ranking', () => {
  it('an urgent memory review (R < 0.55) outranks a non-urgent new-topic exploration', () => {
    const urgent = t('urgent', { last_reviewed: '2026-08-01T00:00:00.000Z', strength: 1 }); // deeply decayed → due
    const explore = t('explore', { status: 'not_started', last_reviewed: null }); // fresh, no downstream
    const recs = recommend(storeOf([urgent, explore]), NOW);
    expect(rank(recs, 'urgent')).toBeGreaterThanOrEqual(0);
    expect(rank(recs, 'explore')).toBeGreaterThanOrEqual(0);
    expect(rank(recs, 'urgent')).toBeLessThan(rank(recs, 'explore'));
  });

  it('produces a deterministic order across identical runs', () => {
    const store = storeOf([t('a', { last_reviewed: '2026-08-05T00:00:00.000Z' }),
      t('b', { status: 'not_started', last_reviewed: null }),
      t('c', { last_reviewed: '2026-08-02T00:00:00.000Z' })]);
    const first = recommend(store, NOW).map((r) => r.target.id);
    const second = recommend(store, NOW).map((r) => r.target.id);
    expect(first).toEqual(second);
  });

  it('every recommendation carries a MAUT utility and a session intent', () => {
    const recs = recommend(storeOf([t('a', { last_reviewed: '2026-08-05T00:00:00.000Z' })]), NOW);
    expect(recs.length).toBeGreaterThan(0);
    for (const r of recs) {
      expect(typeof r.maut?.utility).toBe('number');
      expect(r.maut?.intent).toBeDefined();
    }
  });
});
