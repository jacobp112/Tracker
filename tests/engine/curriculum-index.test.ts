import { describe, it, expect } from 'vitest';
import { curriculumIndex } from '@/engine/graph';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * Phase 1 Task 4 — course-relative authored-order key (workflow.md D9a,
 * watch-item #1: a global counter would make Course 1 always outrank Course 2).
 */

function t(id: string): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
}
function course(id: string, topicIds: [string, string]): Course {
  return { schema_version: '4.0.0', course_id: id, title: id,
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated', sections: [
      { section_id: `${id}_number`, title: 'Number', order: 0, topics: [t(topicIds[0])] },
      { section_id: `${id}_algebra`, title: 'Algebra', order: 1, topics: [t(topicIds[1])] } ] };
}

describe('curriculumIndex', () => {
  it('orders by section.order then topic position within a course', () => {
    const s: Store = { ...emptyStore(), courses: [course('c1', ['n1', 'a1'])] };
    const idx = curriculumIndex(s);
    expect(idx.get('n1')!).toBeLessThan(idx.get('a1')!);
  });
  it('is course-relative: the first topic of each course shares the same index (no Course-1 bias)', () => {
    const s: Store = { ...emptyStore(), courses: [course('c1', ['n1', 'a1']), course('c2', ['n2', 'a2'])] };
    const idx = curriculumIndex(s);
    expect(idx.get('n1')).toBe(idx.get('n2'));
    expect(idx.get('a1')).toBe(idx.get('a2'));
  });
});
