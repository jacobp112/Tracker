import { describe, expect, it } from 'vitest';
import { paletteItems, searchItems, suggestions } from '@/engine/palette';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function topic(id: string, title: string, over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id,
    title,
    status: 'practising',
    conf: 3,
    strength: 1.2,
    k_factor: 7.5,
    cards: 1,
    last_reviewed: '2026-07-01T12:00:00Z',
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
    ...over,
  };
}

function store(): Store {
  const course: Course = {
    schema_version: '2.0.0',
    course_id: 'course_alg0001',
    title: 'Linear Algebra',
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [
      {
        section_id: 'section_vec001',
        title: 'Vectors',
        order: 0,
        topics: [topic('topic_eig00001', 'Eigenvalues'), topic('topic_dot00001', 'Dot product')],
      },
    ],
  };
  return { ...emptyStore(), courses: [course] };
}

const NOW = new Date('2026-07-17T12:00:00Z');
const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe('palette — the corpus', () => {
  it('offers every topic, its course, and the main screens', () => {
    const items = paletteItems(store(), NOW);
    const all = labels(items);

    expect(all).toContain('Eigenvalues');
    expect(all).toContain('Dot product');
    expect(all).toContain('Linear Algebra');
    expect(all).toContain('Overview');
    expect(all).toContain('Settings');
  });

  it('tells you which course a topic belongs to, so same-named topics are distinguishable', () => {
    const item = paletteItems(store(), NOW).find((i) => i.label === 'Eigenvalues');
    expect(item?.hint).toBe('Linear Algebra');
  });

  it('routes a topic to its course dashboard', () => {
    const item = paletteItems(store(), NOW).find((i) => i.label === 'Eigenvalues');
    expect(item?.target).toEqual({ type: 'route', hash: '#/course/course_alg0001' });
  });

  it('still offers actions and screens when there is no data at all', () => {
    const all = labels(paletteItems(emptyStore(), NOW));
    expect(all).toContain('Add a course');
    expect(all).toContain('Overview');
  });

  it('gives every item a unique id', () => {
    const ids = paletteItems(store(), NOW).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('palette — searching', () => {
  const items = paletteItems(store(), NOW);

  it('matches case-insensitively on a partial word', () => {
    expect(labels(searchItems(items, 'eig'))).toContain('Eigenvalues');
    expect(labels(searchItems(items, 'EIG'))).toContain('Eigenvalues');
  });

  it('ranks a prefix match above a mid-word match', () => {
    const results = labels(searchItems(items, 'dot'));
    expect(results[0]).toBe('Dot product');
  });

  it('matches a word inside the label, not just the start', () => {
    expect(labels(searchItems(items, 'product'))).toContain('Dot product');
  });

  it('finds a topic by its course name via the hint', () => {
    expect(labels(searchItems(items, 'linear'))).toContain('Linear Algebra');
  });

  it('returns nothing for a query that matches nothing — never a silent full list', () => {
    expect(searchItems(items, 'zzzznope')).toEqual([]);
  });

  it('ignores surrounding whitespace', () => {
    expect(labels(searchItems(items, '  eig  '))).toContain('Eigenvalues');
  });

  it('returns the full corpus for an empty query', () => {
    expect(searchItems(items, '')).toHaveLength(items.length);
  });
});

describe('palette — suggestions before you type', () => {
  it('leads with topics that are due for review', () => {
    // Long-untouched topic: decayed well below the due threshold by NOW.
    const s = store();
    s.courses[0]!.sections[0]!.topics[0] = topic('topic_eig00001', 'Eigenvalues', {
      last_reviewed: '2026-01-01T12:00:00Z',
      strength: 0.4,
    });

    const items = suggestions(s, NOW);
    expect(items[0]?.group).toBe('Due for review');
    expect(labels(items)).toContain('Eigenvalues');
  });

  it('always offers actions, even when nothing is due', () => {
    const items = suggestions(emptyStore(), NOW);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.group === 'Actions')).toBe(true);
  });

  it('never suggests more than a scannable handful of due topics', () => {
    const due = suggestions(store(), NOW).filter((i) => i.group === 'Due for review');
    expect(due.length).toBeLessThanOrEqual(5);
  });
});
