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
