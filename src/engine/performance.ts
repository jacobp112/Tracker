import { CONFIG } from '@/config/constants';
import type { ReviewEvent } from '@/domain/types';

/**
 * Performance layer — design 2026-08-10 §D. Pure, read-only over ReviewEvent[].
 * Nothing here feeds retention/health/levels (§A read-side-only invariant).
 */

const P = CONFIG.PERFORMANCE;

/** Realised success in [0,1]: test score first, else quality/5, else undefined.
 *  Never fabricated (design §D commensurability decision). */
export function observedSuccess(e: ReviewEvent): number | undefined {
  if (e.test) return e.test.actual_retention;
  const q = e.assessment?.performance_quality;
  return q === undefined ? undefined : q / P.QUALITY_MAX;
}

/** Independent === 3 ONLY (design §10). A minor prompt (2) is still assistance. */
export function isIndependent(e: ReviewEvent): boolean {
  return e.assessment?.independence === 3;
}

export type IndependenceTier = 'independent' | 'lightly_assisted' | 'assisted';

export function independenceTier(e: ReviewEvent): IndependenceTier | undefined {
  const i = e.assessment?.independence;
  if (i === undefined) return undefined;
  if (i === 3) return 'independent';
  if (i === 2) return 'lightly_assisted';
  return 'assisted'; // 0 | 1
}

/** Arithmetic mean, or null for an empty set (never a false zero). */
export function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Mean of `(dim / max) × observedSuccess` over events where BOTH the dimension
 * and an outcome are present. The single source of success-gating (design §18):
 * difficulty/novelty earn credit only paired with a successful outcome, so a
 * hard/novel attempt that was failed contributes ~0 — it is structurally
 * impossible for difficulty or novelty to lift a score without also being
 * solved. Used by both Cold Performance and Performance Health so the two cannot
 * drift apart. Null when no event has both.
 */
export function successGatedMean(
  events: ReviewEvent[],
  pick: (e: ReviewEvent) => number | undefined,
  max: number,
): number | null {
  return mean(
    events
      .map((e) => {
        const dim = pick(e);
        const s = observedSuccess(e);
        return dim === undefined || s === undefined ? undefined : (dim / max) * s;
      })
      .filter((x): x is number => x !== undefined),
  );
}

/**
 * Weighted composite over parts, re-normalising to the weights of the parts that
 * actually have a score. A null score drops out (never treated as 0). Returns
 * null when no part has a score (graceful degradation, design §D).
 */
export function weightedComposite(parts: Array<{ weight: number; score: number | null }>): number | null {
  const present = parts.filter((p): p is { weight: number; score: number } => p.score !== null);
  if (present.length === 0) return null;
  const wsum = present.reduce((a, p) => a + p.weight, 0);
  if (wsum === 0) return null;
  return present.reduce((a, p) => a + p.weight * p.score, 0) / wsum;
}

export interface TierStats {
  n: number;
  accuracy: number | null;
  avgDifficulty: number | null;
  avgNovelty: number | null;
}

export interface IndependentPerformance {
  independent: TierStats;
  lightlyAssisted: TierStats;
  assisted: TierStats;
  /** independent.n >= MIN_INDEPENDENT_N — is the headline safe to present? */
  sufficient: boolean;
}

function tierStats(events: ReviewEvent[]): TierStats {
  const outcomes = events.map(observedSuccess).filter((x): x is number => x !== undefined);
  const diffs = events
    .map((e) => e.assessment?.difficulty)
    .filter((x): x is Exclude<typeof x, undefined> => x !== undefined) as number[];
  const novs = events
    .map((e) => e.assessment?.novelty)
    .filter((x): x is Exclude<typeof x, undefined> => x !== undefined) as number[];
  return {
    n: events.length,
    accuracy: mean(outcomes),
    avgDifficulty: mean(diffs),
    avgNovelty: mean(novs),
  };
}

/** Independent / lightly-assisted / assisted breakdown (design §10). Null when no
 *  attempt carries an independence value — nothing to say. */
export function independentPerformance(events: ReviewEvent[]): IndependentPerformance | null {
  const tiered = { independent: [] as ReviewEvent[], lightly_assisted: [] as ReviewEvent[], assisted: [] as ReviewEvent[] };
  let any = false;
  for (const e of events) {
    const t = independenceTier(e);
    if (t === undefined) continue;
    any = true;
    tiered[t].push(e);
  }
  if (!any) return null;
  return {
    independent: tierStats(tiered.independent),
    lightlyAssisted: tierStats(tiered.lightly_assisted),
    assisted: tierStats(tiered.assisted),
    sufficient: tiered.independent.length >= P.MIN_INDEPENDENT_N,
  };
}

export interface TransferAbility {
  score: number; // 0–100
  n: number;
  trend: number | null; // later-half minus earlier-half, in score points
}

/** Mean transfer_level → 0–100, with a recent-vs-earlier trend. Null below
 *  MIN_TRANSFER_N so a high score never rests on 1–2 observations (design §9). */
export function transferAbility(events: ReviewEvent[]): TransferAbility | null {
  const dated = events
    .filter((e) => e.assessment?.transfer_level !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (dated.length < P.MIN_TRANSFER_N) return null;

  const toScore = (e: ReviewEvent) => (e.assessment!.transfer_level! / P.TRANSFER_MAX) * 100;
  const score = mean(dated.map(toScore))!;

  const mid = Math.floor(dated.length / 2);
  const earlier = mean(dated.slice(0, mid).map(toScore));
  const later = mean(dated.slice(dated.length - mid).map(toScore));
  const trend = earlier === null || later === null ? null : later - earlier;

  return { score, n: dated.length, trend };
}

export interface ColdPerformance {
  score: number; // 0–100
  n: number;
}

/** Weighted composite over the present dimensions of cold attempts only,
 *  re-normalising over missing ones (never zero-filled). Null below MIN_COLD_N
 *  (design §8). */
export function coldPerformance(events: ReviewEvent[]): ColdPerformance | null {
  const coldEvents = events.filter((e) => e.assessment?.cold === true);
  if (coldEvents.length < P.MIN_COLD_N) return null;

  const w = P.COLD_WEIGHTS;
  // Direct present-value mean (correctness claims not gated: independence/transfer
  // aren't correctness, quality encodes it via rubric).
  const dim = (pick: (e: ReviewEvent) => number | undefined, max: number): number | null =>
    mean(coldEvents.map(pick).filter((x): x is number => x !== undefined).map((x) => x / max));

  const correctness = mean(
    coldEvents.map(observedSuccess).filter((x): x is number => x !== undefined),
  );

  const composite = weightedComposite([
    { weight: w.correctness, score: correctness },
    // §18 — difficulty & novelty success-gated, so failed hard/novel cold work
    // banks no credit (same mechanism as Performance Health).
    { weight: w.difficulty, score: successGatedMean(coldEvents, (e) => e.assessment?.difficulty, P.DIFFICULTY_MAX) },
    { weight: w.novelty, score: successGatedMean(coldEvents, (e) => e.assessment?.novelty, P.NOVELTY_MAX) },
    { weight: w.independence, score: dim((e) => e.assessment?.independence, P.INDEPENDENCE_MAX) },
    { weight: w.transfer, score: dim((e) => e.assessment?.transfer_level, P.TRANSFER_MAX) },
    { weight: w.quality, score: dim((e) => e.assessment?.performance_quality, P.QUALITY_MAX) },
  ]);

  return composite === null ? null : { score: composite * 100, n: coldEvents.length };
}

export interface DimensionBucket {
  level: number;
  n: number;
  successRate: number | null;
}

function bucketBy(
  events: ReviewEvent[],
  pick: (e: ReviewEvent) => number | undefined,
): DimensionBucket[] {
  const byLevel = new Map<number, ReviewEvent[]>();
  for (const e of events) {
    if (!isIndependent(e)) continue; // INVARIANT: === 3 only (design §10)
    const level = pick(e);
    if (level === undefined) continue;
    (byLevel.get(level) ?? byLevel.set(level, []).get(level)!).push(e);
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, es]) => {
      const outcomes = es.map(observedSuccess).filter((x): x is number => x !== undefined);
      const passes = outcomes.filter((x) => x >= CONFIG.TEST_PASS_MARK).length;
      return {
        level,
        n: es.length,
        successRate: outcomes.length === 0 ? null : passes / outcomes.length,
      };
    });
}

/** Pass-rate by difficulty over independent (===3) attempts only (design §13). */
export function performanceByDifficulty(events: ReviewEvent[]): DimensionBucket[] {
  return bucketBy(events, (e) => e.assessment?.difficulty);
}

/** Pass-rate by novelty over independent (===3) attempts only (design §13). */
export function performanceByNovelty(events: ReviewEvent[]): DimensionBucket[] {
  return bucketBy(events, (e) => e.assessment?.novelty);
}

export interface Calibration {
  meanAbsError: number;
  bias: number; // mean(predicted − observed); positive = over-prediction
  n: number;
}

/** Foresight rule (design §D, §11): predicted_success AND predicted_at present,
 *  and predicted_at STRICTLY before the attempt's date. Absence or a
 *  not-strictly-before timestamp → hindsight → excluded. */
export function isForesightPrediction(e: ReviewEvent): boolean {
  const a = e.assessment;
  if (!a || a.predicted_success === undefined || a.predicted_at === undefined) return false;
  return new Date(a.predicted_at).getTime() < new Date(e.date).getTime();
}

/** Tutor-prediction-vs-outcome error over foresight predictions only. Distinct
 *  from OCI (confidence-vs-performance). Null below MIN_CALIBRATION_N. */
export function calibrationError(events: ReviewEvent[]): Calibration | null {
  const pairs: Array<{ predicted: number; observed: number }> = [];
  for (const e of events) {
    if (!isForesightPrediction(e)) continue;
    const observed = observedSuccess(e);
    if (observed === undefined) continue;
    pairs.push({ predicted: e.assessment!.predicted_success!, observed });
  }
  if (pairs.length < P.MIN_CALIBRATION_N) return null;
  return {
    meanAbsError: mean(pairs.map((p) => Math.abs(p.predicted - p.observed)))!,
    bias: mean(pairs.map((p) => p.predicted - p.observed))!,
    n: pairs.length,
  };
}
