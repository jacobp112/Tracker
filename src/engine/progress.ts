import { CONFIG } from '@/config/constants';
import { allTopics, type Store } from '@/domain/types';
import { MS_PER_DAY, predictRetention } from './retention';
import { topicStateAsOf } from './replay';

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

export interface TrendPoint {
  date: Date;
  exp: number;
  ceiling: number;
  /** exp / ceiling — the value the sparkline plots (comparable across time). */
  ratio: number;
}

/**
 * EXP over the last `days` days. Past points are reconstructed by forward-replay
 * (never by subtracting increments — kFactor self-tunes over the event set and
 * is not reversible). The most-recent point is short-circuited to live
 * `retrievable`, which makes it exact even for imported topics whose genesis
 * kFactor differs from DECAY_K.
 */
export function expTrend(
  store: Store,
  now: Date = new Date(),
  days: number = CONFIG.PROGRESS.TREND_DAYS,
): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * MS_PER_DAY);

    if (i === 0) {
      const { exp, ceiling } = retrievable(store, now); // live, exact
      out.push({ date: d, exp, ceiling, ratio: ceiling === 0 ? 0 : exp / ceiling });
      continue;
    }

    let exp = 0;
    let ceiling = 0;
    for (const { topic } of allTopics(store)) {
      const started = topic.review_history.some((e) => new Date(e.date).getTime() <= d.getTime());
      if (!started) continue;
      ceiling += 1;
      const asOf = topicStateAsOf(topic, d);
      const r = predictRetention(asOf, d);
      if (r !== null) exp += Math.min(1, r);
    }
    out.push({ date: d, exp, ceiling, ratio: ceiling === 0 ? 0 : exp / ceiling });
  }
  return out;
}
