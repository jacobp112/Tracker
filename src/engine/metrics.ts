import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';
import { predictRetention } from './retention';

/**
 * Derived per-topic metrics — Document 2 §5 (OCI), §6 (health), §8 (badges).
 * All computed live; none stored (Document 1 v0.2 §2.3).
 */

export function testEvents(topic: Topic): ReviewEvent[] {
  return topic.review_history.filter((e) => e.kind === 'test_pass' || e.kind === 'test_fail');
}

export function activeErrorCount(topic: Topic): number {
  return topic.error_log.filter((e) => !e.resolved).length;
}

/**
 * Overconfidence Index — Document 2 §5.
 *   `OCI = mean over tests of [ (confidence / 5) − (score / outOf) ]`
 * Topics with no tests have `OCI = 0` by definition.
 */
export function overconfidenceIndex(topic: Topic): number {
  const tests = testEvents(topic);
  if (tests.length === 0) return 0;

  const sum = tests.reduce((acc, e) => {
    const t = e.test!;
    return acc + (e.confidence_reported / CONFIG.CONF_MAX - t.score / t.out_of);
  }, 0);

  return sum / tests.length;
}

/* ── Health sub-scores (Document 2 §6) ───────────────────────────── */

export function retentionScore(topic: Topic, now: Date): number {
  const r = predictRetention(topic, now);
  return r === null ? 0 : r * 100; // 0 if undefined, per §6
}

/** By count of **active** errors: 0 → 100, 1 → 70, 2 → 40, ≥3 → 0. */
export function errorScore(topic: Topic): number {
  const n = activeErrorCount(topic);
  const steps = CONFIG.ERROR_SCORE;
  return steps[Math.min(n, steps.length - 1)]!;
}

/** `100 × (1 − |OCI|)`, floored at 0; **100 if the topic has no tests**. */
export function calibrationScore(topic: Topic): number {
  if (testEvents(topic).length === 0) return 100;
  return Math.max(0, 100 * (1 - Math.abs(overconfidenceIndex(topic))));
}

/** `(confidence / 5) × 100`. */
export function confidenceScore(topic: Topic): number {
  return (topic.conf / CONFIG.CONF_MAX) * 100;
}

/** `min(100, cardCount × 20)` — full at 5+ flashcards. */
export function cardScore(topic: Topic): number {
  return Math.min(100, topic.cards * CONFIG.CARD_SCORE_PER_CARD);
}

/**
 * Composite health, 0–100 — Document 2 §6. Rounded to an integer.
 *
 * Computable for any topic; Document 2 §6 says it is only *surfaced* for
 * Practising/Mastered (see `shouldShowHealth`). That's a presentation rule, so
 * it isn't enforced here.
 */
export function health(topic: Topic, now: Date = new Date()): number {
  const value =
    CONFIG.W_RET * retentionScore(topic, now) +
    CONFIG.W_ERR * errorScore(topic) +
    CONFIG.W_CAL * calibrationScore(topic) +
    CONFIG.W_CONF * confidenceScore(topic) +
    CONFIG.W_CARD * cardScore(topic);

  return Math.round(value);
}

/** Document 2 §6: health is only surfaced at Practising or Mastered. */
export function shouldShowHealth(topic: Topic): boolean {
  return topic.status === 'practising' || topic.status === 'mastered';
}

/* ── Diagnostic badges (Document 2 §8) ───────────────────────────── */

export type BadgeId =
  | 'slow_growth'
  | 'boredom_zone'
  | 'brittle_fluency'
  | 'under_carded'
  | 'ready_to_test';

export interface Badge {
  id: BadgeId;
  label: string;
  tone: 'ok' | 'warn' | 'bad';
  meaning: string;
}

export const BADGE_META: Record<BadgeId, Omit<Badge, 'id'>> = {
  slow_growth: {
    label: 'Slow growth',
    tone: 'warn',
    meaning: "strength isn't moving despite repeated review — change method",
  },
  boredom_zone: {
    label: 'Boredom zone',
    tone: 'warn',
    meaning: 'over-reviewed a solid topic — rotate out',
  },
  brittle_fluency: {
    label: 'Brittle fluency',
    tone: 'bad',
    meaning: 'felt fluent, latest test missed the 80% bar',
  },
  under_carded: {
    label: 'Under-carded',
    tone: 'warn',
    meaning: 'recurring misconceptions but no flashcards made',
  },
  ready_to_test: {
    label: 'Ready to test',
    tone: 'ok',
    meaning: 'good fluency after real work — validate with a timed set',
  },
};

/** `velocity = strength / reviewCount` (0 if no reviews) — Document 2 §8. */
export function topicVelocity(topic: Topic): number {
  const reviews = topic.review_history.length;
  return reviews === 0 ? 0 : topic.strength / reviews;
}

/** `lastFailed` = latest test scored < 0.80 × outOf — Document 2 §8. */
export function lastFailed(topic: Topic): boolean {
  const tests = testEvents(topic);
  const latest = tests[tests.length - 1];
  if (!latest?.test) return false;
  return latest.test.score < CONFIG.TEST_PASS_MARK * latest.test.out_of;
}

export function badges(topic: Topic): Badge[] {
  const out: BadgeId[] = [];
  const reviews = topic.review_history.length;
  const velocity = topicVelocity(topic);
  const errors = activeErrorCount(topic);
  const failed = lastFailed(topic);
  const hasTests = testEvents(topic).length > 0;

  if (reviews >= 3 && velocity < CONFIG.SLOW_V) out.push('slow_growth');
  if (topic.conf === 5 && reviews >= 4 && errors === 0 && !failed) out.push('boredom_zone');
  if (topic.conf >= 4 && failed) out.push('brittle_fluency');
  if (errors >= 2 && topic.cards === 0) out.push('under_carded');
  if (
    topic.conf >= 4 &&
    !failed &&
    hasTests &&
    velocity >= CONFIG.SLOW_V &&
    topic.status !== 'not_started'
  ) {
    out.push('ready_to_test');
  }

  return out.map((id) => ({ id, ...BADGE_META[id] }));
}
