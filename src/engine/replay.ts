import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';
import { applyEvent, promote } from './recalculate';

/**
 * Reconstruct a topic's event-sourced state as-of a past date by forward-replay
 * from a known genesis. Strength is additive and kFactor self-tunes over the
 * event set, so we replay forward (never subtract) — provably exact for topics
 * created in-app, where genesis kFactor is DECAY_K.
 *
 * Only the event-sourced fields are reconstructed (strength, k_factor,
 * last_reviewed, conf, status, review_history). Flashcards and the error log are
 * not event-derived; callers needing them for health reconstruct them
 * separately. Nothing here is stored (Document 1 §2.3).
 */
export function topicStateAsOf(topic: Topic, asOf: Date): Topic {
  const genesis: Topic = {
    ...topic,
    status: 'not_started',
    strength: 0,
    k_factor: CONFIG.DECAY_K,
    conf: 1,
    last_reviewed: null,
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
  };

  const events = topic.review_history
    .filter((e) => new Date(e.date).getTime() <= asOf.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let state = genesis;
  for (const e of events) {
    // Promote out of not_started before the first event so seeding happens
    // before the strength increment from that event
    if (state.status === 'not_started') {
      state = promote(state, 'learning', new Date(e.date));
    }
    state = applyEvent(state, e, new Date(e.date));
  }
  return state;
}
