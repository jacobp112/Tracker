import { describe, expect, it } from 'vitest';
import { downstreamDependents } from '@/engine/prerequisites';
import type { Course, Store, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';

/**
 * Phase 2 — foundationality is the INVERSE of the prerequisite graph: how many
 * topics (transitively) depend on this one. upstreamPrerequisites walks ancestors;
 * downstreamDependents walks descendants.
 */

function topic(id: string, prerequisites?: string[]): Topic {
  return {
    topic_id: id, title: id, status: 'learning', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [],
    ...(prerequisites ? { prerequisites } : {}),
  };
}

function storeWith(topics: Topic[]): Store {
  const course: Course = {
    schema_version: '3.3.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  return s;
}

describe('downstreamDependents', () => {
  it('finds direct and transitive dependents (B needs A, C needs B → A has {B,C})', () => {
    const s = storeWith([topic('topic_a'), topic('topic_b', ['topic_a']), topic('topic_c', ['topic_b'])]);
    const ids = downstreamDependents('topic_a', s).map((t) => t.topic_id).sort();
    expect(ids).toEqual(['topic_b', 'topic_c']);
  });

  it('a leaf that nothing depends on has no dependents', () => {
    const s = storeWith([topic('topic_a'), topic('topic_b', ['topic_a'])]);
    expect(downstreamDependents('topic_b', s)).toEqual([]);
  });

  it('is cycle-safe and visits each dependent once', () => {
    const s = storeWith([topic('topic_a', ['topic_b']), topic('topic_b', ['topic_a'])]);
    expect(downstreamDependents('topic_a', s).map((t) => t.topic_id)).toEqual(['topic_b']);
  });
});
