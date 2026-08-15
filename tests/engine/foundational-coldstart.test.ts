import { describe, it, expect } from 'vitest';
import { foundationalRisk } from '@/engine/maut';
import { recommend } from '@/engine/recommend';
import { emptyStore, type Course, type Section, type Store, type Topic } from '@/domain/types';

/**
 * Regression — `u_found` must reflect risk to STARTED progression, not raw graph
 * centrality. Counting unstarted downstream topics turned a fresh multi-section
 * course's ranking into "most-depended-upon first", sending beginners to a
 * later-section hub instead of Section One. Foundational protection for topics
 * underpinning ACTIVE work must be preserved.
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');
function t(id: string, prerequisites: string[] = [], o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites, ...o };
}
function storeOf(sections: Array<{ id: string; order: number; topics: Topic[] }>): Store {
  const course: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'ai_generated',
    sections: sections.map<Section>((s) => ({ section_id: s.id, title: s.id, order: s.order, topics: s.topics })) };
  const st = emptyStore(); st.courses.push(course); return st;
}

describe('foundationalRisk — only started downstream is "at risk"', () => {
  it('is 0 when every downstream topic is not_started (no progression to protect yet)', () => {
    const hub = t('hub');
    const deps = ['d1', 'd2', 'd3'].map((id) => t(id, ['hub']));
    const store = storeOf([{ id: 'sec', order: 0, topics: [hub, ...deps] }]);
    expect(foundationalRisk(hub, store, NOW)).toBe(0);
  });

  it('is > 0 when a STARTED downstream topic is at risk (protects active progression)', () => {
    const hub = t('hub');
    const startedWeak = t('d1', ['hub'], { status: 'learning', strength: 1, last_reviewed: '2026-07-01T00:00:00.000Z' });
    const store = storeOf([{ id: 'sec', order: 0, topics: [hub, startedWeak] }]);
    expect(foundationalRisk(hub, store, NOW)).toBeGreaterThan(0);
  });
});

describe('cold-start recommends Section One first', () => {
  it('does not let a later-section hub outrank the first topic of Section One', () => {
    const number1 = t('number1'); // Section One, leaf
    const number2 = t('number2');
    const hub = t('hub'); // Section Two, prerequisite of 5 (not_started) topics → high graph centrality
    const dependents = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => t(id, ['hub']));
    const store = storeOf([
      { id: 'section_one', order: 0, topics: [number1, number2] },
      { id: 'section_two', order: 1, topics: [hub, ...dependents] },
    ]);
    const learn = recommend(store, NOW).filter((r) => r.action === 'learn').map((r) => r.target.id);
    expect(learn.indexOf('number1')).toBeLessThan(learn.indexOf('hub'));
  });
});
