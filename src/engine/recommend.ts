import { CONFIG } from '@/config/constants';
import type { Store, SessionIntent } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { errorUrgency, patternStatus, type UrgencyLevel, type UrgencyWhen } from './errors';
import { dueQueue, type TopicRef } from './course';
import { prerequisiteInstability } from './prerequisites';
import { readinessForAssessment } from './readiness';
import { isDue, predictRetention } from './retention';
import { evidenceTier } from './performance';
import { topicEvidenceProfile, type ConfidenceLevel } from './evidence-confidence';
import { deriveTimeBudget, curriculumPosition, type TimeBudget } from './planning';
import { calculateActionValue, type ActionValue } from './action-value';
import { curriculumIndex } from './graph';

/**
 * Recommendation engine — "what should I do next?" (design §J). A hierarchical,
 * interpretable cascade, NOT a weighted score. Pure and DERIVED live over the
 * store (like badges/weakTopics), so recommendations can never go stale. Every
 * recommendation carries the concrete evidence that produced it, so the UI can
 * always answer "why?" (§20).
 *
 * Tier 3 integration: Consumes Evidence Confidence (#16), Time Budget (#18),
 * Curriculum Position (#20), and Action Value (#17+#19) to refine relative
 * candidate ordering within priority bands while strictly preserving the
 * decision authority and priority cascade.
 */

export type RecommendationAction = 'remediate' | 'prerequisite' | 'retrieve' | 'review' | 'learn' | 'assess';

/**
 * Deterministic action → SessionIntent map (Part H). MAUT changes ranking, not
 * the pedagogical action, so every recommendation still resolves to a concrete
 * tutor intent (`session.ts` `intentConfig` / `startSessionPrompt`).
 */
export function intentForAction(action: RecommendationAction): SessionIntent {
  switch (action) {
    case 'remediate':
    case 'prerequisite':
      return 'remediate';
    case 'review':
      return 'retention';
    case 'learn':
      return 'new_content';
    case 'retrieve':
    case 'assess':
      return 'adaptive';
  }
}

export interface EvidenceRef {
  kind: 'occurrence' | 'topic' | 'pattern' | 'event' | 'assessment';
  id: string;
  role?: 'prerequisite' | 'dependent' | 'target' | 'unresolved_error' | 'retention' | 'urgency';
}

export interface DecisionTrace {
  /** The stage that produced this recommendation. */
  sourceStage: string;
  /** Any alternative candidates that were discarded before this was picked. */
  discardedCandidates?: string[];
  /** State of the time budget at the moment of evaluation. */
  timeBudget?: TimeBudget;
}

export interface Recommendation {
  action: RecommendationAction;
  target: { kind: 'topic' | 'pattern' | 'assessment'; id: string; title: string };
  reason: string;
  evidence: EvidenceRef[];
  priority: UrgencyLevel;
  when: UrgencyWhen;
  est_duration_minutes: number;
  actionValue?: ActionValue;
  evidenceConfidence?: ConfidenceLevel;
  trace?: DecisionTrace;
}

const PRIORITY_RANK: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const WHEN_RANK: Record<UrgencyWhen, number> = { today: 0, within_48h: 1, this_week: 2, next_cycle: 3 };
const ACTION_RANK: Record<RecommendationAction, number> = {
  remediate: 0,
  prerequisite: 1,
  review: 2,
  retrieve: 3,
  assess: 4,
  learn: 5,
};

const EST_MINUTES: Record<RecommendationAction, number> = {
  remediate: 25, prerequisite: 25, retrieve: 15, review: 15, learn: 30, assess: 60,
};

/** The verifying tier from §H — an independent attempt is what settles an
 *  unverified topic. Mirrors the error engine's gate, kept local to avoid a
 *  cross-engine constant. */
const INDEPENDENT_TIER = 4;

/* ── Guards — each yields candidate recommendations ───────────────── */

function errorGuards(store: Store, now: Date): Recommendation[] {
  const out: Recommendation[] = [];
  for (const pattern of store.error_patterns) {
    const status = patternStatus(pattern, store, now).status;
    if (status === 'verified_resolved') continue; // nothing to do

    const target = { kind: 'pattern' as const, id: pattern.pattern_id, title: pattern.signature };
    const evidence: EvidenceRef[] = pattern.occurrence_ids.map((id) => ({ kind: 'occurrence' as const, id, role: 'unresolved_error' }));

    if (status === 'verification_pending') {
      // Remediation happened; the outstanding action is to PROVE it independently.
      out.push({
        action: 'retrieve', target, evidence, priority: 'medium', when: 'this_week',
        est_duration_minutes: EST_MINUTES.retrieve,
        reason: `Verify the fix for "${pattern.signature}" with an independent attempt.`,
      });
      continue;
    }

    // active / regressed → remediate, at the error's own urgency.
    const u = errorUrgency(pattern, store, now);
    out.push({
      action: 'remediate', target, evidence, priority: u.level, when: u.when,
      est_duration_minutes: EST_MINUTES.remediate,
      reason: `Remediate "${pattern.signature}" — ${u.reasons.join('; ')}.`,
    });
  }
  return out;
}

function prerequisiteGuards(store: Store, now: Date): Recommendation[] {
  const out: Recommendation[] = [];
  const targeted = new Set<string>();
  for (const { topic } of allTopics(store)) {
    if (topic.status === 'not_started') continue;
    const report = prerequisiteInstability(topic, store, now);
    const blocking = report.upstream.filter((u) => u.unstable && u.isBlocking);
    if (blocking.length === 0) continue;
    // Shallowest blocking ancestor first — fix the nearest foundation.
    const unstable = blocking.sort((a, b) => a.depth - b.depth)[0];
    if (!unstable || targeted.has(unstable.topic_id)) continue;
    targeted.add(unstable.topic_id);

    const activePatterns = store.error_patterns.filter(
      (p) => p.topic_ids.includes(unstable.topic_id) && patternStatus(p, store, now).status !== 'verified_resolved',
    );

    const evidence: EvidenceRef[] = [
      { kind: 'topic', id: unstable.topic_id, role: 'prerequisite' },
      { kind: 'topic', id: topic.topic_id, role: 'dependent' },
    ];
    for (const p of activePatterns) {
      evidence.push({ kind: 'pattern', id: p.pattern_id, role: 'unresolved_error' });
    }

    const retPct = unstable.retention !== null ? Math.round(unstable.retention * 100) : null;
    let reason = `"${unstable.title}" underpins "${topic.title}" but is currently unstable (${unstable.status}).`;
    if (retPct !== null && retPct >= 80 && activePatterns.length > 0) {
      reason = `Your overall retention is strong (${retPct}%), but you still have an unresolved error in this foundational topic. Because it underpins "${topic.title}", fixing this foundational topic takes precedence over ordinary review.`;
    } else if (unstable.blockingGap === 'application' || unstable.blockingGap === 'independence') {
      reason = `"${unstable.title}" underpins "${topic.title}" but requires independent problem-solving practice (its retrieval is solid, but application/independence is uncertified).`;
    } else if (unstable.blockingGap === 'retrieval') {
      reason = `"${unstable.title}" underpins "${topic.title}" but its retrieval has decayed. Active recall review needed.`;
    } else if (unstable.blockingGap === 'unresolved_error') {
      reason = `"${unstable.title}" underpins "${topic.title}" but carries an unresolved misconception that takes precedence.`;
    } else if (retPct !== null && retPct >= 80) {
      const errClause = activePatterns.length > 0 ? 'an unresolved error' : `unconsolidated status ("${unstable.status}")`;
      reason = `Your overall retention is strong (${retPct}%), but you still have ${errClause} in this foundational topic. Because it underpins "${topic.title}", fixing this foundational topic takes precedence over ordinary review.`;
    }

    // A DIRECT (d=1) foundation gap is urgent; a transitive causal blocker (d>1)
    // is a this-week nudge that must not preempt active decaying reviews (§5–9).
    const isDirect = unstable.depth === 1;
    out.push({
      action: 'prerequisite',
      target: { kind: 'topic', id: unstable.topic_id, title: unstable.title },
      evidence,
      priority: isDirect ? 'high' : 'medium',
      when: isDirect ? 'within_48h' : 'this_week',
      est_duration_minutes: EST_MINUTES.prerequisite,
      reason,
    });
  }
  return out;
}

function reviewGuards(store: Store, now: Date): Recommendation[] {
  const refs: TopicRef[] = allTopics(store).map(({ topic, section }) => ({ topic, section }));
  return dueQueue(refs, refs.length, now).map((r) => {
    // `dueQueue` already gated on `isDue` (R < DUE_THRESHOLD). We escalate only
    // once retention has fallen a further OVERDUE_MARGIN below that — otherwise a
    // topic that is merely due would always read as "overdue" (its projected due
    // date is by construction in the past), collapsing the medium tier (V2).
    const retention = predictRetention(r.topic, now);
    const severelyOverdue =
      retention !== null && retention < CONFIG.DUE_THRESHOLD - CONFIG.OVERDUE_MARGIN;
    return {
      action: 'review' as const,
      target: { kind: 'topic' as const, id: r.topic.topic_id, title: r.topic.title },
      evidence: [{ kind: 'topic' as const, id: r.topic.topic_id }],
      priority: severelyOverdue ? ('high' as const) : ('medium' as const),
      when: severelyOverdue ? ('within_48h' as const) : ('this_week' as const),
      est_duration_minutes: EST_MINUTES.review,
      reason: `"${r.topic.title}" has decayed below the review threshold${severelyOverdue ? ' (severely overdue)' : ''}.`,
    };
  });
}

function retrieveGuards(store: Store, now: Date): Recommendation[] {
  const out: Recommendation[] = [];
  for (const { topic } of allTopics(store)) {
    if (topic.status !== 'learning' && topic.status !== 'practising') continue;
    if (isDue(topic, now)) continue; // the review guard already covers a due topic
    const hasIndependent = topic.review_history.some((e) => evidenceTier(e) >= INDEPENDENT_TIER);
    if (hasIndependent) continue;
    out.push({
      action: 'retrieve',
      target: { kind: 'topic', id: topic.topic_id, title: topic.title },
      evidence: [{ kind: 'topic', id: topic.topic_id }],
      priority: 'medium', when: 'this_week', est_duration_minutes: EST_MINUTES.retrieve,
      reason: `"${topic.title}" hasn't been verified with an independent attempt yet.`,
    });
  }
  return out;
}

function learnGuards(store: Store, now: Date): Recommendation[] {
  const position = curriculumPosition(store, now);
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));

  const out: Recommendation[] = [];
  for (const topicId of position.suggestedOrder) {
    const topic = byId.get(topicId);
    if (!topic || topic.status !== 'not_started') continue;
    out.push({
      action: 'learn',
      target: { kind: 'topic', id: topic.topic_id, title: topic.title },
      evidence: [{ kind: 'topic', id: topic.topic_id }],
      priority: 'low', when: 'next_cycle', est_duration_minutes: EST_MINUTES.learn,
      reason: `Ready to start "${topic.title}" — its prerequisites are in place.`,
    });
  }
  return out;
}

function assessGuards(store: Store, now: Date): Recommendation[] {
  const out: Recommendation[] = [];
  for (const ref of store.assessment_refs) {
    if (ref.topic_ids.length === 0) continue;
    // Don't re-recommend an assessment the learner has already sat (an event
    // carrying its assessment_ref exists somewhere in the topic logs).
    const attempted = allTopics(store).some(({ topic }) =>
      topic.review_history.some((e) => e.assessment_ref?.assessment_id === ref.assessment_id),
    );
    if (attempted) continue;
    if (readinessForAssessment(ref, store, now).verdict !== 'ready') continue; // only when ready
    out.push({
      action: 'assess',
      target: { kind: 'assessment', id: ref.assessment_id, title: ref.title },
      evidence: [{ kind: 'assessment', id: ref.assessment_id }],
      priority: 'medium', when: 'this_week', est_duration_minutes: EST_MINUTES.assess,
      reason: `You're ready to sit "${ref.title}" — every readiness check passes.`,
    });
  }
  return out;
}

/* ── Compose, dedupe, rank ────────────────────────────────────────── */

function rankKey(r: Recommendation): number {
  return PRIORITY_RANK[r.priority] * 10 + WHEN_RANK[r.when];
}

/**
 * The ranked next-action list — single learner-action decision authority.
 * Guards are unioned; when several fire on one target the highest-priority survives.
 * Recommendations are enriched with Evidence Confidence, Time Budget feasibility,
 * and Action Value, then sorted strictly within priority bands.
 */
export function recommend(
  store: Store,
  now: Date = new Date(),
  timeBudget?: TimeBudget | null,
): Recommendation[] {
  const activeBudget = timeBudget ?? deriveTimeBudget(store, undefined, now);
  const cIndex = curriculumIndex(store);

  const rawCandidates = [
    ...errorGuards(store, now),
    ...prerequisiteGuards(store, now),
    ...reviewGuards(store, now),
    ...retrieveGuards(store, now),
    ...assessGuards(store, now),
    ...learnGuards(store, now),
  ];

  // Dedupe by target — keep the strongest signal per thing to act on.
  const best = new Map<string, Recommendation>();
  for (const r of rawCandidates) {
    const key = `${r.target.kind}:${r.target.id}`;
    const prev = best.get(key);
    if (!prev || rankKey(r) < rankKey(prev)) best.set(key, r);
  }

  const candidates = [...best.values()];

  // Enrich with Evidence Confidence and Action Value
  const enriched = candidates.map((r) => {
    let evidenceConfidence: ConfidenceLevel | undefined;
    if (r.target.kind === 'topic') {
      const topicObj = allTopics(store).find(({ topic }) => topic.topic_id === r.target.id)?.topic;
      if (topicObj) {
        evidenceConfidence = topicEvidenceProfile(topicObj, store, now).overall;
      }
    }

    const actionVal = calculateActionValue(r, candidates, store, activeBudget, now);

    return {
      ...r,
      evidenceConfidence,
      actionValue: actionVal,
      trace: {
        sourceStage: `${r.action}Guards`,
        timeBudget: activeBudget,
        discardedCandidates: [], // Could be populated if we tracked rawCandidates vs best
      },
    };
  });

  // Sort: Priority cascade is major key (rankKey).
  // Within the same priority band:
  // 1. Feasibility (feasible > marginal > infeasible)
  // 2. Action cascade precedence (remediate > prerequisite > review > retrieve > assess > learn)
  // 3. Downstream value descending
  // 4. Alphabetical by target title
  return enriched.sort((a, b) => {
    const majorDiff = rankKey(a) - rankKey(b);
    if (majorDiff !== 0) return majorDiff;

    // Feasibility sorting
    const feasibilityOrder: Record<string, number> = { feasible: 0, marginal: 1, infeasible: 2 };
    const feasA = feasibilityOrder[a.actionValue?.feasibility ?? 'feasible'] ?? 0;
    const feasB = feasibilityOrder[b.actionValue?.feasibility ?? 'feasible'] ?? 0;
    if (feasA !== feasB) return feasA - feasB;

    const actionDiff = ACTION_RANK[a.action] - ACTION_RANK[b.action];
    if (actionDiff !== 0) return actionDiff;

    // Downstream value sorting
    const downA = a.actionValue?.downstreamValue ?? 0;
    const downB = b.actionValue?.downstreamValue ?? 0;
    if (downA !== downB) return downB - downA;

    // Syllabus-order tie-breaker (D9a): follow the authored curriculum sequence,
    // not the alphabet, so same-band topic candidates order by where they sit in
    // the course. Non-topic targets (patterns/assessments) fall back to title.
    const ai = cIndex.get(a.target.id);
    const bi = cIndex.get(b.target.id);
    if (ai !== undefined && bi !== undefined && ai !== bi) return ai - bi;
    return a.target.title.localeCompare(b.target.title);
  });
}
