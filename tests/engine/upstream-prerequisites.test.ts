import { describe, expect, it } from 'vitest';
import { upstreamPrerequisites } from '@/engine/prerequisites';
import { emptyStore, type Store, type Topic } from '@/domain/types';

function topic(id: string, prerequisites?: string[]): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [],
    ...(prerequisites ? { prerequisites } : {}),
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

const ids = (r: { topic: Topic; depth: number }[]) => r.map((u) => [u.topic.topic_id, u.depth]);

describe('upstreamPrerequisites', () => {
  it('returns direct prerequisites at depth 1', () => {
    const c = topic('topic_c', ['topic_a', 'topic_b']);
    const store = storeOf(c, topic('topic_a'), topic('topic_b'));
    expect(ids(upstreamPrerequisites(c, store)).sort()).toEqual([['topic_a', 1], ['topic_b', 1]]);
  });

  it('walks transitively: A→B→C gives B at depth 1 and A at depth 2', () => {
    const c = topic('topic_c', ['topic_b']);
    const b = topic('topic_b', ['topic_a']);
    const store = storeOf(c, b, topic('topic_a'));
    expect(ids(upstreamPrerequisites(c, store))).toEqual([['topic_b', 1], ['topic_a', 2]]);
  });

  it('is cycle-safe: a cyclic graph terminates and visits each ancestor once', () => {
    // topic_x → A; A → B; B → A  (A↔B cycle upstream of X)
    const x = topic('topic_x', ['topic_a']);
    const a = topic('topic_a', ['topic_b']);
    const b = topic('topic_b', ['topic_a']);
    const result = upstreamPrerequisites(x, storeOf(x, a, b));
    expect(ids(result)).toEqual([['topic_a', 1], ['topic_b', 2]]); // each once, no hang
  });

  it('skips an unresolvable prerequisite id silently', () => {
    const c = topic('topic_c', ['topic_a', 'topic_missing']);
    const store = storeOf(c, topic('topic_a'));
    expect(ids(upstreamPrerequisites(c, store))).toEqual([['topic_a', 1]]);
  });

  it('returns [] for a topic with no prerequisites', () => {
    const c = topic('topic_c');
    expect(upstreamPrerequisites(c, storeOf(c))).toEqual([]);
  });
});
