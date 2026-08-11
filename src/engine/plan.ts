import type { SessionPlan, Store, Topic } from '@/domain/types';
import { allTopics } from '@/domain/types';
import type { Recommendation } from './recommend';
import { patternStatus } from './errors';
import { evidenceTier } from './performance';

/**
 * Session planning + post-session evaluation — design §G. A SessionPlan is the
 * intent-BEFORE (derived from a Recommendation); its `expected_evidence` is what
 * `evaluateSession` checks deterministically against the store afterwards, rather
 * than trusting the tutor's self-report.
 */

const INDEPENDENT_TIER = 4;

let planCounter = 0;
function makePlanId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${(planCounter++).toString(36)}`.slice(0, 10);
  return `plan_${rand}`;
}

/** Derive a concrete, checkable plan from a recommendation. The action determines
 *  the intent and — crucially — the `expected_evidence` the session must produce. */
export function buildSessionPlan(rec: Recommendation, store: Store, now: Date = new Date()): SessionPlan {
  const base = {
    plan_id: makePlanId(),
    created_at: now.toISOString(),
    from_recommendation: { action: rec.action, target_id: rec.target.id },
    reason: rec.reason,
    scope: 'topic' as const,
    est_duration_minutes: rec.est_duration_minutes,
  };

  switch (rec.action) {
    case 'remediate': {
      const topicIds = store.error_patterns.find((p) => p.pattern_id === rec.target.id)?.topic_ids ?? [];
      return {
        ...base, intent: 'remediate', target_topic_ids: topicIds, target_pattern_ids: [rec.target.id],
        expected_evidence: { kind: 'error_resolved', pattern_ids: [rec.target.id] },
      };
    }
    case 'prerequisite':
      return {
        ...base, intent: 'remediate', target_topic_ids: [rec.target.id],
        expected_evidence: { kind: 'independent_success', topic_ids: [rec.target.id], min_tier: INDEPENDENT_TIER },
      };
    case 'retrieve':
      return {
        ...base, intent: 'retention', target_topic_ids: [rec.target.id],
        expected_evidence: { kind: 'independent_success', topic_ids: [rec.target.id], min_tier: INDEPENDENT_TIER },
      };
    case 'review':
      return {
        ...base, intent: 'retention', target_topic_ids: [rec.target.id],
        expected_evidence: { kind: 'retrieval', topic_ids: [rec.target.id] },
      };
    case 'learn':
      return {
        ...base, intent: 'new_content', target_topic_ids: [rec.target.id],
        expected_evidence: { kind: 'coverage', topic_ids: [rec.target.id] },
      };
  }
}

export interface SessionEvaluation {
  met: boolean;
  satisfied: string[];
  outstanding: string[];
}

/**
 * Did the session produce the evidence its plan set out to? Checked against the
 * store, counting only evidence dated AFTER the plan was made — so a pre-existing
 * success can't spuriously satisfy a fresh plan. The independence gate holds:
 * `independent_success` needs a passed test at or above the required tier.
 */
export function evaluateSession(plan: SessionPlan, store: Store, now: Date = new Date()): SessionEvaluation {
  const created = new Date(plan.created_at).getTime();
  const ee = plan.expected_evidence;
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const targets = (ee.topic_ids ?? plan.target_topic_ids)
    .map((id) => byId.get(id))
    .filter((t): t is Topic => t !== undefined);

  const satisfied: string[] = [];
  const outstanding: string[] = [];
  const note = (ok: boolean, label: string) => (ok ? satisfied : outstanding).push(label);

  switch (ee.kind) {
    case 'independent_success': {
      const minTier = ee.min_tier ?? INDEPENDENT_TIER;
      const ok = targets.some((t) =>
        t.review_history.some((e) => e.kind === 'test_pass' && evidenceTier(e) >= minTier && new Date(e.date).getTime() > created),
      );
      note(ok, `independent success (tier ≥ ${minTier})`);
      break;
    }
    case 'error_resolved': {
      const ids = ee.pattern_ids ?? plan.target_pattern_ids ?? [];
      const ok = ids.length > 0 && ids.every((pid) => {
        const p = store.error_patterns.find((x) => x.pattern_id === pid);
        return p !== undefined && patternStatus(p, store, now).status === 'verified_resolved';
      });
      note(ok, 'error verified resolved');
      break;
    }
    case 'retrieval': {
      const ok = targets.some((t) => t.review_history.some((e) => new Date(e.date).getTime() > created));
      note(ok, 'retrieval attempt logged');
      break;
    }
    case 'coverage': {
      const ok = targets.some((t) => t.status !== 'not_started');
      note(ok, 'topic started');
      break;
    }
  }

  return { met: outstanding.length === 0 && satisfied.length > 0, satisfied, outstanding };
}
