import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic, TopicStatus } from '@/domain/types';
import { predictRetention } from './retention';

/**
 * The single recalculation path — Document 2 §3 (strength) and §4 (self-tuning
 * kFactor), Document 4 E3-S3.
 *
 * One code path parameterised by the event's `kind`; there is no per-source
 * duplicate. Everything is append-only: `strength` only grows, history is never
 * mutated, and `status` is never written here (it is learner-set, §7) except
 * the one automatic seeding rule in `promote`.
 */

/**
 * Document 2 §3 — strength increment for an event.
 *
 * Study reviews keep the confidence buckets. Tests are **continuous** in
 * `actual_retention` (design 2026-08-09 §2.4, #7): a hard fail and a near-miss
 * no longer collapse to the same flat gain. The piecewise-linear shape is
 * anchored so it is exactly `TEST_GAIN_AT_PASS_MARK` at the 0.80 mark (unchanged
 * there), `TEST_GAIN_MIN` at 0, and `TEST_GAIN_MAX` at 1 — mirroring the
 * `penaltyFrom` anchoring so gain and penalty agree at the mark.
 */
export function strengthIncrement(event: ReviewEvent): number {
  const g = CONFIG.STRENGTH_GAIN;
  if (event.kind === 'study_review') {
    const c = event.confidence_reported;
    if (c <= 2) return g.CONF_LOW;
    if (c === 3) return g.CONF_MID;
    return g.CONF_HIGH; // 4–5
  }
  // test_pass / test_fail — continuous in actual_retention, anchored at the mark.
  const a = event.test!.actual_retention;
  const mark = CONFIG.TEST_PASS_MARK;
  return a <= mark
    ? CONFIG.TEST_GAIN_MIN + (CONFIG.TEST_GAIN_AT_PASS_MARK - CONFIG.TEST_GAIN_MIN) * (a / mark)
    : CONFIG.TEST_GAIN_AT_PASS_MARK +
        (CONFIG.TEST_GAIN_MAX - CONFIG.TEST_GAIN_AT_PASS_MARK) * ((a - mark) / (1 - mark));
}

/**
 * Document 2 §4.2 — tune kFactor from the drift window.
 *
 * Returns the new kFactor. Only adjusts once `DRIFT_MIN` samples exist; clamps
 * to `[K_MIN, K_MAX]`; rounds to 2 dp. Negative average drift means the learner
 * is forgetting *faster* than the model assumed, so the curve is pulled in.
 */
export function tuneKFactor(current: number, driftHistory: readonly number[]): number {
  if (driftHistory.length < CONFIG.DRIFT_MIN) return current;

  const avg = driftHistory.reduce((a, b) => a + b, 0) / driftHistory.length;

  let next = current;
  if (avg < -CONFIG.DRIFT_BAND) next = current * (1 - CONFIG.K_STEP);
  else if (avg > CONFIG.DRIFT_BAND) next = current * (1 + CONFIG.K_STEP);
  else return current; // within band, no change

  next = Math.min(CONFIG.K_MAX, Math.max(CONFIG.K_MIN, next));
  const rounded = Math.round(next * 100) / 100;

  // Persist only if it actually moved (Document 2 §4.2).
  return Math.abs(rounded - current) > CONFIG.K_EPSILON ? rounded : current;
}

/** Push a drift sample, keeping only the most recent DRIFT_WINDOW (§4.1). */
export function pushDrift(history: readonly number[], drift: number): number[] {
  return [...history, drift].slice(-CONFIG.DRIFT_WINDOW);
}

/**
 * Apply one logged event to a topic, returning a new Topic.
 *
 * Pure: the caller decides whether to adopt the result, which keeps commits
 * atomic (Document 4 E2-S4). `now` is injectable so the worked example and the
 * tests are reproducible.
 */
export function applyEvent(topic: Topic, event: ReviewEvent, now: Date = new Date()): Topic {
  const next: Topic = {
    ...topic,
    review_history: [...topic.review_history, event],
    drift_history: [...topic.drift_history],
    error_log: [...topic.error_log],
  };

  // Drift must be measured against the curve as it stood *before* this event
  // lands (Document 2 §4.1: "predicted via §2 just before the event").
  if (!event.smeared && event.test && (event.kind === 'test_pass' || event.kind === 'test_fail')) {
    const predicted = predictRetention(topic, new Date(event.date));
    if (predicted !== null) {
      const drift = event.test.actual_retention - predicted;
      next.drift_history = pushDrift(next.drift_history, drift);
      next.k_factor = tuneKFactor(topic.k_factor, next.drift_history);
    }
  }

  // strength only ever grows (Document 2 §3)
  next.strength = topic.strength + strengthIncrement(event);
  next.conf = event.confidence_reported;
  next.last_reviewed = event.date;

  // A logged event on an untouched topic implicitly starts it. Document 2 §7's
  // seeding rule applies on the promotion out of Not Started.
  if (topic.status === 'not_started') {
    return promote(next, 'learning', now);
  }

  return next;
}

/**
 * Change a topic's status — Document 2 §7.
 *
 * Two automatic rules live here and nowhere else:
 *  1. First promotion out of Not Started seeds `strength` to 1.0 (if falsy) and
 *     stamps `last_reviewed` to today.
 *  2. First arrival at Mastered stamps `mastered_at` (Document 1 v0.2.1 §2.3) —
 *     never cleared, because §10 asks how many topics have *ever* mastered.
 *
 * The math never demotes; only the learner does (§7).
 */
export function promote(topic: Topic, status: TopicStatus, now: Date = new Date()): Topic {
  const next: Topic = { ...topic, status };

  if (topic.status === 'not_started' && status !== 'not_started') {
    if (!next.strength) next.strength = CONFIG.SEED_STRENGTH;
    if (!next.last_reviewed) next.last_reviewed = now.toISOString();
  }

  if (status === 'mastered' && next.mastered_at === null) {
    next.mastered_at = now.toISOString();
  }

  return next;
}
