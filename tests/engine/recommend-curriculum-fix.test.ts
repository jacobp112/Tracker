import { describe, expect, it } from 'vitest';
import type { ErrorPattern, Store, StudySession, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';
import { recommend } from '@/engine/recommend';
import { buildSessionPlan, evaluateSession } from '@/engine/plan';
import { startSessionPrompt } from '@/engine/session';
import { mergeInto } from '@/core/merge';

function makeTopic(id: string, title: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id,
    title,
    status: 'not_started',
    conf: 3,
    strength: 5.0,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: null,
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
    prerequisites: [],
    ...opts,
  };
}

function makeStore(topics: Topic[], errorPatterns: ErrorPattern[] = []): Store {
  const store = emptyStore();
  store.courses = [
    {
      schema_version: '4.0.0',
      course_id: 'c_math',
      title: 'GCSE Mathematics',
      created_at: '2026-01-01T00:00:00.000Z',
      source: 'manual',
      sections: [
        {
          section_id: 's_algebra',
          title: 'Algebra',
          order: 1,
          topics,
        },
      ],
    },
  ];
  store.error_patterns = errorPatterns;
  return store;
}

describe('Curriculum Progression & Prerequisite Diagnostics Architectural Fix', () => {
  const now = new Date('2026-08-13T12:00:00.000Z');

  it('TEST 1: Mastered/strong topic with insufficient independent evidence does NOT trigger prerequisite intervention', () => {
    const topicA = makeTopic('t_a', 'Linear Equations', {
      status: 'mastered',
      conf: 5,
      strength: 10.0,
      last_reviewed: '2026-08-12T12:00:00.000Z',
      review_history: [
        {
          event_id: 'e1',
          date: '2026-08-12T12:00:00.000Z',
          kind: 'study_review',
          source: 'session',
          source_id: 's1',
          confidence_reported: 5,
        },
      ],
    });

    const topicB = makeTopic('t_b', 'Quadratic Equations', {
      status: 'learning',
      prerequisites: ['t_a'],
    });

    const topicC = makeTopic('t_c', 'Cubic Equations', {
      status: 'not_started',
      prerequisites: ['t_b'],
    });

    const store = makeStore([topicA, topicB, topicC]);
    const recs = recommend(store, now);

    const prereqRec = recs.find((r) => r.action === 'prerequisite' && r.target.id === 't_a');
    expect(prereqRec).toBeUndefined();

    const topRec = recs[0];
    expect(topRec).toBeDefined();
    expect(topRec?.target.id).toBe('t_b');
  });

  it('TEST 2: Genuinely weak prerequisite CAN trigger intervention', () => {
    const topicA = makeTopic('t_a', 'Fractions', {
      status: 'mastered',
      conf: 2,
      strength: 5.0,
      last_reviewed: '2026-08-12T12:00:00.000Z',
    });

    const topicB = makeTopic('t_b', 'Algebraic Fractions', {
      status: 'learning',
      prerequisites: ['t_a'],
      review_history: [
        {
          event_id: 'eb_fail',
          date: '2026-08-13T10:00:00.000Z',
          kind: 'test_fail',
          source: 'session',
          source_id: 'sb',
          confidence_reported: 2,
          test: { score: 2, out_of: 10, actual_retention: 0.2 },
        },
      ],
    });

    const errorPattern: ErrorPattern = {
      pattern_id: 'p_frac',
      signature: 'Fraction addition denominator mismatch',
      error_type: 'conceptual',
      topic_ids: ['t_a', 't_b'],
      severity: 'high',
      occurrence_ids: ['err_1'],
      first_seen: '2026-08-10T00:00:00.000Z',
      last_seen: '2026-08-12T00:00:00.000Z',
    };

    const store = makeStore([topicA, topicB], [errorPattern]);
    const recs = recommend(store, now);

    const topRec = recs[0];
    expect(topRec).toBeDefined();
    expect(['remediate', 'prerequisite'].includes(topRec!.action)).toBe(true);
    expect(['p_frac', 't_a'].includes(topRec!.target.id)).toBe(true);
    expect(['high', 'critical'].includes(topRec!.priority)).toBe(true);
  });

  it('TEST 3: Syllabus with untouched topics progresses rather than auditing prerequisites with low evidence', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'mastered',
      last_reviewed: '2026-08-12T00:00:00.000Z',
      review_history: [{ event_id: 'e1', date: '2026-08-12T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's1', confidence_reported: 5 }],
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'mastered',
      prerequisites: ['t_a'],
      last_reviewed: '2026-08-12T00:00:00.000Z',
      review_history: [{ event_id: 'e2', date: '2026-08-12T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's2', confidence_reported: 5 }],
    });
    const topicC = makeTopic('t_c', 'Topic C', { status: 'not_started', prerequisites: ['t_b'] });

    const store = makeStore([topicA, topicB, topicC]);
    const recs = recommend(store, now);

    expect(recs[0]?.action).toBe('learn');
    expect(recs[0]?.target.id).toBe('t_c');
  });

  it('TEST 4: Prerequisite intervention can resolve and return to interrupted curriculum target', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'learning',
      last_reviewed: '2026-08-12T00:00:00.000Z',
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      review_history: [
        {
          event_id: 'eb_err',
          date: '2026-08-13T09:00:00.000Z',
          kind: 'test_fail',
          source: 'session',
          source_id: 'sb_err',
          confidence_reported: 2,
          test: { score: 2, out_of: 10, actual_retention: 0.2 },
        },
      ],
    });

    const patternA: ErrorPattern = {
      pattern_id: 'p_a',
      signature: 'Misconception in A',
      error_type: 'conceptual',
      topic_ids: ['t_a', 't_b'],
      severity: 'medium',
      occurrence_ids: ['err_a'],
      first_seen: '2026-08-10T00:00:00.000Z',
      last_seen: '2026-08-10T00:00:00.000Z',
    };

    const store = makeStore([topicA, topicB], [patternA]);

    let recs = recommend(store, now);
    // Under MAUT (§13), a MEDIUM-severity root error surfaces as an available
    // corrective action; the failed manifesting topic competes for the very top
    // slot (severity-graded — a HIGH-severity root leads outright, see TEST 10).
    const rootRec = recs.find(
      (r) => (r.target.id === 'p_a' || r.target.id === 't_a') && (r.action === 'remediate' || r.action === 'prerequisite'),
    );
    expect(rootRec).toBeDefined();

    store.error_patterns = store.error_patterns.filter((p) => p.pattern_id !== 'p_a');
    const topicA_ref = store.courses[0]!.sections[0]!.topics.find((t) => t.topic_id === 't_a')!;
    topicA_ref.status = 'mastered';
    topicA_ref.last_reviewed = '2026-08-13T10:00:00.000Z';
    topicA_ref.review_history.push({
      event_id: 'e_fix',
      date: '2026-08-13T10:00:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 's_fix',
      confidence_reported: 5,
    });

    recs = recommend(store, now);
    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
    expect(recs[0]?.target.id).toBe('t_b');
  });

  it('TEST 5: Session requested evidence can actually be produced through normal user workflow', () => {
    const topicA = makeTopic('t_a', 'Vectors', { status: 'learning' });
    const store = makeStore([topicA]);

    const recs = recommend(store, now);
    const learnRec = recs.find((r) => r.target.id === 't_a') ?? recs[0];
    expect(learnRec).toBeDefined();
    if (!learnRec) return;

    const plan = buildSessionPlan(learnRec, store, now);
    expect(plan.expected_evidence).toBeDefined();

    const briefingPrompt = startSessionPrompt(
      {
        topic: { title: topicA.title, sectionTitle: 'Algebra', courseTitle: 'GCSE Math' },
        unresolvedErrors: [],
        siblings: [],
        snapshot: null,
      },
      plan.intent,
      plan.scope,
    );
    expect(briefingPrompt).toContain('INSTRUCTIONS');

    const session: StudySession = {
      schema_version: '4.0.0',
      session_id: 's_test_5',
      course_id: 'c_math',
      date: '2026-08-13T12:30:00.000Z',
      duration_minutes: 25,
      topics_covered: [
        {
          topic_id: 't_a',
          confidence_reported: 5,
          notes: 'Mastered vector addition independently',
          assessment: {
            independence: 3,
            performance_quality: 5,
          },
        },
      ],
    };

    mergeInto(store, 'session', session);

    const evalResult = evaluateSession(plan, store, now);
    expect(evalResult.met).toBe(true);
    expect(evalResult.satisfied.length).toBeGreaterThan(0);
  });

  it('TEST 6: Evidence from completed session affects next recommendation appropriately', () => {
    const topicA = makeTopic('t_a', 'Topic A', { status: 'not_started' });
    const topicB = makeTopic('t_b', 'Topic B', { status: 'not_started', prerequisites: ['t_a'] });
    const store = makeStore([topicA, topicB]);

    let recs = recommend(store, now);
    expect(recs[0]?.target.id).toBe('t_a');

    const session: StudySession = {
      schema_version: '4.0.0',
      session_id: 's_6',
      course_id: 'c_math',
      date: '2026-08-13T12:00:00.000Z',
      duration_minutes: 30,
      topics_covered: [{ topic_id: 't_a', confidence_reported: 4 }],
    };
    mergeInto(store, 'session', session);

    const topicA_ref = store.courses[0]!.sections[0]!.topics.find((t) => t.topic_id === 't_a')!;
    topicA_ref.status = 'mastered';

    recs = recommend(store, now);
    expect(recs[0]?.target.id).toBe('t_b');
  });

  it('TEST 7: Successful session does not repeatedly recommend exactly the same work', () => {
    const topicA = makeTopic('t_a', 'Topic A', { status: 'not_started' });
    const topicB = makeTopic('t_b', 'Topic B', { status: 'not_started', prerequisites: ['t_a'] });
    const store = makeStore([topicA, topicB]);

    const rec1 = recommend(store, now)[0];
    expect(rec1?.target.id).toBe('t_a');

    const session: StudySession = {
      schema_version: '4.0.0',
      session_id: 's_7',
      course_id: 'c_math',
      date: '2026-08-13T12:00:00.000Z',
      duration_minutes: 30,
      topics_covered: [{ topic_id: 't_a', confidence_reported: 4 }],
    };
    mergeInto(store, 'session', session);
    store.courses[0]!.sections[0]!.topics[0]!.status = 'mastered';

    const rec2 = recommend(store, now)[0];
    expect(rec2?.target.id).not.toBe('t_a');
    expect(rec2?.target.id).toBe('t_b');
  });

  it('TEST 8: Existing prerequisite relationships still constrain invalid progression', () => {
    const topicA = makeTopic('t_a', 'Foundational Arithmetic', { status: 'not_started' });
    const topicB = makeTopic('t_b', 'Calculus', { status: 'not_started', prerequisites: ['t_a'] });

    const store = makeStore([topicA, topicB]);
    const recs = recommend(store, now);

    const learnB = recs.find((r) => r.target.id === 't_b' && r.action === 'learn');
    expect(learnB).toBeUndefined();

    expect(recs[0]?.target.id).toBe('t_a');
  });

  it('TEST 9: Learner can progress A -> B -> C without arbitrary evidence quotas forcing endless repetition of A', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'mastered',
      last_reviewed: '2026-08-12T12:00:00.000Z',
      review_history: [{ event_id: 'e_a', date: '2026-08-12T12:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's_a', confidence_reported: 5 }],
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'mastered',
      prerequisites: ['t_a'],
      last_reviewed: '2026-08-12T12:00:00.000Z',
      review_history: [{ event_id: 'e_b', date: '2026-08-12T12:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's_b', confidence_reported: 5 }],
    });
    const topicC = makeTopic('t_c', 'Topic C', { status: 'not_started', prerequisites: ['t_b'] });

    const store = makeStore([topicA, topicB, topicC]);
    const recs = recommend(store, now);

    expect(recs[0]?.action).toBe('learn');
    expect(recs[0]?.target.id).toBe('t_c');
  });

  it('TEST 10 (CRITICAL): End-to-end adaptive repair workflow: A -> B -> (B fails due to A) -> targeted A repair -> return to B -> B succeeds -> C', () => {
    const topicA = makeTopic('t_a', 'Basic Integration', {
      status: 'mastered',
      conf: 4,
      strength: 5.0,
      last_reviewed: '2026-08-12T00:00:00.000Z',
      review_history: [{ event_id: 'e_a0', date: '2026-08-12T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's0', confidence_reported: 5 }],
    });

    const topicB = makeTopic('t_b', 'Integration by Parts', {
      status: 'learning',
      prerequisites: ['t_a'],
      last_reviewed: '2026-08-12T00:00:00.000Z',
      review_history: [{ event_id: 'e_b0', date: '2026-08-12T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's00', confidence_reported: 4 }],
    });

    const topicC = makeTopic('t_c', 'Differential Equations', {
      status: 'not_started',
      prerequisites: ['t_b'],
    });

    const store = makeStore([topicA, topicB, topicC]);

    let recs = recommend(store, now);
    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
    expect(recs[0]?.target.id).toBe('t_b');

    // B experiences failure attributable to A
    topicB.review_history.push({
      event_id: 'e_b_fail',
      date: '2026-08-13T10:00:00.000Z',
      kind: 'test_fail',
      source: 'session',
      source_id: 's_b_fail',
      confidence_reported: 2,
      test: { score: 2, out_of: 10, actual_retention: 0.2 },
    });

    const errorOnA: ErrorPattern = {
      pattern_id: 'p_int_a',
      signature: 'Incorrect substitution constant integration',
      error_type: 'conceptual',
      topic_ids: ['t_a', 't_b'],
      severity: 'high',
      occurrence_ids: ['err_b1'],
      first_seen: '2026-08-13T10:00:00.000Z',
      last_seen: '2026-08-13T10:00:00.000Z',
    };
    store.error_patterns.push(errorOnA);

    recs = recommend(store, now);
    expect(recs[0]?.action).toBe('remediate');
    expect(recs[0]?.target.id).toBe('p_int_a');

    // Targeted repair on A succeeds
    store.error_patterns = store.error_patterns.filter((p) => p.pattern_id !== 'p_int_a');
    topicA.last_reviewed = '2026-08-13T11:00:00.000Z';
    topicA.review_history.push({
      event_id: 'e_repair_a',
      date: '2026-08-13T11:00:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 's_repair_a',
      confidence_reported: 5,
      assessment: { independence: 3, performance_quality: 5 },
    });

    // Re-evaluate: Top recommendation naturally returns to B!
    recs = recommend(store, now);
    expect(recs[0]?.target.id).toBe('t_b');

    // B succeeds and masters
    topicB.status = 'mastered';
    topicB.last_reviewed = '2026-08-13T11:30:00.000Z';
    topicB.review_history.push({
      event_id: 'e_pass_b',
      date: '2026-08-13T11:30:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 's_pass_b',
      confidence_reported: 5,
      assessment: { independence: 3, performance_quality: 5 },
    });

    // Recommendation naturally advances to C!
    recs = recommend(store, now);
    expect(recs[0]?.action).toBe('learn');
    expect(recs[0]?.target.id).toBe('t_c');
  });

  it('TEST 11: Low retention on A + successful B -> B continues', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'mastered',
      strength: 1.0,
      k_factor: 8.4,
      last_reviewed: '2026-07-01T00:00:00.000Z',
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      last_reviewed: '2026-08-12T00:00:00.000Z',
    });

    const store = makeStore([topicA, topicB]);
    const recs = recommend(store, now);

    // B must continue; A retention decay must NOT interrupt B via prerequisite intervention
    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
  });

  it('TEST 12: Weak health on A + successful B -> B continues', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'mastered',
      conf: 1,
      strength: 1.0,
      last_reviewed: '2026-08-12T00:00:00.000Z',
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      last_reviewed: '2026-08-12T00:00:00.000Z',
    });

    const store = makeStore([topicA, topicB]);
    const recs = recommend(store, now);

    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
  });

  it('TEST 13: Insufficient independent evidence on A + strong retrieval + successful application + no errors -> curriculum continues', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'mastered',
      conf: 5,
      strength: 10.0,
      last_reviewed: '2026-08-12T00:00:00.000Z',
      review_history: [
        {
          event_id: 'ea1',
          date: '2026-08-12T00:00:00.000Z',
          kind: 'study_review',
          source: 'session',
          source_id: 'sa1',
          confidence_reported: 5,
          assessment: { independence: 1, performance_quality: 5 },
        },
      ],
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
    });

    const store = makeStore([topicA, topicB]);
    const recs = recommend(store, now);

    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
  });

  it('TEST 14: A is learning and B depends on A, but B is not_started -> curriculum logic sequences A before B without infinite loop', () => {
    const topicA = makeTopic('t_a', 'Topic A', { status: 'learning' });
    const topicB = makeTopic('t_b', 'Topic B', { status: 'not_started', prerequisites: ['t_a'] });

    const store = makeStore([topicA, topicB]);
    const recs = recommend(store, now);

    expect(recs[0]?.target.id).toBe('t_a');
    expect(['retrieve', 'learn'].includes(recs[0]!.action)).toBe(true);
    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
  });

  it('TEST 15: A is learning, B has started, and B is successfully progressing -> B remains active target', () => {
    const topicA = makeTopic('t_a', 'Topic A', {
      status: 'learning',
      last_reviewed: '2026-08-10T00:00:00.000Z',
      review_history: [
        {
          event_id: 'ea_indep',
          date: '2026-08-10T00:00:00.000Z',
          kind: 'study_review',
          source: 'session',
          source_id: 'sa1',
          confidence_reported: 5,
          assessment: { independence: 3, performance_quality: 5 },
        },
      ],
    });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      last_reviewed: '2026-08-13T09:00:00.000Z',
      review_history: [
        {
          event_id: 'eb1',
          date: '2026-08-13T09:00:00.000Z',
          kind: 'study_review',
          source: 'session',
          source_id: 'sb1',
          confidence_reported: 4,
        },
      ],
    });

    const store = makeStore([topicA, topicB]);
    const recs = recommend(store, now);

    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
    expect(recs[0]?.target.id).toBe('t_b');
  });

  it('TEST 16: B fails for a reason unrelated to A -> A does NOT become a blocking prerequisite', () => {
    const topicA = makeTopic('t_a', 'Topic A', { status: 'mastered' });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      review_history: [
        {
          event_id: 'eb_fail',
          date: '2026-08-13T10:00:00.000Z',
          kind: 'test_fail',
          source: 'session',
          source_id: 'sb_fail',
          confidence_reported: 2,
          test: { score: 2, out_of: 10, actual_retention: 0.2 },
        },
      ],
    });

    const errorB: ErrorPattern = {
      pattern_id: 'p_b_only',
      signature: 'Specific mistake in B concept',
      error_type: 'procedural',
      topic_ids: ['t_b'],
      severity: 'medium',
      occurrence_ids: ['err_b_1'],
      first_seen: '2026-08-13T10:00:00.000Z',
      last_seen: '2026-08-13T10:00:00.000Z',
    };

    const store = makeStore([topicA, topicB], [errorB]);
    const recs = recommend(store, now);

    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
    expect(recs[0]?.target.id).toBe('p_b_only');
  });

  it('TEST 17: B fails because of A -> A becomes blocking', () => {
    const topicA = makeTopic('t_a', 'Topic A', { status: 'mastered' });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      review_history: [
        {
          event_id: 'eb_fail_a',
          date: '2026-08-13T10:00:00.000Z',
          kind: 'test_fail',
          source: 'session',
          source_id: 'sb_fail',
          confidence_reported: 2,
          test: { score: 2, out_of: 10, actual_retention: 0.2 },
        },
      ],
    });

    const errorA: ErrorPattern = {
      pattern_id: 'p_a_cause',
      signature: 'Foundational prerequisite flaw in A exposed by B',
      error_type: 'conceptual',
      topic_ids: ['t_a', 't_b'],
      severity: 'high',
      occurrence_ids: ['err_ab_1'],
      first_seen: '2026-08-13T10:00:00.000Z',
      last_seen: '2026-08-13T10:00:00.000Z',
    };

    const store = makeStore([topicA, topicB], [errorA]);
    const recs = recommend(store, now);

    expect(['remediate', 'prerequisite'].includes(recs[0]!.action)).toBe(true);
    expect(['p_a_cause', 't_a'].includes(recs[0]!.target.id)).toBe(true);
  });

  it('TEST 18: A is repaired, but original B problem remains -> returns to B and continues diagnosing B', () => {
    const topicA = makeTopic('t_a', 'Topic A', { status: 'mastered' });
    const topicB = makeTopic('t_b', 'Topic B', {
      status: 'learning',
      prerequisites: ['t_a'],
      review_history: [
        {
          event_id: 'eb_fail',
          date: '2026-08-13T10:00:00.000Z',
          kind: 'test_fail',
          source: 'session',
          source_id: 'sb_fail',
          confidence_reported: 2,
          test: { score: 2, out_of: 10, actual_retention: 0.2 },
        },
      ],
    });

    const errorB: ErrorPattern = {
      pattern_id: 'p_b_residual',
      signature: 'Residual misconception in B',
      error_type: 'conceptual',
      topic_ids: ['t_b'],
      severity: 'medium',
      occurrence_ids: ['err_b_2'],
      first_seen: '2026-08-13T10:00:00.000Z',
      last_seen: '2026-08-13T10:00:00.000Z',
    };

    const store = makeStore([topicA, topicB], [errorB]);

    const recs = recommend(store, now);
    expect(recs.some((r) => r.target.id === 't_a' && r.action === 'prerequisite')).toBe(false);
    expect(recs[0]?.target.id === 'p_b_residual' || recs[0]?.target.id === 't_b').toBe(true);
  });
});
