import { describe, it, expect } from 'vitest';
import { recommend } from '@/engine/recommend';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * Phase 1 Task 6 — the FINAL recommend() ranking must tiebreak same-band
 * candidates by syllabus order, not alphabetically. Otherwise it re-sorts the
 * learn band and undoes the curriculumPosition ordering from Task 5.
 */

function t(id: string, title: string): Topic {
  return { topic_id: id, title, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
}
function store(): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'GCSE Maths',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated', sections: [
      { section_id: 'number', title: 'Number', order: 0, topics: [t('n1', 'Integers')] },
      { section_id: 'algebra', title: 'Algebra', order: 1, topics: [t('a1', 'Algebra Basics')] } ] };
  return { ...emptyStore(), courses: [c] };
}

describe('recommend — learn band ordered by syllabus, not title', () => {
  it('recommends the Number topic before the alphabetically-earlier Algebra topic', () => {
    const learn = recommend(store()).filter((r) => r.action === 'learn').map((r) => r.target.id);
    expect(learn.indexOf('n1')).toBeLessThan(learn.indexOf('a1'));
  });
});
