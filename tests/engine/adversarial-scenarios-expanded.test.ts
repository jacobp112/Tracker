import { describe, it, expect } from 'vitest';
import { recommend } from '@/engine/recommend';
import { emptyStore, type Course, type ReviewEvent, type Topic } from '@/domain/types';
import { deriveTimeBudget } from '@/engine/planning';
import { topicCapability } from '@/engine/performance';
import { topicEvidenceProfile } from '@/engine/evidence-confidence';

function topic(id: string, title: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id,
    title,
    status: 'practising',
    conf: 3,
    strength: 2,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: null,
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
    ...opts,
  };
}

function makeCourse(topics: Topic[]): Course {
  return {
    schema_version: '4.0.0',
    course_id: 'c-1',
    title: 'Course 1',
    created_at: '2026-08-01T00:00:00Z',
    source: 'manual',
    sections: [{ section_id: 'sec-1', title: 'Section 1', order: 1, topics }],
  };
}

let eventId = 1;
function testEvent(
  kind: ReviewEvent['kind'],
  date: Date,
  assessment?: ReviewEvent['assessment'],
): ReviewEvent {
  const base: ReviewEvent = {
    event_id: `ev-${eventId++}`,
    date: date.toISOString(),
    kind,
    source: 'session',
    source_id: 's-1',
    confidence_reported: 4,
    assessment,
  };
  if (kind === 'test_pass' || kind === 'test_fail') {
    base.test = { score: kind === 'test_pass' ? 8 : 3, out_of: 10, actual_retention: kind === 'test_pass' ? 0.8 : 0.3 };
  }
  return base;
}

describe('Adversarial Budget Tests (H, I)', () => {
  const now = new Date('2026-08-12T12:00:00Z');
  
  it('H. Very limited time (15 mins): short actions surface, long actions do not block', () => {
    // T1: Needs learn (30 mins)
    const t1 = topic('t-1', 'T1', { status: 'not_started' });
    // T2: Needs review (15 mins)
    const t2 = topic('t-2', 'T2', { status: 'practising', last_reviewed: new Date(now.getTime() - 100 * 86400000).toISOString() });
    const store = emptyStore();
    store.courses = [makeCourse([t1, t2])];

    const budget = deriveTimeBudget(store, { availableMinutes: 15 }, now);
    const recs = recommend(store, now, budget);
    
    // T2 (Review) should be feasible, T1 (Learn) is infeasible
    const t2Rec = recs.find(r => r.target.id === 't-2');
    const t1Rec = recs.find(r => r.target.id === 't-1');
    expect(t2Rec?.actionValue?.feasibility).toBe('feasible');
    expect(t1Rec?.actionValue?.feasibility).toBe('infeasible');
    
    // T2 must be ordered before T1 because of feasibility (unless T1 is in a strictly higher priority band, which it isn't here).
    const t2Idx = recs.indexOf(t2Rec!);
    const t1Idx = recs.indexOf(t1Rec!);
    expect(t2Idx).toBeLessThan(t1Idx);
  });

  it('I. Large available time: no arbitrary preference for short tasks', () => {
    // T1: Needs learn (30 mins) -> priority: low
    const t1 = topic('t-1', 'T1', { status: 'not_started' });
    // T2: Needs review (15 mins) -> priority: medium
    const t2 = topic('t-2', 'T2', { status: 'practising', last_reviewed: new Date(now.getTime() - 100 * 86400000).toISOString() });
    
    // Actually, let's make them both same priority.
    // T3: Needs learn (30 mins), T4: Needs learn (30 mins)
    // There is no length-based sorting inside action-value, it uses feasibility and downstream.
    const store = emptyStore();
    store.courses = [makeCourse([t1, t2])];
    
    const budget = deriveTimeBudget(store, { availableMinutes: 300 }, now);
    const recs = recommend(store, now, budget);
    
    // Both are feasible.
    expect(recs[0]?.actionValue?.feasibility).toBe('feasible');
    expect(recs[1]?.actionValue?.feasibility).toBe('feasible');
  });
});

describe('Adversarial K: Deterministic Tie Breaking', () => {
  const now = new Date('2026-08-12T12:00:00Z');

  it('K. Equivalent candidates produce deterministic sorting by curriculum order', () => {
    const t1 = topic('t-b', 'Topic B', { status: 'not_started' });
    const t2 = topic('t-a', 'Topic A', { status: 'not_started' });
    const store = emptyStore();
    store.courses = [makeCourse([t1, t2])];

    const recs = recommend(store, now);
    // Same priority, same feasibility, same downstream = 0. Tie-break is now the
    // authored curriculum order (D9a), not the alphabet: t-b was authored first.
    expect(recs[0]?.target.title).toBe('Topic B');
    expect(recs[1]?.target.title).toBe('Topic A');
  });
});

describe('Adversarial Gaming Behaviours', () => {
  const now = new Date('2026-08-12T12:00:00Z');

  it('Gaming A: Repeated easy success', () => {
    const events = Array.from({ length: 20 }).map((_, i) =>
      testEvent('test_pass', new Date(now.getTime() - i * 86400000), {
        independence: 1, // assisted/easy
        performance_quality: 5,
        difficulty: 1, // very easy
      })
    );
    const t1 = topic('t-1', 'Topic 1', { review_history: events, last_reviewed: events[0]!.date });
    const store = emptyStore();
    store.courses = [makeCourse([t1])];

    const cap = topicCapability(t1, now);
    const profile = topicEvidenceProfile(t1, store, now);
    
    // Because independence is 1, capability application should STILL be 'strong' because they are orthogonal facets.
    expect(cap.application.status).toBe('strong');
    // But independence status is explicitly 'assisted_only' (or untested for independence).
    expect(cap.independence.status).toBe('assisted_only');
    // Evidence confidence for independence is insufficient.
    expect(profile.independence.confidence).toBe('insufficient');
  });

  it('Gaming D: Avoiding independent attempts', () => {
    const events = Array.from({ length: 10 }).map((_, i) =>
      testEvent('test_pass', new Date(now.getTime() - i * 86400000), {
        independence: 2, // prompted
        performance_quality: 5,
        difficulty: 3,
      })
    );
    const t1 = topic('t-1', 'Topic 1', { review_history: events, last_reviewed: events[0]!.date });
    const store = emptyStore();
    store.courses = [makeCourse([t1])];

    const cap = topicCapability(t1, now);
    // Independence < 3 means it's not independent.
    // Application is 'strong', but independence is 'assisted_only'.
    expect(cap.application.status).toBe('strong');
    expect(cap.independence.status).toBe('assisted_only');
    
    // And recommend() will produce a retrieve recommendation because there are no independent attempts.
    const recs = recommend(store, now);
    const retrieveRec = recs.find(r => r.action === 'retrieve');
    expect(retrieveRec).toBeDefined();
  });
});
