import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

/**
 * The lapse fold (design 2026-08-09 §2.2–2.3). Derived, never stored. Kept in
 * its own module (CONFIG + types only) so retention can read it without the
 * retention → replay → recalculate → retention import cycle.
 */

/** Continuous fail penalty: 1.0 at the pass mark → PENALTY_FLOOR at 0. */
export function penaltyFrom(actualRetention: number): number {
  const floor = CONFIG.PENALTY_FLOOR;
  const p = floor + (1 - floor) * (actualRetention / CONFIG.TEST_PASS_MARK);
  return Math.min(1, Math.max(floor, p));
}

/** Multiplicative P over ordered events. Fails penalise (smeared → dampened);
 *  passes recover asymmetrically, capped at 1. */
export function lapseFactor(events: readonly ReviewEvent[]): number {
  let P = 1;
  for (const e of events) {
    if (e.kind === 'test_fail' && e.test) {
      let pen = penaltyFrom(e.test.actual_retention);
      if (e.smeared) pen = 1 - (1 - pen) * CONFIG.SMEAR_PENALTY_WEIGHT;
      P *= pen;
    } else if (e.kind === 'test_pass') {
      P = Math.min(1, P * CONFIG.LAPSE_RECOVERY);
    }
  }
  return P;
}

const memo = new WeakMap<ReviewEvent[], number>();

/** s_eff = max(S_EFF_MIN, strength · P). Memoised on the review_history array
 *  reference (a fresh array on every immutable topic update). */
export function effectiveStrength(topic: Topic): number {
  let P = memo.get(topic.review_history);
  if (P === undefined) {
    P = lapseFactor(topic.review_history);
    memo.set(topic.review_history, P);
  }
  return Math.max(CONFIG.S_EFF_MIN, topic.strength * P);
}
