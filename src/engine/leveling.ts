import { CONFIG } from '@/config/constants';
import { allTopics, type Store, type Topic } from '@/domain/types';
import { health } from './metrics';
import { topicStateAsOf } from './replay';

/**
 * Per-topic and overall leveling — a live view of genuine progress.
 *
 * Computed live from stored state; none stored (Document 1 v0.2 §2.3). A level
 * is not a field on the Topic — it is `health` (Document 2 §6) read through a
 * banding table and gated so that only *validated* progress reaches the top.
 * Nothing here writes to the Store.
 */

/** Highest attainable level — one band per threshold in the table. */
export const MAX_LEVEL = CONFIG.LEVEL.HEALTH_BANDS.length;

/** True once the topic has at least one passed test — the validation signal. */
function hasPassedTest(topic: Topic): boolean {
  return topic.review_history.some((e) => e.kind === 'test_pass');
}

/**
 * A topic's level, 0…MAX_LEVEL — Document 2 §6 health, banded and gated on
 * genuine progress rather than activity.
 *
 * Banding (single source of truth: CONFIG.LEVEL):
 *  - `not_started` → 0. No progress has been made, whatever the derived numbers
 *    happen to say; status gates this ahead of health.
 *  - Otherwise the base level is how many `HEALTH_BANDS` thresholds `health`
 *    clears (health 80 over [25,45,62,78,90] → 4).
 *  - **Validation cap:** with no passed test the level cannot exceed
 *    `UNVALIDATED_CAP`. Health credits self-reported confidence and treats a
 *    testless topic as perfectly calibrated, so the upper bands are reserved
 *    for topics a test has actually vindicated.
 *  - **Mastery cap:** the top level is reserved for `mastered` (Document 2 §7).
 *    A topic can sit one below on health and validation alone; the final rung
 *    is the mastery ladder's, not something confidence can buy.
 */
export function topicLevel(topic: Topic, now: Date = new Date()): number {
  if (topic.status === 'not_started') return 0;

  const h = health(topic, now);
  let level = CONFIG.LEVEL.HEALTH_BANDS.filter((band) => h >= band).length;

  if (!hasPassedTest(topic)) level = Math.min(level, CONFIG.LEVEL.UNVALIDATED_CAP);
  if (topic.status !== 'mastered') level = Math.min(level, MAX_LEVEL - 1);

  return level;
}

/**
 * The ratchet: the highest level this topic has ever legitimately reached.
 *
 * `topicLevel` reads health, which includes retention, so a mastered-then-decayed
 * topic's current level falls. The watermark evaluates `topicLevel` at every
 * boundary where the level could have peaked — each event date (health peaks
 * right after an event, since retention only decays between them) plus
 * `mastered_at` (the status flip that unlocks level 5 need not fall on an event
 * date) — and takes the max. Derived, unstored, and non-decreasing over time.
 *
 * Event-sourced fields are reconstructed exactly via `topicStateAsOf`; active
 * errors are date-filtered from the log; mastery status comes from `mastered_at`.
 * Flashcard count is not event-sourced and is held at its current value — the
 * lone approximation, bounded by W_CARD (the smallest health weight).
 */
export function topicLevelHighWater(topic: Topic, now: Date = new Date()): number {
  const boundaries: Date[] = topic.review_history.map((e) => new Date(e.date));
  if (topic.mastered_at) boundaries.push(new Date(topic.mastered_at));

  let max = topicLevel(topic, now); // live level covers status not present in history

  for (const d of boundaries) {
    if (d.getTime() > now.getTime()) continue;

    const base = topicStateAsOf(topic, d);
    const activeErrors = topic.error_log.filter(
      (e) =>
        new Date(e.date).getTime() <= d.getTime() &&
        (!e.resolved || e.resolved_date === null || new Date(e.resolved_date).getTime() > d.getTime()),
    );
    const mastered = topic.mastered_at !== null && new Date(topic.mastered_at).getTime() <= d.getTime();

    const snapshot: Topic = {
      ...base,
      cards: topic.cards,
      error_log: activeErrors,
      status: mastered ? 'mastered' : base.status,
    };

    const lvl = topicLevel(snapshot, d);
    if (lvl > max) max = lvl;
  }

  return max;
}

/**
 * The store's overall level — the rounded mean topic level across every course
 * (Document 1 `allTopics`). Not-started topics count as the 0s they are, so the
 * figure reflects real progress across the whole tracker rather than only the
 * topics already in motion. 0 when there are no topics.
 */
export function overallLevel(store: Store, now: Date = new Date()): number {
  const topics = allTopics(store);
  if (topics.length === 0) return 0;

  const sum = topics.reduce((acc, { topic }) => acc + topicLevel(topic, now), 0);
  return Math.round(sum / topics.length);
}

export interface LevelUp {
  topic: Topic;
  from: number;
  to: number;
}

/**
 * Level-ups introduced by a single commit. A watermark is a max over past
 * states, so only a topic that received an event this commit can level up —
 * we restrict to topics whose review_history length changed, which makes
 * "level-ups are evidence-only" structural rather than emergent (and avoids a
 * full-corpus scan). Deltas are non-negative by construction.
 */
export function levelUps(oldStore: Store, newStore: Store, now: Date = new Date()): LevelUp[] {
  const oldById = new Map(allTopics(oldStore).map(({ topic }) => [topic.topic_id, topic]));
  const out: LevelUp[] = [];

  for (const { topic } of allTopics(newStore)) {
    const prev = oldById.get(topic.topic_id);
    if (!prev) continue; // brand-new topics start not_started → level 0
    if (prev.review_history.length === topic.review_history.length) continue; // untouched

    const to = topicLevelHighWater(topic, now);
    const from = topicLevelHighWater(prev, now);
    if (to > from) out.push({ topic, from, to });
  }

  return out;
}
