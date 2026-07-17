import { describe, expect, it } from 'vitest';
import { activityFeed, globalDueQueue, overallMastery, studyStreak, weeklyVolume } from '@/engine/overview';
import { emptyStore, type Course, type ReviewEvent, type Store, type Topic } from '@/domain/types';

const NOW = new Date('2026-07-17T12:00:00Z');

function ev(dateISO: string, sourceId: string): ReviewEvent {
  return {
    event_id: `event_${sourceId}_${dateISO}`,
    date: dateISO,
    kind: 'study_review',
    source: 'session',
    source_id: sourceId,
    confidence_reported: 4,
  };
}

function topic(id: string, over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id,
    title: id,
    status: 'practising',
    conf: 3,
    strength: 1,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: '2026-07-10T12:00:00Z',
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
    ...over,
  };
}

function course(id: string, topics: Topic[]): Course {
  return {
    schema_version: '2.0.0',
    course_id: id,
    title: id,
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [{ section_id: `section_${id}`, title: 'S', order: 0, topics }],
  };
}

function storeWith(over: Partial<Store>): Store {
  return { ...emptyStore(), ...over };
}

describe('E7-S1 — overall mastery (replaces next-exam)', () => {
  it('is mastered ÷ total across all courses', () => {
    const s = storeWith({
      courses: [
        course('c1', [topic('t1', { status: 'mastered' }), topic('t2')]),
        course('c2', [topic('t3', { status: 'mastered' }), topic('t4')]),
      ],
    });
    expect(overallMastery(s)).toEqual({ pct: 50, mastered: 2, total: 4 });
  });

  it('is 0/0 for an empty store without dividing by zero', () => {
    expect(overallMastery(emptyStore())).toEqual({ pct: 0, mastered: 0, total: 0 });
  });
});

describe('E7-S1 — study streak', () => {
  const dayISO = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

  it('counts consecutive days ending today', () => {
    const t = topic('t1', { review_history: [ev(dayISO(0), 's0'), ev(dayISO(1), 's1'), ev(dayISO(2), 's2')] });
    expect(studyStreak(storeWith({ courses: [course('c1', [t])] }), NOW)).toBe(3);
  });

  it('still counts when today has no session but yesterday did', () => {
    const t = topic('t1', { review_history: [ev(dayISO(1), 's1'), ev(dayISO(2), 's2')] });
    expect(studyStreak(storeWith({ courses: [course('c1', [t])] }), NOW)).toBe(2);
  });

  it('breaks on a gap', () => {
    const t = topic('t1', { review_history: [ev(dayISO(0), 's0'), ev(dayISO(3), 's3')] });
    expect(studyStreak(storeWith({ courses: [course('c1', [t])] }), NOW)).toBe(1);
  });

  it('is 0 when the last session is older than yesterday', () => {
    const t = topic('t1', { review_history: [ev(dayISO(5), 's5')] });
    expect(studyStreak(storeWith({ courses: [course('c1', [t])] }), NOW)).toBe(0);
  });
});

describe('E7-S1 — weekly volume', () => {
  it('counts distinct sessions in the last 7 days', () => {
    const dayISO = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
    const t = topic('t1', {
      review_history: [
        ev(dayISO(1), 's1'),
        ev(dayISO(1), 's1'), // same session, another topic → still one
        ev(dayISO(3), 's2'),
        ev(dayISO(10), 's3'), // outside the window
      ],
    });
    expect(weeklyVolume(storeWith({ courses: [course('c1', [t])] }), NOW).sessions).toBe(2);
  });
});

describe('E7-S1 — due queue across all courses', () => {
  it('aggregates due topics from multiple courses, most-decayed first', () => {
    const decayed = (id: string, strength: number) =>
      topic(id, { strength, last_reviewed: '2026-07-05T12:00:00Z' });
    const s = storeWith({
      courses: [course('c1', [decayed('t1', 2)]), course('c2', [decayed('t2', 0.5)])],
    });
    const q = globalDueQueue(s, 5, NOW);
    expect(q[0]!.topic.topic_id).toBe('t2'); // lower strength → more decayed
    expect(q).toHaveLength(2);
  });
});

describe('E7-S1 — unified activity feed', () => {
  it('merges sessions, exams, runs and lifts newest-first', () => {
    const s = storeWith({
      courses: [
        course('c1', [topic('t1', { review_history: [ev('2026-07-14T18:00:00Z', 'session_1')] })]),
      ],
      exams: [
        {
          schema_version: '2.0.0',
          exam_id: 'exam_1',
          title: 'Midterm',
          date: '2026-07-16T10:00:00Z',
          linked_topic_ids: ['t1'],
          score: 8,
          max_score: 10,
        },
      ],
      runs: [
        {
          schema_version: '2.0.0',
          activity_id: 'activity_1',
          date: '2026-07-15',
          distance_km: 5,
          duration_seconds: 1500,
          pace_sec_per_km: 300,
          type: 'easy',
        },
      ],
      lifts: [
        {
          schema_version: '2.0.0',
          session_id: 'session_lift1',
          date: '2026-07-13',
          exercises: [{ exercise_name: 'Squat', sets: [{ set_number: 1, reps: 5, weight_kg: 100 }] }],
        },
      ],
    });

    const feed = activityFeed(s);
    expect(feed.map((f) => f.kind)).toEqual(['exam', 'run', 'session', 'lift']);
  });
});
