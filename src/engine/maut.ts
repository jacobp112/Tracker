import { CONFIG } from '@/config/constants';
import type { Store, Topic } from '@/domain/types';
import { predictRetention, elapsedDays, MS_PER_DAY } from './retention';
import { effectiveStrength } from './stability';
import { mastery } from './prerequisites';
import { calculateSoftGating } from './gating';
import { downstreamWithDistance } from './graph';
import { patternStatus } from './errors';

/**
 * Multi-Attribute Utility Theory scorer — workflow.md §13–23. Replaces static
 * priority bands with a continuous composite `U = Σ w_k·u_k`. Every sub-utility
 * is bounded to [0,1] and pure/derived; weights adapt to learner context and are
 * L1-normalized (§54.6).
 */

export interface MAUTContext {
  /** Remaining session time (min); null = unknown/unbounded → feasibility 1. */
  timeRemainingMinutes: number | null;
  /** Recently-studied topic ids (novelty signal for u_vel). */
  recentHistory: string[];
}

export interface MAUTWeights { mem: number; found: number; vel: number; feas: number }

export interface UtilityBreakdown {
  utility: number;
  subUtilities: {
    memoryUrgency: number;
    foundationalRisk: number;
    curriculumVelocity: number;
    sessionFeasibility: number;
  };
  weights: MAUTWeights;
  dominantUtility: 'mem' | 'found' | 'vel' | 'feas';
}

/**
 * u_mem — memory urgency (§15). Combines the retrievability deficit against
 * `R_target` with a decay-velocity term so fast-decaying items surface early.
 * 0 for a topic that has never been reviewed (no memory to preserve).
 */
export function memoryUrgency(topic: Topic, now: Date = new Date()): number {
  const R = predictRetention(topic, now);
  if (R === null) return 0;
  const target = CONFIG.RECO.R_TARGET_MEM;
  const deltaR = Math.max(0, target - R);

  const kS = topic.k_factor * effectiveStrength(topic);
  const t = topic.last_reviewed ? Math.max(0, elapsedDays(new Date(topic.last_reviewed), now)) : 0;
  const velocity = kS > 0 ? (1 / kS) * Math.exp(-t / kS) : 0;

  return Math.min(1, deltaR / target + CONFIG.RECO.MEM_VELOCITY_LAMBDA * velocity);
}

/** Earliest future exam (days from now) whose linked topics include `topicId`,
 *  else the default horizon (§16). */
function examDaysRemaining(topicId: string, store: Store, now: Date): number {
  let best = Infinity;
  for (const exam of store.exams) {
    if (!exam.linked_topic_ids.includes(topicId)) continue;
    const days = (new Date(exam.date).getTime() - now.getTime()) / MS_PER_DAY;
    if (days > 0 && days < best) best = days;
  }
  return best === Infinity ? CONFIG.RECO.DEFAULT_EXAM_HORIZON_DAYS : best;
}

/** The topic's OWN unresolved-error urgency mass, by highest active severity
 *  (§8 within §16). 0 when the topic has no active error patterns. */
function ownErrorUrgency(topic: Topic, store: Store, now: Date): number {
  let max = 0;
  for (const p of store.error_patterns) {
    if (!p.topic_ids.includes(topic.topic_id)) continue;
    if (patternStatus(p, store, now).status === 'verified_resolved') continue;
    max = Math.max(max, CONFIG.RECO.ERROR_URGENCY[p.severity] ?? 0);
  }
  return max;
}

/**
 * u_found — foundational causal risk (§16, D3). The distance-discounted, exam-
 * weighted mass of weak downstream dependents PLUS the topic's own unresolved-
 * error urgency (§8), scaled by the soft-gating factor and clamped to [0,1]. The
 * error term lets an unresolved misconception compete strongly on utility without
 * a hard priority pin (workflow §13 + §8).
 */
export function foundationalRisk(topic: Topic, store: Store, now: Date = new Date()): number {
  const g = calculateSoftGating(topic, store, now).score;
  let sum = 0;
  for (const { topic: dep, distance } of downstreamWithDistance(topic.topic_id, store)) {
    const weight = CONFIG.RECO.SYLLABUS_WEIGHT_DEFAULT; // no authored per-topic weight yet
    const examDays = Math.max(1, examDaysRemaining(dep.topic_id, store, now));
    sum += (weight * (1 - mastery(dep, now))) / (distance * examDays);
  }
  return g * Math.min(1, sum + ownErrorUrgency(topic, store, now));
}

/**
 * u_vel — curriculum velocity (§17) with learner momentum (objective §2.10).
 * Rewards unmastered content, damped when studied recently (novelty). An active,
 * not-yet-mastered topic WITHOUT an unresolved error stays worth finishing: it
 * decays on the gentler MOMENTUM_ETA curve, so the learner completes an in-flight
 * topic before wandering to a freshly-unlocked one. Errored in-progress topics
 * are excluded — that is a remediation concern owned by u_found, not momentum.
 */
export function curriculumVelocity(
  topic: Topic,
  recentHistory: string[],
  store: Store,
  now: Date = new Date(),
): number {
  const L = mastery(topic, now);
  const novelty = recentHistory.includes(topic.topic_id) ? CONFIG.RECO.VELOCITY_RECENT_NOVELTY : 1;
  const inFrontier =
    (topic.status === 'learning' || topic.status === 'practising') &&
    ownErrorUrgency(topic, store, now) === 0;
  const eta = inFrontier ? CONFIG.RECO.MOMENTUM_ETA : CONFIG.RECO.VELOCITY_ETA;
  return Math.min(1, Math.max(0, Math.pow(1 - L, eta) * novelty));
}

/**
 * u_feas — asymmetric session feasibility (D5). No penalty when the task fits the
 * remaining time (or when time is unknown); a smooth Gaussian decay when it
 * overruns.
 */
export function sessionFeasibility(estMinutes: number, timeRemaining: number | null): number {
  if (timeRemaining === null || estMinutes <= timeRemaining) return 1;
  const over = estMinutes - timeRemaining;
  return Math.exp(-(over * over) / (2 * CONFIG.RECO.FEASIBILITY_SIGMA * CONFIG.RECO.FEASIBILITY_SIGMA));
}

/** Nearest future exam across the whole store, in days, or Infinity. */
function nearestExamDays(store: Store, now: Date): number {
  let best = Infinity;
  for (const exam of store.exams) {
    const days = (new Date(exam.date).getTime() - now.getTime()) / MS_PER_DAY;
    if (days > 0 && days < best) best = days;
  }
  return best;
}

/**
 * Dynamic MAUT weights (§19–22). Base weights are shifted by exam-horizon and
 * session-exhaustion context, floored at `WEIGHT_FLOOR` to bar negative drift
 * (§54.6), then L1-normalized so the vector always sums to 1.
 */
export function deriveMAUTWeights(store: Store, ctx: MAUTContext, now: Date = new Date()): MAUTWeights {
  const base = CONFIG.RECO.MAUT_BASE_WEIGHTS;
  let { mem, found, vel, feas } = base;

  const examDays = nearestExamDays(store, now);
  if (examDays < CONFIG.RECO.EXAM_HORIZON_DAYS) {
    const shift = (CONFIG.RECO.EXAM_HORIZON_DAYS - examDays) / CONFIG.RECO.EXAM_HORIZON_DAYS;
    found += 0.25 * shift;
    vel -= 0.15 * shift;
    mem -= 0.1 * shift;
  }

  if (ctx.timeRemainingMinutes !== null && ctx.timeRemainingMinutes < CONFIG.RECO.EXHAUSTION_MINUTES) {
    feas += 0.3;
    vel -= 0.15;
    found -= 0.15;
  }

  const floored = [mem, found, vel, feas].map((w) => Math.max(CONFIG.RECO.WEIGHT_FLOOR, w));
  const total = floored.reduce((a, b) => a + b, 0);
  return { mem: floored[0]! / total, found: floored[1]! / total, vel: floored[2]! / total, feas: floored[3]! / total };
}

/* ── Anti-starvation: aging + domain interleaving (§24–26) ── */

/**
 * Queue residence in days — a derive-don't-store proxy for how long a candidate
 * has been eligible without being acted upon (§24): days since its last review
 * event, or since its course was created if never touched.
 */
export function queueResidenceDays(topic: Topic, store: Store, now: Date = new Date()): number {
  const last = topic.review_history.at(-1)?.date;
  let ref: number;
  if (last) {
    ref = new Date(last).getTime();
  } else {
    const course = store.courses.find((c) =>
      c.sections.some((s) => s.topics.some((t) => t.topic_id === topic.topic_id)),
    );
    ref = course ? new Date(course.created_at).getTime() : now.getTime();
  }
  return Math.max(0, (now.getTime() - ref) / MS_PER_DAY);
}

/** The section a topic belongs to — `domainId = section_id` (D6). */
export function sectionOf(topicId: string, store: Store): string | undefined {
  for (const c of store.courses) {
    for (const s of c.sections) {
      if (s.topics.some((t) => t.topic_id === topicId)) return s.section_id;
    }
  }
  return undefined;
}

/** How many of the last K studied topics belong to `sectionId` (§25). Drawn from
 *  `store.sessions` — a derive-don't-store window on what was recently worked. */
export function domainRecencyCount(sectionId: string, store: Store): number {
  const recent = [...store.sessions]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, CONFIG.RECO.INTERLEAVE_WINDOW_K);
  return recent.filter((s) => sectionOf(s.topic_id, store) === sectionId).length;
}

/** Interleaving multiplier `β^min(count, K)` (§25). Capped at K so suppression
 *  saturates at `β^K > 0` — a domain is never permanently excluded (§37). */
export function interleavingMultiplier(count: number): number {
  const capped = Math.min(count, CONFIG.RECO.INTERLEAVE_WINDOW_K);
  return Math.pow(CONFIG.RECO.INTERLEAVE_BETA, capped);
}

/**
 * Bounded aging boost (§24): `α_age·(1 − e^(−φ·Δt))` with `α_age = AGING_MAX_FRACTION·maxU`.
 * Rises with residence toward — but never past — its cap, so aging mitigates
 * starvation without overwhelming urgent memory/exam work (§36, §54.8).
 */
export function agingBoost(residenceDays: number, maxUtility: number): number {
  const max = CONFIG.RECO.AGING_MAX_FRACTION * maxUtility;
  return max * (1 - Math.exp(-CONFIG.RECO.AGING_ACCELERATION * residenceDays));
}

/**
 * Composite utility `U = Σ w_k·u_k` for a candidate topic (§13, §23), with the
 * sub-utility breakdown, applied weights, and the dominant driver for the
 * explanation trace and action-intent mapping.
 */
export function compositeUtility(
  topic: Topic,
  estMinutes: number,
  store: Store,
  ctx: MAUTContext,
  now: Date = new Date(),
): UtilityBreakdown {
  const subUtilities = {
    memoryUrgency: memoryUrgency(topic, now),
    foundationalRisk: foundationalRisk(topic, store, now),
    curriculumVelocity: curriculumVelocity(topic, ctx.recentHistory, store, now),
    sessionFeasibility: sessionFeasibility(estMinutes, ctx.timeRemainingMinutes),
  };
  const weights = deriveMAUTWeights(store, ctx, now);
  const utility =
    weights.mem * subUtilities.memoryUrgency +
    weights.found * subUtilities.foundationalRisk +
    weights.vel * subUtilities.curriculumVelocity +
    weights.feas * subUtilities.sessionFeasibility;

  const pairs: Array<[UtilityBreakdown['dominantUtility'], number]> = [
    ['mem', weights.mem * subUtilities.memoryUrgency],
    ['found', weights.found * subUtilities.foundationalRisk],
    ['vel', weights.vel * subUtilities.curriculumVelocity],
    ['feas', weights.feas * subUtilities.sessionFeasibility],
  ];
  const dominantUtility = pairs.reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  return { utility, subUtilities, weights, dominantUtility };
}
