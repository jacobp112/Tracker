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
  /** Σ retention over topics with logged review history. */
  exp: number;
  /** Count of topics with logged review history — the knowable ceiling EXP is rendered against. */
  ceiling: number;
}

export function retrievable(store: Store, now: Date = new Date()): Retrievable {
  let exp = 0;
  let ceiling = 0;
  for (const { topic } of allTopics(store)) {
    // "Started" for EXP means the topic has logged review history — the same
    // predicate expTrend uses for past days, so the live point and the trend
    // can't disagree about which topics exist. A topic merely promoted via the
    // status control (no logged review) has no retrieval evidence and no
    // reconstructable history, so it doesn't count until a review is logged.
    if (!topic.review_history.some((e) => new Date(e.date).getTime() <= now.getTime())) continue;
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

export interface WorkLogged {
  sessions: number;
  hours: number;
  papers: number;
}

/**
 * "What have I put in." Derived from append-only history, so it is monotonic by
 * construction — it never falls, which is exactly what EXP can't promise. Hours
 * are a count × nominal duration (duration is decomposed away on ingestion):
 * exact in the count, honest as a proxy in the hours.
 */
export function workLogged(store: Store): WorkLogged {
  const sessionIds = new Set<string>();
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'session') sessionIds.add(e.source_id);
    }
  }
  const sessions = sessionIds.size;
  const hours = Math.round((sessions * CONFIG.PROGRESS.SESSION_MINUTES) / 60 * 10) / 10;
  return { sessions, hours, papers: store.exams.length };
}
