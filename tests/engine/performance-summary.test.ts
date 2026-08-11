import { describe, expect, it } from 'vitest';
import { allReviewEvents, courseReviewEvents, sectionReviewEvents, performanceSummary } from '@/engine/performance-view';
import { emptyStore, type Store, type Topic, type ReviewEvent } from '@/domain/types';
import { makeEvent } from './assessment-fixtures';

function topicWith(id: string, events: ReviewEvent[]): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: events, error_log: [],
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

function storeOfSections(): Store {
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [
      { section_id: 'section_1', title: 'Intro', order: 0, topics: [topicWith('topic_a', [makeEvent({ difficulty: 1 })])] },
      { section_id: 'section_2', title: 'Advanced', order: 1, topics: [topicWith('topic_b', [makeEvent({ difficulty: 2 }), makeEvent({ difficulty: 3 })])] },
    ],
  });
  return s;
}

describe('event flattening', () => {
  it('allReviewEvents flattens every topic history across courses', () => {
    const store = storeOf(topicWith('topic_a', [makeEvent({ difficulty: 1 })]), topicWith('topic_b', [makeEvent({ difficulty: 2 }), makeEvent({ difficulty: 3 })]));
    expect(allReviewEvents(store)).toHaveLength(3);
  });
  it('courseReviewEvents scopes to one course (empty for an unknown id)', () => {
    const store = storeOf(topicWith('topic_a', [makeEvent({ difficulty: 1 })]));
    expect(courseReviewEvents(store, 'course_1')).toHaveLength(1);
    expect(courseReviewEvents(store, 'course_missing')).toEqual([]);
  });
  it('sectionReviewEvents scopes to one section within its course', () => {
    const store = storeOfSections();
    expect(sectionReviewEvents(store, 'course_1', 'section_1')).toHaveLength(1);
    expect(sectionReviewEvents(store, 'course_1', 'section_2')).toHaveLength(2);
  });
  it('sectionReviewEvents is empty for an unknown course or section id', () => {
    const store = storeOfSections();
    expect(sectionReviewEvents(store, 'course_missing', 'section_1')).toEqual([]);
    expect(sectionReviewEvents(store, 'course_1', 'section_missing')).toEqual([]);
  });
});

describe('performanceSummary', () => {
  it('bundles every headline; each is null when its data is insufficient', () => {
    const s = performanceSummary([makeEvent({ difficulty: 2 })]); // one bare attempt
    expect(s).toHaveProperty('performanceHealth');
    expect(s.cold).toBeNull();
    expect(s.transfer).toBeNull();
    expect(s.quality).toBeNull();
    expect(s.novelTaskSuccess).toBeNull();
    expect(s.calibration).toBeNull();
  });
  it('surfaces a computed metric when enough data exists', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    expect(performanceSummary(events).transfer!.score).toBeCloseTo(100);
  });
});
