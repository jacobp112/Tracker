import { describe, it, expect } from 'vitest';
import { shortestPathDistance, downstreamWithDistance } from '@/engine/graph';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * Phase 1 Tasks 2–3 — real shortest-path distance on the prerequisite DAG
 * (workflow.md §4.1/§35.2/§47). Edge (p -> t) exists when p ∈ t.prerequisites.
 */

function t(id: string, prerequisites: string[] = []): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites };
}
// chain A -> B -> C -> D -> E  (A is prerequisite of B, ...)
function chain(): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics: [
      t('A'), t('B', ['A']), t('C', ['B']), t('D', ['C']), t('E', ['D']) ]}] };
  return { ...emptyStore(), courses: [c] };
}

describe('shortestPathDistance (ancestor -> descendant)', () => {
  const s = chain();
  it('direct prerequisite is distance 1', () => expect(shortestPathDistance('A', 'B', s)).toBe(1));
  it('depth-2 ancestor', () => expect(shortestPathDistance('A', 'C', s)).toBe(2));
  it('depth-3 ancestor', () => expect(shortestPathDistance('A', 'D', s)).toBe(3));
  it('depth-4 ancestor', () => expect(shortestPathDistance('A', 'E', s)).toBe(4));
  it('same node is 0', () => expect(shortestPathDistance('A', 'A', s)).toBe(0));
  it('unreachable is null', () => expect(shortestPathDistance('E', 'A', s)).toBeNull());
});

describe('downstreamWithDistance', () => {
  it('reports each descendant once at its shortest distance', () => {
    const out = downstreamWithDistance('A', chain());
    const byId = new Map(out.map((x) => [x.topic.topic_id, x.distance]));
    expect(byId.get('B')).toBe(1);
    expect(byId.get('C')).toBe(2);
    expect(byId.get('E')).toBe(4);
    expect(byId.has('A')).toBe(false);
  });
});
