import { CONFIG } from '@/config/constants';
import type { Store, Topic } from '@/domain/types';
import { predictRetention, elapsedDays, MS_PER_DAY } from './retention';
import { effectiveStrength } from './stability';
import { mastery } from './prerequisites';
import { calculateSoftGating } from './gating';
import { downstreamWithDistance } from './graph';

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

/**
 * u_found — foundational causal risk (§16, D3). The distance-discounted, exam-
 * weighted mass of weak downstream dependents, scaled by the soft-gating factor
 * and clamped to [0,1].
 */
export function foundationalRisk(topic: Topic, store: Store, now: Date = new Date()): number {
  const g = calculateSoftGating(topic, store, now).score;
  let sum = 0;
  for (const { topic: dep, distance } of downstreamWithDistance(topic.topic_id, store)) {
    const weight = CONFIG.RECO.SYLLABUS_WEIGHT_DEFAULT; // no authored per-topic weight yet
    const examDays = Math.max(1, examDaysRemaining(dep.topic_id, store, now));
    sum += (weight * (1 - mastery(dep, now))) / (distance * examDays);
  }
  return g * Math.min(1, sum);
}

/**
 * u_vel — curriculum velocity (§17). Rewards unmastered content, damped when the
 * topic was studied recently (interleaving nudge toward novelty).
 */
export function curriculumVelocity(topic: Topic, recentHistory: string[], now: Date = new Date()): number {
  const L = mastery(topic, now);
  const novelty = recentHistory.includes(topic.topic_id) ? CONFIG.RECO.VELOCITY_RECENT_NOVELTY : 1;
  return Math.min(1, Math.max(0, Math.pow(1 - L, CONFIG.RECO.VELOCITY_ETA) * novelty));
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
    curriculumVelocity: curriculumVelocity(topic, ctx.recentHistory, now),
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
