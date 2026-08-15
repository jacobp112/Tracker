import { CONFIG } from '@/config/constants';
import type { AssessmentRef, Store, Topic } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { calibrationError, coldPerformance, independentPerformance } from './performance';
import { errorUrgency } from './errors';
import { prerequisiteInstability } from './prerequisites';
import { predictRetention, projectedDue } from './retention';

/**
 * Readiness engine — design §K. Explainable and multi-signal: NEVER a single
 * percentage threshold. A report is a checklist of criteria, each pass/fail/
 * unknown with the concrete evidence, so the learner always sees WHY they are or
 * aren't ready. Pure and derived.
 *
 * Honesty rule: absent data → `unknown` → an overall `insufficient_evidence`
 * verdict, NEVER `not_ready`. We do not certify readiness we cannot evidence, and
 * we do not condemn a learner for evidence they simply haven't produced yet.
 *
 * Provenance-aware (§19): a `benchmark` target (past-paper-grade) must clear the
 * COLD-independent gate; a formative target accepts merely independent evidence.
 */

export interface ReadinessTarget {
  topic_ids: string[];
  /** true = past-paper-grade certification (cold-independent required);
   *  false = formative (independent evidence suffices). */
  benchmark: boolean;
  title?: string;
}

export type CriterionState = 'pass' | 'fail' | 'unknown';

export type CriterionId =
  | 'coverage' | 'prerequisites' | 'no_critical_errors' | 'retention'
  | 'recent_retrieval' | 'cold_performance' | 'independent_performance' | 'calibration';

export interface ReadinessCriterion {
  id: CriterionId;
  state: CriterionState;
  detail: string;
  /** Blocking criteria determine the verdict; non-blocking ones only inform. */
  blocking: boolean;
  evidence: Array<{ kind: 'topic' | 'pattern'; id: string }>;
}

export interface ReadinessReport {
  target: ReadinessTarget;
  verdict: 'ready' | 'not_ready' | 'insufficient_evidence';
  criteria: ReadinessCriterion[];
  blocking: ReadinessCriterion[];
}

const READY_RETENTION = CONFIG.DUE_THRESHOLD;
const COLD_READY_SCORE = 70;
const INDEP_READY_ACCURACY = 0.7;
const CALIBRATION_TOLERANCE = 0.2;

function targetTopics(target: ReadinessTarget, store: Store): Topic[] {
  const want = new Set(target.topic_ids);
  return allTopics(store).filter(({ topic }) => want.has(topic.topic_id)).map((r) => r.topic);
}

export function assessReadiness(
  target: ReadinessTarget,
  store: Store,
  now: Date = new Date(),
): ReadinessReport {
  const topics = targetTopics(target, store);
  const events = topics.flatMap((t) => t.review_history);
  const targetSet = new Set(target.topic_ids);
  const criteria: ReadinessCriterion[] = [];

  // Coverage — every target topic at least practising.
  const uncovered = topics.filter((t) => t.status !== 'practising' && t.status !== 'mastered');
  criteria.push({
    id: 'coverage', blocking: true,
    state: topics.length === 0 ? 'unknown' : uncovered.length === 0 ? 'pass' : 'fail',
    detail: topics.length === 0 ? 'no target topics resolved'
      : uncovered.length === 0 ? `all ${topics.length} topics practised`
      : `${uncovered.length} of ${topics.length} topics not yet practising`,
    evidence: uncovered.map((t) => ({ kind: 'topic', id: t.topic_id })),
  });

  // Prerequisites — no unstable ancestor outside the target set.
  const unstableIds: string[] = [];
  for (const t of topics) {
    for (const u of prerequisiteInstability(t, store, now).upstream) {
      if (u.unstable && !targetSet.has(u.topic_id)) unstableIds.push(u.topic_id);
    }
  }
  criteria.push({
    id: 'prerequisites', blocking: true,
    state: unstableIds.length === 0 ? 'pass' : 'fail',
    detail: unstableIds.length === 0 ? 'all prerequisites stable' : `${unstableIds.length} unstable prerequisite(s)`,
    evidence: [...new Set(unstableIds)].map((id) => ({ kind: 'topic', id })),
  });

  // No unresolved high-urgency errors on target topics.
  const badPatterns = store.error_patterns
    .filter((p) => p.topic_ids.some((id) => targetSet.has(id)))
    .filter((p) => { const lvl = errorUrgency(p, store, now).level; return lvl === 'critical' || lvl === 'high'; });
  criteria.push({
    id: 'no_critical_errors', blocking: true,
    state: badPatterns.length === 0 ? 'pass' : 'fail',
    detail: badPatterns.length === 0 ? 'no unresolved high-severity errors' : `${badPatterns.length} high-urgency error(s) outstanding`,
    evidence: badPatterns.map((p) => ({ kind: 'pattern', id: p.pattern_id })),
  });

  // Retention — mean live retention above the review threshold.
  const rets = topics.map((t) => predictRetention(t, now)).filter((r): r is number => r !== null);
  const meanRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null;
  criteria.push({
    id: 'retention', blocking: true,
    state: meanRet === null ? 'unknown' : meanRet >= READY_RETENTION ? 'pass' : 'fail',
    detail: meanRet === null ? 'no retention data yet' : `mean retention ${Math.round(meanRet * 100)}%`,
    evidence: [],
  });

  // Recent retrieval — informational.
  const projected = topics.map((t) => projectedDue(t, now));
  const overdue = topics.filter((_, i) => projected[i]?.overdue);
  criteria.push({
    id: 'recent_retrieval', blocking: false,
    state: projected.every((p) => p === null) ? 'unknown' : overdue.length === 0 ? 'pass' : 'fail',
    detail: overdue.length === 0 ? 'all topics within their review window' : `${overdue.length} topic(s) overdue`,
    evidence: overdue.map((t) => ({ kind: 'topic', id: t.topic_id })),
  });

  // Cold performance — blocking for a benchmark target.
  const cold = coldPerformance(events);
  criteria.push({
    id: 'cold_performance', blocking: target.benchmark,
    state: cold === null ? 'unknown' : cold.score >= COLD_READY_SCORE ? 'pass' : 'fail',
    detail: cold === null ? 'no cold-independent evidence yet' : `cold performance ${Math.round(cold.score)} over ${cold.n} attempts`,
    evidence: [],
  });

  // Independent performance — blocking for a formative target.
  const indep = independentPerformance(events);
  const indepAccuracy = indep?.independent.accuracy ?? null;
  criteria.push({
    id: 'independent_performance', blocking: !target.benchmark,
    state: indep === null || !indep.sufficient ? 'unknown'
      : indepAccuracy !== null && indepAccuracy >= INDEP_READY_ACCURACY ? 'pass' : 'fail',
    detail: indep === null ? 'no independent evidence yet'
      : !indep.sufficient ? `only ${indep.independent.n} independent attempts (need ${CONFIG.PERFORMANCE.MIN_INDEPENDENT_N})`
      : `independent accuracy ${Math.round((indepAccuracy ?? 0) * 100)}% over ${indep.independent.n} attempts`,
    evidence: [],
  });

  // Calibration — informational (is the learner's self-assessment trustworthy?).
  const calib = calibrationError(events);
  criteria.push({
    id: 'calibration', blocking: false,
    state: calib === null ? 'unknown' : calib.meanAbsError <= CALIBRATION_TOLERANCE ? 'pass' : 'fail',
    detail: calib === null ? 'not enough predictions to judge calibration' : `mean prediction error ${calib.meanAbsError.toFixed(2)}`,
    evidence: [],
  });

  const blocking = criteria.filter((c) => c.blocking);
  const verdict = blocking.some((c) => c.state === 'fail') ? 'not_ready'
    : blocking.some((c) => c.state === 'unknown') ? 'insufficient_evidence'
    : 'ready';

  return { target, verdict, criteria, blocking };
}

/** Readiness for a specific assessment (design §K/§19). A past paper is a
 *  benchmark (needs cold-independent evidence); anything else is formative. */
export function readinessForAssessment(ref: AssessmentRef, store: Store, now: Date = new Date()): ReadinessReport {
  return assessReadiness(
    { topic_ids: ref.topic_ids, benchmark: ref.provenance === 'past_paper', title: ref.title },
    store,
    now,
  );
}
