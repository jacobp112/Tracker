import { describe, expect, it } from 'vitest';
import { decomposeAttempt, mergeAttempt, buildAttemptResult, sittingToAssessment } from '@/core/assessment-merge';
import { evidenceTier } from '@/engine/performance';
import type { AssessmentAttempt, AssessmentDefinition, Question, SittingConditions, TopicMapping } from '@/domain/assessment';
import type { Course, Store } from '@/domain/types';
import { emptyStore, allTopics } from '@/domain/types';

const COLD: SittingConditions = { timed: true, closed_book: true, cold: true, assistance_used: false, ai_used: false, mark_scheme_seen: false };

function map(topic_id: string, weight: number, role: TopicMapping['role'] = 'primary'): TopicMapping {
  return { topic_id, role, weight, proposed_by: 'ai', confirmed: true };
}
function q(id: string, marks: number, mappings: TopicMapping[]): Question {
  return {
    question_id: id, assessment_id: 'assessment_1', label: id, order: 0, marks_available: marks,
    topic_mappings: mappings, provenance: 'past_paper',
    mark_scheme: { total_marks: marks, criteria: [] },
  };
}
function def(questions: Question[], max: number): AssessmentDefinition {
  return { schema_version: '4.0.0', assessment_id: 'assessment_1', title: 'Paper', provenance: 'past_paper', created_at: '2026-08-20T00:00:00.000Z', max_marks: max, questions };
}
function attempt(results: Array<[string, number]>, conditions = COLD): AssessmentAttempt {
  return {
    schema_version: '4.0.0', attempt_id: 'attempt_1', assessment_id: 'assessment_1', sat_at: '2026-08-21T00:00:00.000Z',
    conditions, question_results: results.map(([question_id, marks_awarded]) => ({ question_id, marks_awarded })), status: 'marked',
  };
}
function storeWithTopics(ids: string[]): Store {
  const course: Course = {
    schema_version: '4.0.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: ids.map((id) => ({
      topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4, cards: 0,
      last_reviewed: '2026-08-10T00:00:00.000Z', mastered_at: null, drift_history: [], review_history: [], error_log: [],
    })) }],
  };
  const s = emptyStore();
  s.courses.push(course);
  return s;
}

// q1: 6 marks → topic_a (weight 1). q2: 4 marks → topic_a (0.5) + topic_b (0.5).
const twoQ = def([q('question_1', 6, [map('topic_a', 1)]), q('question_2', 4, [map('topic_a', 0.5), map('topic_b', 0.5, 'secondary')])], 10);

describe('decomposeAttempt — weighted, un-smeared per-topic evidence', () => {
  it('attributes weighted marks per topic, never smearing the aggregate', () => {
    const events = decomposeAttempt(twoQ, attempt([['question_1', 6], ['question_2', 2]]));
    const byTopic = new Map(events.map((e) => [e.topic_id, e.event]));

    // topic_a: q1 (6/6) + 0.5·q2 (1/2) = 7/8
    expect(byTopic.get('topic_a')!.test).toMatchObject({ score: 7, out_of: 8 });
    expect(byTopic.get('topic_a')!.kind).toBe('test_pass'); // 7/8 = 0.875 ≥ 0.8
    // topic_b: 0.5·q2 (1/2) = 1/2 → fail
    expect(byTopic.get('topic_b')!.test).toMatchObject({ score: 1, out_of: 2 });
    expect(byTopic.get('topic_b')!.kind).toBe('test_fail');
    // Every event is real per-topic evidence — NOT smeared.
    expect(events.every((e) => e.event.smeared === false)).toBe(true);
  });

  it('a cold, independent past-paper sitting yields gold-tier (6) evidence', () => {
    const events = decomposeAttempt(twoQ, attempt([['question_1', 6], ['question_2', 4]]));
    const a = events.find((e) => e.topic_id === 'topic_a')!.event;
    expect(a.assessment).toMatchObject({ cold: true, independence: 3 });
    expect(a.provenance).toBe('past_paper');
    expect(a.assessment_ref).toMatchObject({ assessment_id: 'assessment_1', attempt_id: 'attempt_1' });
    expect(evidenceTier(a)).toBe(6);
  });

  it('assistance/AI/mark-scheme use disqualifies independence', () => {
    const assisted = { ...COLD, cold: false, mark_scheme_seen: true };
    expect(sittingToAssessment(assisted)).toEqual({ cold: false, independence: 0 });
  });

  it('ignores UNCONFIRMED topic mappings (they must not weight evidence)', () => {
    const unconfirmed = def([{ ...q('question_1', 6, [{ topic_id: 'topic_a', role: 'primary', weight: 1, proposed_by: 'ai', confirmed: false }]) }], 6);
    expect(decomposeAttempt(unconfirmed, attempt([['question_1', 6]]))).toEqual([]);
  });
});

describe('mergeAttempt — through the single recalculation path', () => {
  it('applies un-smeared events that grow strength and tune k (like a real exam)', () => {
    const store = storeWithTopics(['topic_a', 'topic_b']);
    mergeAttempt(store, twoQ, attempt([['question_1', 6], ['question_2', 2]]));
    const topicA = allTopics(store).find((t) => t.topic.topic_id === 'topic_a')!.topic;
    expect(topicA.review_history).toHaveLength(1);
    expect(topicA.review_history[0]!.smeared).toBe(false);
    expect(topicA.review_history[0]!.assessment_ref?.attempt_id).toBe('attempt_1');
    // Fix 1: the event's source_id is the ATTEMPT (unique per sitting), not the
    // assessment (which would collide across re-sits and with legacy exams).
    expect(topicA.review_history[0]!.source_id).toBe('attempt_1');
    expect(topicA.strength).toBeGreaterThan(1); // strength grew
  });

  it('is idempotent — the same attempt cannot be decomposed twice (Fix 3)', () => {
    const store = storeWithTopics(['topic_a', 'topic_b']);
    const a = attempt([['question_1', 6], ['question_2', 2]]);
    mergeAttempt(store, twoQ, a);
    mergeAttempt(store, twoQ, a); // second application must be a no-op
    const topicA = allTopics(store).find((t) => t.topic.topic_id === 'topic_a')!.topic;
    expect(topicA.review_history).toHaveLength(1);
  });
});

describe('buildAttemptResult — the derived result', () => {
  it('aggregates overall and per-topic percentages', () => {
    const result = buildAttemptResult(twoQ, attempt([['question_1', 6], ['question_2', 2]]));
    expect(result.total_earned).toBe(8); // 6 + 2
    expect(result.total_possible).toBe(10);
    expect(result.pct).toBe(80);
    const a = result.per_topic.find((t) => t.topic_id === 'topic_a')!;
    expect(a.earned).toBeCloseTo(7);
    expect(a.possible).toBeCloseTo(8);
  });
});
