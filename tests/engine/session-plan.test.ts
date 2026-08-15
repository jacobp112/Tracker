import { describe, expect, it } from 'vitest';
import { buildSessionPlan, evaluateSession } from '@/engine/plan';
import { resolveObservedError, buildTutorContext } from '@/engine/tutor';
import { validateAgainst } from '@/core/validate';
import type { Recommendation } from '@/engine/recommend';
import type { Course, ErrorPattern, ReviewEvent, Store, StudySession, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';

const NOW = new Date('2026-08-20T00:00:00.000Z');

function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'practising', conf: 3, strength: 2, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [], ...opts,
  };
}
function pattern(opts: Partial<ErrorPattern> = {}): ErrorPattern {
  return {
    pattern_id: 'pattern_1', signature: 'sign-error-multiplying-negatives', error_type: 'conceptual',
    topic_ids: ['topic_a'], severity: 'medium', occurrence_ids: ['error_1'],
    first_seen: '2026-08-01T00:00:00.000Z', last_seen: '2026-08-01T00:00:00.000Z', ...opts,
  };
}
function storeWith(topics: Topic[], patterns: ErrorPattern[] = []): Store {
  const course: Course = {
    schema_version: '3.3.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  s.error_patterns.push(...patterns);
  return s;
}
const remediateRec: Recommendation = {
  action: 'remediate', target: { kind: 'pattern', id: 'pattern_1', title: 'sign-error-multiplying-negatives' },
  reason: 'recurred', evidence: [{ kind: 'occurrence', id: 'error_1' }],
  priority: 'high', when: 'within_48h', est_duration_minutes: 25,
};

describe('buildSessionPlan', () => {
  it('turns a remediate recommendation into a remediate plan with error_resolved expected evidence', () => {
    const plan = buildSessionPlan(remediateRec, storeWith([topic('topic_a')], [pattern()]), NOW);
    expect(plan.intent).toBe('remediate');
    expect(plan.target_pattern_ids).toContain('pattern_1');
    expect(plan.expected_evidence.kind).toBe('error_resolved');
    expect(plan.expected_evidence.pattern_ids).toContain('pattern_1');
    expect(plan.reason).toBe('recurred');
    expect(plan.created_at).toBe(NOW.toISOString());
  });

  it('turns a review recommendation into a retrieval plan', () => {
    const rec: Recommendation = { ...remediateRec, action: 'review', target: { kind: 'topic', id: 'topic_a', title: 'topic_a' } };
    const plan = buildSessionPlan(rec, storeWith([topic('topic_a')]), NOW);
    expect(plan.expected_evidence.kind).toBe('retrieval');
    expect(plan.target_topic_ids).toContain('topic_a');
  });
});

describe('evaluateSession', () => {
  const plan = buildSessionPlan(
    { ...remediateRec, action: 'retrieve', target: { kind: 'topic', id: 'topic_a', title: 'topic_a' } },
    storeWith([topic('topic_a')]), NOW,
  ); // expects independent_success on topic_a

  function withEvent(e: ReviewEvent): Store {
    return storeWith([topic('topic_a', { review_history: [e] })]);
  }

  it('is met when an independent success lands AFTER the plan', () => {
    const after = withEvent({
      event_id: 'e', date: '2026-08-21T00:00:00.000Z', kind: 'test_pass', source: 'exam', source_id: 'exam_1',
      confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 }, assessment: { independence: 3 },
    });
    expect(evaluateSession(plan, after, new Date('2026-08-22T00:00:00.000Z')).met).toBe(true);
  });

  it('is NOT met by a success that predates the plan', () => {
    const before = withEvent({
      event_id: 'e', date: '2026-08-10T00:00:00.000Z', kind: 'test_pass', source: 'exam', source_id: 'exam_1',
      confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 }, assessment: { independence: 3 },
    });
    const res = evaluateSession(plan, before, new Date('2026-08-22T00:00:00.000Z'));
    expect(res.met).toBe(false);
    expect(res.outstanding.length).toBeGreaterThan(0);
  });

  it('is NOT met by a non-independent success (independence gate holds)', () => {
    const weak = withEvent({
      event_id: 'e', date: '2026-08-21T00:00:00.000Z', kind: 'test_pass', source: 'exam', source_id: 'exam_1',
      confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 },
    });
    expect(evaluateSession(plan, weak, new Date('2026-08-22T00:00:00.000Z')).met).toBe(false);
  });
});

describe('resolveObservedError — tutor observations map to pattern decisions (app-owned)', () => {
  const patterns = [pattern()];

  it('LINKS a high-confidence semantic match', () => {
    const r = resolveObservedError(patterns, { error_type: 'conceptual', description: 'd', proposed_signature: 'Sign error multiplying negatives', topic_id: 'topic_a' });
    expect(r.decision).toBe('link');
  });

  it('surfaces an ambiguous match for CONFIRMATION', () => {
    const r = resolveObservedError(patterns, { error_type: 'conceptual', description: 'd', proposed_signature: 'sign error when adding negatives', topic_id: 'topic_a' });
    expect(r.decision).toBe('confirm');
  });

  it('CREATES a new pattern when nothing is close', () => {
    const r = resolveObservedError(patterns, { error_type: 'conceptual', description: 'd', proposed_signature: 'forgot to convert units', topic_id: 'topic_a' });
    expect(r.decision).toBe('create');
  });

  it('SKIPS (never invents recurrence) when the tutor proposed no signature', () => {
    const r = resolveObservedError(patterns, { error_type: 'conceptual', description: 'just a slip', topic_id: 'topic_a' });
    expect(r.decision).toBe('skip');
  });
});

describe('buildTutorContext — curated snapshot, app stays source of truth', () => {
  it('includes derived retention/health and target error patterns, but NEVER raw engine internals', () => {
    const t = topic('topic_a', { review_history: [{ event_id: 'e', date: '2026-08-18T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's', confidence_reported: 3 }] });
    const store = storeWith([t], [pattern()]);
    const plan = buildSessionPlan(remediateRec, store, NOW);
    const ctx = buildTutorContext(plan, store, NOW);

    expect(ctx.objective.length).toBeGreaterThan(0);
    expect(ctx.targets.map((x) => x.topic_id)).toContain('topic_a');
    expect(ctx.error_patterns.map((p) => p.signature)).toContain('sign-error-multiplying-negatives');

    const serialised = JSON.stringify(ctx);
    for (const leaked of ['k_factor', 'strength', 'drift_history', 'review_history', 'smeared']) {
      expect(serialised).not.toContain(leaked);
    }
  });
});

describe('schema — session accepts tutor-outcome fields', () => {
  it('validates a session with proposed_signature, concepts_demonstrated, uncertainty and suggested_follow_up', () => {
    const s: StudySession = {
      schema_version: '3.3.0', session_id: 'session_1', course_id: 'course_1',
      date: '2026-08-20T00:00:00.000Z', duration_minutes: 0,
      suggested_follow_up: 'try a mixed set next',
      topics_covered: [{
        topic_id: 'topic_a', confidence_reported: 3,
        concepts_demonstrated: ['factoring'], uncertainty: 'unsure on part b',
        errors: [{ error_type: 'conceptual', description: 'sign slip', proposed_signature: 'sign-error-neg', proposed_severity: 'high' }],
      }],
    };
    expect(validateAgainst('session', s).ok).toBe(true);
  });
});
