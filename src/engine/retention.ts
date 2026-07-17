import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';

/**
 * Retention — Document 2 §2, and the projected due date — §2.1.
 *
 * Everything here is **derived live**, never stored (Document 1 v0.2 §2.3):
 * a topic decays between visits with no event, and that continuous decay is the
 * product's core behaviour.
 */

export const MS_PER_DAY = 86_400_000;

/** Whole days elapsed, per Document 2 §2 ("`t`: whole days elapsed"). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * `R(t) = e^(−t / (k·s))`, 0–1.
 *
 * Returns **null** — not a number — when the topic has never been reviewed or
 * is Not Started (Document 2 §2). The UI shows "—", never 0%. Callers must
 * handle null rather than coercing it, which is why this isn't `0`.
 */
export function predictRetention(topic: Topic, now: Date = new Date()): number | null {
  if (topic.last_reviewed === null || topic.status === 'not_started') return null;

  const reviewed = new Date(topic.last_reviewed);
  if (Number.isNaN(reviewed.getTime())) return null;

  if (topic.strength <= 0) return 0;

  const t = daysBetween(reviewed, now);
  if (t <= 0) return 1; // reviewed today

  return Math.exp(-t / (topic.k_factor * topic.strength));
}

/** Retention as a 0–100 percentage, or null. The UI never renders null as 0%. */
export function retentionPct(topic: Topic, now: Date = new Date()): number | null {
  const r = predictRetention(topic, now);
  return r === null ? null : r * 100;
}

/** A topic is due when `R < DUE_THRESHOLD` (Document 2 §2). Never-reviewed
 *  topics are not "due" — they haven't started decaying. */
export function isDue(topic: Topic, now: Date = new Date()): boolean {
  const r = predictRetention(topic, now);
  return r !== null && r < CONFIG.DUE_THRESHOLD;
}

export interface DueProjection {
  date: Date;
  /** True when the topic already fell below the threshold. */
  overdue: boolean;
}

/**
 * Projected due date — Document 2 §2.1. Solves `R(t) = DUE_THRESHOLD` for `t`:
 *   `t_due = −k·s·ln(DUE_THRESHOLD)`
 *
 * Null when retention is undefined or strength is zero — the UI says "not yet
 * reviewed" rather than fabricating a date.
 */
export function projectedDue(topic: Topic, now: Date = new Date()): DueProjection | null {
  if (topic.last_reviewed === null || topic.status === 'not_started') return null;
  if (topic.strength <= 0) return null;

  const reviewed = new Date(topic.last_reviewed);
  if (Number.isNaN(reviewed.getTime())) return null;

  const tDue = -topic.k_factor * topic.strength * Math.log(CONFIG.DUE_THRESHOLD);
  const date = new Date(reviewed.getTime() + tDue * MS_PER_DAY);

  return { date, overdue: date.getTime() < now.getTime() };
}
