import type { Store, Topic } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { errorUrgency, patternStatus, type UrgencyLevel, type UrgencyWhen } from './errors';
import { dueQueue, type TopicRef } from './course';
import { prerequisiteInstability } from './prerequisites';
import { readinessForAssessment } from './readiness';
import { isDue, projectedDue } from './retention';
import { evidenceTier } from './performance';

/**
 * Recommendation engine — "what should I do next?" (design §J). A hierarchical,
 * interpretable cascade, NOT a weighted score. Pure and DERIVED live over the
 * store (like badges/weakTopics), so recommendations can never go stale. Every
 * recommendation carries the concrete evidence that produced it, so the UI can
 * always answer "why?" (§20).
 *
 * Assessment-aware branches (sit/progress/reassess) arrive with the assessment
 * domain in a later phase; this cascade covers the pre-assessment guards:
 * remediate → prerequisite → verify → review → retrieve → learn.
 */

export type RecommendationAction = 'remediate' | 'prerequisite' | 'retrieve' | 'review' | 'learn' | 'assess';

export interface EvidenceRef {
  kind: 'occurrence' | 'topic' | 'pattern' | 'event' | 'assessment';
  id: string;
}

export interface Recommendation {
  action: RecommendationAction;
  target: { kind: 'topic' | 'pattern' | 'assessment'; id: string; title: string };
  reason: string;
  evidence: EvidenceRef[];
  priority: UrgencyLevel;
  when: UrgencyWhen;
  est_duration_minutes: number;
}

const PRIORITY_RANK: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const WHEN_RANK: Record<UrgencyWhen, number> = { today: 0, within_48h: 1, this_week: 2, next_cycle: 3 };

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
    const evidence: EvidenceRef[] = pattern.occurrence_ids.map((id) => ({ kind: 'occurrence' as const, id }));

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
    if (report.unstableCount === 0) continue;
    // Shallowest unstable ancestor first — fix the nearest foundation.
    const unstable = report.upstream.filter((u) => u.unstable).sort((a, b) => a.depth - b.depth)[0];
    if (!unstable || targeted.has(unstable.topic_id)) continue;
    targeted.add(unstable.topic_id);
    out.push({
      action: 'prerequisite',
      target: { kind: 'topic', id: unstable.topic_id, title: unstable.title },
      evidence: [{ kind: 'topic', id: unstable.topic_id }, { kind: 'topic', id: topic.topic_id }],
      priority: 'high', when: 'within_48h', est_duration_minutes: EST_MINUTES.prerequisite,
      reason: `"${unstable.title}" underpins "${topic.title}" but is currently unstable (${unstable.status}).`,
    });
  }
  return out;
}

function reviewGuards(store: Store, now: Date): Recommendation[] {
  const refs: TopicRef[] = allTopics(store).map(({ topic, section }) => ({ topic, section }));
  return dueQueue(refs, refs.length, now).map((r) => {
    const overdue = projectedDue(r.topic, now)?.overdue ?? false;
    return {
      action: 'review' as const,
      target: { kind: 'topic' as const, id: r.topic.topic_id, title: r.topic.title },
      evidence: [{ kind: 'topic' as const, id: r.topic.topic_id }],
      priority: overdue ? ('high' as const) : ('medium' as const),
      when: overdue ? ('within_48h' as const) : ('this_week' as const),
      est_duration_minutes: EST_MINUTES.review,
      reason: `"${r.topic.title}" has decayed below the review threshold${overdue ? ' (overdue)' : ''}.`,
    };
  });
}

function retrieveGuards(store: Store, now: Date): Recommendation[] {
  const out: Recommendation[] = [];
  for (const { topic } of allTopics(store)) {
    if (topic.status !== 'learning' && topic.status !== 'practising') continue;
    if (topic.review_history.length === 0) continue;
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

function learnGuards(store: Store): Recommendation[] {
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const satisfied = (t: Topic) =>
    (t.prerequisites ?? []).every((pid) => {
      const p = byId.get(pid);
      return p !== undefined && (p.status === 'practising' || p.status === 'mastered');
    });
  const out: Recommendation[] = [];
  for (const { topic } of allTopics(store)) {
    if (topic.status !== 'not_started') continue;
    if (!satisfied(topic)) continue; // don't start on shaky foundations
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
 * The ranked next-action list. Guards are unioned; when several fire on one
 * target the highest-priority survives, then everything sorts by priority then
 * temporal band. The dashboard shows the top; the whole list stays explainable.
 */
export function recommend(store: Store, now: Date = new Date()): Recommendation[] {
  const all = [
    ...errorGuards(store, now),
    ...prerequisiteGuards(store, now),
    ...reviewGuards(store, now),
    ...retrieveGuards(store, now),
    ...assessGuards(store, now),
    ...learnGuards(store),
  ];

  // Dedupe by target — keep the strongest signal per thing to act on.
  const best = new Map<string, Recommendation>();
  for (const r of all) {
    const key = `${r.target.kind}:${r.target.id}`;
    const prev = best.get(key);
    if (!prev || rankKey(r) < rankKey(prev)) best.set(key, r);
  }

  return [...best.values()].sort((a, b) => rankKey(a) - rankKey(b));
}
