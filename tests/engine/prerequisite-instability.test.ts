import { describe, expect, it } from 'vitest';
import { prerequisiteInstability, type PrerequisiteReport } from '@/engine/prerequisites';
import { emptyStore, type Store, type Topic } from '@/domain/types';

function topic(id: string, over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'mastered', conf: 5, strength: 20,
    k_factor: 8.4, cards: 5, last_reviewed: '2026-08-10T00:00:00.000Z', mastered_at: '2026-08-05T00:00:00.000Z',
    drift_history: [], review_history: [], error_log: [], ...over,
  };
}

function storeOf(...topics: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  });
  return s;
}

const NOW = new Date('2026-08-10T12:00:00.000Z');
const find = (r: PrerequisiteReport, id: string) => r.upstream.find((u) => u.topic_id === id)!;

describe('prerequisiteInstability', () => {
  it('flags a not_started prerequisite as unstable (upstream not learned)', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, mastered_at: null, strength: 0 });
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').unstable).toBe(true);
  });

  it('flags a weak-health practising prerequisite as unstable', () => {
    // practising with 3 active errors + no cards drives health below 45.
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', {
      status: 'practising', conf: 1, cards: 0, last_reviewed: '2026-07-01T00:00:00.000Z', strength: 0.5,
      error_log: [1, 2, 3].map((n) => ({
        error_id: `error_${n}`, date: '2026-07-01T00:00:00.000Z', source: 'session' as const,
        source_id: 'session_1', error_type: 'conceptual' as const, description: 'x', resolved: false, resolved_date: null,
      })),
    });
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').health).not.toBeNull();
    expect(find(r, 'topic_a').unstable).toBe(true);
  });

  it('flags a decayed (due) prerequisite as unstable', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    // mastered but last reviewed long ago → retention below DUE_THRESHOLD.
    const a = topic('topic_a', { last_reviewed: '2026-01-01T00:00:00.000Z', strength: 1 });
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').retention).not.toBeNull();
    expect(find(r, 'topic_a').unstable).toBe(true);
  });

  it('does NOT flag a solid, recently-reviewed mastered prerequisite', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a'); // mastered, strong, reviewed today
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').unstable).toBe(false);
    expect(r.unstableCount).toBe(0);
  });

  it('carries transitive depth and counts unstable ancestors', () => {
    const c = topic('topic_c', { prerequisites: ['topic_b'] });
    const b = topic('topic_b', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, mastered_at: null, strength: 0 });
    const r = prerequisiteInstability(c, storeOf(c, b, a), NOW);
    expect(find(r, 'topic_a').depth).toBe(2);
    expect(r.unstableCount).toBeGreaterThanOrEqual(1);
  });

  it('INVARIANT: does not mutate the topic or the store (diagnostic only)', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, mastered_at: null, strength: 0 });
    const store = storeOf(c, a);
    const before = JSON.stringify(store);
    const cBefore = JSON.stringify(c);
    prerequisiteInstability(c, store, NOW);
    expect(JSON.stringify(store)).toBe(before);
    expect(JSON.stringify(c)).toBe(cBefore);
  });
});
