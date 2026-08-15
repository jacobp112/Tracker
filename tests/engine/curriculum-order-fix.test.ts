import { describe, it, expect } from 'vitest';
import { curriculumPosition } from '@/engine/planning';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * Phase 1 Task 5 — REGRESSION (workflow §48 "Regression Tests").
 *
 * Promoted from the debugging reproduction: a prereq-less GCSE course was
 * recommending "Algebra Basics" ahead of "Number" because the eligible sort fell
 * back to ALPHABETICAL. It must now follow curriculum order, while a genuine
 * DIRECT unmastered prerequisite still hard-blocks its dependent (workflow §6).
 */

function t(id: string, title: string, prerequisites: string[] = []): Topic {
  return { topic_id: id, title, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites };
}
function gcse(prereqs: boolean): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'GCSE Maths',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated', sections: [
      { section_id: 'number', title: 'Number', order: 0, topics: [
        t('integers', 'Integers'), t('fractions', 'Fractions') ] },
      { section_id: 'algebra', title: 'Algebra', order: 1, topics: [
        t('algebra_basics', 'Algebra Basics', prereqs ? ['integers'] : []) ] } ] };
  return { ...emptyStore(), courses: [c] };
}

describe('REGRESSION — learn-next respects curriculum order (was: alphabetical)', () => {
  it('with no prerequisites, Number precedes Algebra (not alphabetical)', () => {
    const order = curriculumPosition(gcse(false)).suggestedOrder;
    expect(order.indexOf('integers')).toBeLessThan(order.indexOf('algebra_basics'));
  });

  it('a direct unmastered prerequisite still blocks its dependent', () => {
    const pos = curriculumPosition(gcse(true));
    expect(pos.suggestedOrder).not.toContain('algebra_basics');
    expect(pos.blockedTopics.map((b) => b.topicId)).toContain('algebra_basics');
  });
});
