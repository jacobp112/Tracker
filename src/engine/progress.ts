import { allTopics, type Store } from '@/domain/types';
import { predictRetention } from './retention';

/**
 * Progress aggregations — all derived live, none stored (Document 1 §2.3).
 *
 * EXP answers "what can I retrieve today?": the sum, over every started topic,
 * of the fraction you could retrieve right now. That fraction IS retention, so
 * EXP is `Σ retention`. It is deliberately not weighted by strength — strength
 * is unbounded and grows on every review, which would let activity inflate the
 * number and let one drilled topic dominate. Strength is still rewarded, but
 * temporally: a strong topic decays slower, so it holds its retention longer —
 * visible in the trend, not as a bigger number today.
 */

export interface Retrievable {
  /** Σ retention over started topics. */
  exp: number;
  /** Count of started topics — the knowable ceiling EXP is rendered against. */
  ceiling: number;
}

export function retrievable(store: Store, now: Date = new Date()): Retrievable {
  let exp = 0;
  let ceiling = 0;
  for (const { topic } of allTopics(store)) {
    if (topic.status === 'not_started') continue;
    ceiling += 1;
    const r = predictRetention(topic, now);
    if (r !== null) exp += Math.min(1, r); // clamp guards clock skew / backdating
  }
  return { exp, ceiling };
}
