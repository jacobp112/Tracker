import type { AssessmentEvidence, ReviewEvent } from '@/domain/types';

let seq = 0;

/**
 * Build an assessed ReviewEvent for Performance-layer tests. `opts.test` adds a
 * test block (so observedSuccess reads actual_retention); otherwise the event is
 * a study_review (observedSuccess falls back to performance_quality/5).
 */
export function makeEvent(
  assessment: AssessmentEvidence | undefined,
  opts: { date?: string; test?: { score: number; out_of: number } } = {},
): ReviewEvent {
  seq += 1;
  return {
    event_id: `event_${seq}`,
    date: opts.date ?? '2026-08-10T00:00:00.000Z',
    kind: opts.test ? (opts.test.score >= 0.8 * opts.test.out_of ? 'test_pass' : 'test_fail') : 'study_review',
    source: opts.test ? 'exam' : 'session',
    source_id: `src_${seq}`,
    confidence_reported: 3,
    ...(opts.test ? { test: { ...opts.test, actual_retention: opts.test.score / opts.test.out_of } } : {}),
    ...(assessment ? { assessment } : {}),
  };
}
