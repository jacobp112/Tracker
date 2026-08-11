import { describe, expect, it } from 'vitest';
import { ingestAssessmentDef, toAssessmentRef } from '@/core/assessment-ingest';
import { mergeAttempt, buildAttemptResult } from '@/core/assessment-merge';
import { patternStatus, errorUrgency } from '@/engine/errors';
import { recommend } from '@/engine/recommend';
import type { AssessmentAttempt, AssessmentDefinition } from '@/domain/assessment';
import type { Course, ErrorLogEntry, ErrorPattern, ReviewEvent, SessionRecord, Store, Topic } from '@/domain/types';
import { allTopics, emptyStore } from '@/domain/types';

const NOW = new Date('2026-08-25T00:00:00.000Z');

function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'practising', conf: 3, strength: 2, k_factor: 8.4, cards: 0,
    last_reviewed: '2026-08-20T00:00:00.000Z', mastered_at: null, drift_history: [], review_history: [], error_log: [], ...opts,
  };
}
function storeWith(topics: Topic[], patterns: ErrorPattern[] = [], sessions: SessionRecord[] = []): Store {
  const course: Course = {
    schema_version: '4.0.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  s.error_patterns.push(...patterns);
  s.sessions.push(...sessions);
  return s;
}

/* ── End-to-end: the error remediation → verification loop ─────────── */

describe('error resolution loop (Phases 2 + 3 + 8 together)', () => {
  const occ = (id: string, date: string): ErrorLogEntry =>
    ({ error_id: id, date, source: 'session', source_id: 's', error_type: 'conceptual', description: 'sign slip', resolved: false, resolved_date: null });
  const pattern: ErrorPattern = {
    pattern_id: 'pattern_1', signature: 'sign-error', error_type: 'conceptual', topic_ids: ['topic_a'],
    severity: 'high', occurrence_ids: ['error_1', 'error_2'], first_seen: '2026-08-10T00:00:00.000Z', last_seen: '2026-08-15T00:00:00.000Z',
  };

  it('an active recurring error is flagged, then clears only on cold independent evidence', () => {
    const active = storeWith([topic('topic_a', { error_log: [occ('error_1', '2026-08-10T00:00:00.000Z'), occ('error_2', '2026-08-15T00:00:00.000Z')] })], [pattern]);

    // Before remediation: critical, and the top recommendation is to remediate it.
    expect(errorUrgency(pattern, active, NOW).level).toBe('critical');
    expect(recommend(active, NOW)[0]!.action).toBe('remediate');
    expect(patternStatus(pattern, active, NOW).status).toBe('active');

    // Learner remediates, then re-attempts COLD and independently (tier 5).
    const coldPass: ReviewEvent = {
      event_id: 'event_ok', date: '2026-08-24T00:00:00.000Z', kind: 'test_pass', source: 'exam', source_id: 'exam_1',
      confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 }, assessment: { independence: 3, cold: true },
    };
    const session: SessionRecord = { session_id: 's2', topic_id: 'topic_a', course_id: 'course_1', created_at: '2026-08-22T00:00:00.000Z', completed_at: '2026-08-22T00:00:00.000Z', duration_minutes: 20, intent: 'remediate', scope: 'topic', timer_mode: 'count_up' };
    const resolved = storeWith([topic('topic_a', { error_log: [occ('error_1', '2026-08-10T00:00:00.000Z'), occ('error_2', '2026-08-15T00:00:00.000Z')], review_history: [coldPass] })], [pattern], [session]);

    // Now it is evidence-verified resolved, no longer urgent, and off the list.
    expect(patternStatus(pattern, resolved, NOW).status).toBe('verified_resolved');
    expect(errorUrgency(pattern, resolved, NOW).level).toBe('low');
    expect(recommend(resolved, NOW).some((r) => r.action === 'remediate')).toBe(false);
  });
});

/* ── End-to-end: past paper → sit → un-smeared evidence ────────────── */

describe('past-paper ingestion → sitting → evidence (Phases 7 + 8)', () => {
  it('ingests, decomposes a marked attempt into un-smeared per-topic events, and derives the result', () => {
    const store = storeWith([topic('topic_a'), topic('topic_b')]);

    const defJson = JSON.stringify({
      schema_version: '4.0.0', assessment_id: 'assessment_1', title: 'AQA Paper 1', provenance: 'past_paper',
      created_at: '2026-08-20T00:00:00.000Z', max_marks: 10,
      questions: [
        { question_id: 'question_1', assessment_id: 'assessment_1', label: '1', order: 0, marks_available: 6, provenance: 'past_paper', mark_scheme: { total_marks: 6, criteria: [] }, topic_mappings: [{ topic_id: 'topic_a', role: 'primary', weight: 1, proposed_by: 'ai', confirmed: true }] },
        { question_id: 'question_2', assessment_id: 'assessment_1', label: '2', order: 1, marks_available: 4, provenance: 'past_paper', mark_scheme: { total_marks: 4, criteria: [] }, topic_mappings: [{ topic_id: 'topic_a', role: 'primary', weight: 0.5, proposed_by: 'ai', confirmed: true }, { topic_id: 'topic_b', role: 'secondary', weight: 0.5, proposed_by: 'ai', confirmed: true }] },
      ],
    });

    const ingested = ingestAssessmentDef(defJson, store);
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) return;

    const def = ingested.value as AssessmentDefinition;
    const ref = toAssessmentRef(def);
    expect(ref.topic_ids.sort()).toEqual(['topic_a', 'topic_b']);

    const attempt: AssessmentAttempt = {
      schema_version: '4.0.0', attempt_id: 'attempt_1', assessment_id: 'assessment_1', sat_at: '2026-08-24T00:00:00.000Z',
      conditions: { timed: true, closed_book: true, cold: true, assistance_used: false, ai_used: false, mark_scheme_seen: false },
      question_results: [{ question_id: 'question_1', marks_awarded: 6 }, { question_id: 'question_2', marks_awarded: 2 }], status: 'marked',
    };

    mergeAttempt(store, def, attempt);

    const a = allTopics(store).find((t) => t.topic.topic_id === 'topic_a')!.topic;
    expect(a.review_history).toHaveLength(1);
    expect(a.review_history[0]!.smeared).toBe(false);              // NOT smeared
    expect(a.review_history[0]!.provenance).toBe('past_paper');
    expect(a.review_history[0]!.assessment_ref?.assessment_id).toBe('assessment_1');

    const result = buildAttemptResult(def, attempt);
    expect(result.total_earned).toBe(8);
    expect(result.pct).toBe(80);
  });
});
