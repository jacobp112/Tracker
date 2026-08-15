import { describe, it, expect } from 'vitest';
import { deriveTimeBudget, curriculumPosition } from '@/engine/planning';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Exam, type Topic } from '@/domain/types';

function topic(id: string, title: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id,
    title,
    status: 'not_started',
    conf: 3,
    strength: 0,
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
    sections: [
      {
        section_id: 'sec-1',
        title: 'Section 1',
        order: 1,
        topics,
      },
    ],
  };
}

describe('Phase 2 — Time Budget (#18)', () => {
  const now = new Date('2026-08-12T12:00:00Z');

  it('1. returns all nulls when no options provided and no exams exist', () => {
    const store = emptyStore();
    const tb = deriveTimeBudget(store, undefined, now);
    expect(tb.availableMinutes).toBeNull();
    expect(tb.deadline).toBeNull();
    expect(tb.sessionsRemaining).toBeNull();
  });

  it('2. calculates sessionsRemaining for explicit availableMinutes', () => {
    const store = emptyStore();
    const tb = deriveTimeBudget(store, { availableMinutes: 120 }, now);
    expect(tb.availableMinutes).toBe(120);
    expect(tb.deadline).toBeNull();
    // CONFIG.PROGRESS.SESSION_MINUTES is 30 -> 120 / 30 = 4 sessions
    expect(tb.sessionsRemaining).toBe(4);
  });

  it('3. calculates sessionsRemaining for explicit deadline', () => {
    const store = emptyStore();
    const deadline = new Date('2026-08-17T12:00:00Z'); // 5 days away
    const tb = deriveTimeBudget(store, { deadline }, now);
    expect(tb.availableMinutes).toBeNull();
    expect(tb.deadline).toEqual(deadline);
    // V4: sessions, not days — 5 days × DEFAULT_SESSIONS_PER_DAY (2) = 10.
    expect(tb.sessionsRemaining).toBe(5 * CONFIG.DEFAULT_SESSIONS_PER_DAY);
  });

  it('4. infers earliest future exam date as deadline when options not provided', () => {
    const store = emptyStore();
    const pastExam: Exam = {
      schema_version: '4.0.0',
      exam_id: 'ex-1',
      title: 'Past Exam',
      date: '2026-08-01T12:00:00Z',
      linked_topic_ids: [],
      score: 80,
      max_score: 100,
    };
    const futureExam1: Exam = {
      schema_version: '4.0.0',
      exam_id: 'ex-2',
      title: 'Future Exam 1',
      date: '2026-08-20T12:00:00Z', // 8 days away
      linked_topic_ids: [],
      score: 0,
      max_score: 100,
    };
    const futureExam2: Exam = {
      schema_version: '4.0.0',
      exam_id: 'ex-3',
      title: 'Future Exam 2',
      date: '2026-08-25T12:00:00Z',
      linked_topic_ids: [],
      score: 0,
      max_score: 100,
    };
    store.exams = [pastExam, futureExam2, futureExam1];

    const tb = deriveTimeBudget(store, undefined, now);
    expect(tb.deadline).toEqual(new Date('2026-08-20T12:00:00Z'));
    // V4: 8 days × DEFAULT_SESSIONS_PER_DAY (2) = 16 sessions.
    expect(tb.sessionsRemaining).toBe(8 * CONFIG.DEFAULT_SESSIONS_PER_DAY);
  });
});

describe('Phase 2 — Curriculum Position (#20)', () => {
  const now = new Date('2026-08-12T12:00:00Z');

  it('1. identifies eligible unstarted topics with no prerequisites', () => {
    const t1 = topic('t-1', 'Topic 1');
    const t2 = topic('t-2', 'Topic 2');
    const store = emptyStore();
    store.courses = [makeCourse([t1, t2])];

    const cp = curriculumPosition(store, now);
    expect(cp.eligibleTopics).toHaveLength(2);
    expect(cp.blockedTopics).toHaveLength(0);
    expect(cp.suggestedOrder).toHaveLength(2);
  });

  it('2. separates blocked topics when prerequisites are not satisfied', () => {
    const prereq = topic('t-prereq', 'Prerequisite Topic', { status: 'learning' }); // unstable because not practising/mastered
    const dep = topic('t-dep', 'Dependent Topic', { prerequisites: ['t-prereq'] });

    const store = emptyStore();
    store.courses = [makeCourse([prereq, dep])];

    const cp = curriculumPosition(store, now);
    // dep is unstarted and its prerequisite is unstable -> blocked
    expect(cp.blockedTopics).toHaveLength(1);
    expect(cp.blockedTopics[0]!.topicId).toBe('t-dep');
    expect(cp.blockedTopics[0]!.blockingPrerequisites).toContain('t-prereq');
    expect(cp.blockedTopics[0]!.blockingGaps).toContain('unconsolidated_status');
    expect(cp.suggestedOrder).not.toContain('t-dep');
  });

  it('3. unblocks topic when a direct prerequisite reaches mastery ≥ τ_crit', () => {
    // Bounded gating (workflow §6, D4): unblocking is now mastery-based, not
    // status-based. A prerequisite with genuine evidence (health ≥ 70 → L ≥ 0.70)
    // clears the direct gate; bare `status:'practising'` with no evidence would not.
    const prereq = topic('t-prereq', 'Prerequisite Topic', {
      status: 'mastered', strength: 4, conf: 4, last_reviewed: '2026-08-11T12:00:00Z',
      review_history: [{ event_id: 'e', date: '2026-08-11T12:00:00Z', kind: 'test_pass',
        source: 'exam', source_id: 'x', confidence_reported: 4,
        test: { score: 9, out_of: 10, actual_retention: 0.9 } }],
    });
    const dep = topic('t-dep', 'Dependent Topic', { prerequisites: ['t-prereq'] });

    const store = emptyStore();
    store.courses = [makeCourse([prereq, dep])];

    const cp = curriculumPosition(store, now);
    expect(cp.eligibleTopics).toHaveLength(1);
    expect(cp.eligibleTopics[0]!.topicId).toBe('t-dep');
    expect(cp.blockedTopics).toHaveLength(0);
    expect(cp.suggestedOrder).toEqual(['t-dep']);
  });

  it('4. orders eligible topics by downstreamValue descending (foundation topics first)', () => {
    // A -> B -> C
    // D (standalone)
    // A underpins 2 topics (B and C)
    // B underpins 1 topic (C)
    // D underpins 0 topics
    const tA = topic('t-a', 'Foundation A');
    const tB = topic('t-b', 'Intermediate B', { prerequisites: ['t-a'] });
    const tC = topic('t-c', 'Advanced C', { prerequisites: ['t-b'] });
    const tD = topic('t-d', 'Standalone D');

    const store = emptyStore();
    store.courses = [makeCourse([tA, tB, tC, tD])];

    const cp = curriculumPosition(store, now);
    // tB and tC are blocked because tA is not_started
    // Eligible unstarted topics are tA and tD
    // tA has downstreamValue = 2 (tB, tC)
    // tD has downstreamValue = 0
    expect(cp.suggestedOrder).toEqual(['t-a', 't-d']);
    expect(cp.eligibleTopics[0]!.downstreamValue).toBe(2);
    expect(cp.eligibleTopics[1]!.downstreamValue).toBe(0);
  });

  it('5. produces deterministic ordering across multiple runs', () => {
    const t1 = topic('t-1', 'Alpha');
    const t2 = topic('t-2', 'Beta');
    const t3 = topic('t-3', 'Gamma');

    const store = emptyStore();
    store.courses = [makeCourse([t3, t1, t2])];

    const cp1 = curriculumPosition(store, now);
    const cp2 = curriculumPosition(store, now);
    expect(cp1.suggestedOrder).toEqual(cp2.suggestedOrder);
    // D9a: curriculum (authored) order tiebreak, not alphabetical. Topics were
    // authored in the order [t-3, t-1, t-2], so that is the eligible ordering.
    expect(cp1.suggestedOrder).toEqual(['t-3', 't-1', 't-2']);
  });
});
