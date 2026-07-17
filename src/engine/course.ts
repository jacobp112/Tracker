import { CONFIG } from '@/config/constants';
import type { Course, Section, Topic } from '@/domain/types';
import { health, shouldShowHealth } from './metrics';
import { isDue, predictRetention } from './retention';

/**
 * Course-level derivations — Document 2 §9 (weak ranking), §10 (velocity &
 * projection), §11 (due queue).
 */

export interface TopicRef {
  topic: Topic;
  section: Section;
}

export function courseTopics(course: Course): TopicRef[] {
  return course.sections.flatMap((section) => section.topics.map((topic) => ({ topic, section })));
}

/**
 * Weak-topic ranking — Document 2 §9.
 *  1. lowest health first
 *  2. tie-break: lowest retention first
 *  3. exclude Not Started and Mastered (nothing to act on / already done)
 */
export function weakTopics(refs: readonly TopicRef[], now: Date = new Date()): TopicRef[] {
  return refs
    .filter((r) => r.topic.status !== 'not_started' && r.topic.status !== 'mastered')
    .map((r) => ({
      ref: r,
      health: health(r.topic, now),
      // Undefined retention sorts last among ties rather than being coerced to 0.
      retention: predictRetention(r.topic, now) ?? Infinity,
    }))
    .sort((a, b) => a.health - b.health || a.retention - b.retention)
    .map((x) => x.ref);
}

/** Mean health across the course's *active* topics — the hero ring (Doc 3 §5.2). */
export function courseHealth(refs: readonly TopicRef[], now: Date = new Date()): number | null {
  const active = refs.filter((r) => shouldShowHealth(r.topic));
  if (active.length === 0) return null;
  const sum = active.reduce((acc, r) => acc + health(r.topic, now), 0);
  return Math.round(sum / active.length);
}

/** Mean live retention across topics that have one. Null when none do. */
export function averageRetention(refs: readonly TopicRef[], now: Date = new Date()): number | null {
  const values = refs
    .map((r) => predictRetention(r.topic, now))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return (values.reduce((a, b) => a + b, 0) / values.length) * 100;
}

/* ── Velocity & projection — Document 2 §10 ──────────────────────── */

export type Velocity =
  | { defined: true; topicsPerWeek: number }
  | { defined: false; reason: 'not_enough_data' };

const DAYS_PER_WEEK = 7;

/**
 * `velocity = topics reaching Mastered in the last VELOCITY_WINDOW_WEEKS / VELOCITY_WINDOW_WEEKS`
 *
 * **Low-data guard (§10):** if fewer than 2 topics have *ever* reached Mastered,
 * velocity is undefined — the projection must say "Not enough data yet", never
 * fabricate or divide by zero. `mastered_at` is what makes "ever" answerable
 * (Document 1 v0.2.1 §2.3).
 */
export function velocity(refs: readonly TopicRef[], now: Date = new Date()): Velocity {
  const everMastered = refs.filter((r) => r.topic.mastered_at !== null);
  if (everMastered.length < CONFIG.VELOCITY_MIN_MASTERED) {
    return { defined: false, reason: 'not_enough_data' };
  }

  const windowMs = CONFIG.VELOCITY_WINDOW_WEEKS * DAYS_PER_WEEK * 86_400_000;
  const cutoff = now.getTime() - windowMs;
  const recent = everMastered.filter((r) => new Date(r.topic.mastered_at!).getTime() >= cutoff);

  return { defined: true, topicsPerWeek: recent.length / CONFIG.VELOCITY_WINDOW_WEEKS };
}

export type Projection =
  | { state: 'complete' }
  | { state: 'not_enough_data' }
  | { state: 'range'; best: Date; worst: Date; topicsPerWeek: number };

/**
 * Projected finish — Document 2 §10. Always a **range**, never a single date.
 *
 *   best  = today + remaining / (velocity × 1.25) weeks
 *   worst = today + remaining / (velocity × 0.75) weeks
 */
export function projectFinish(refs: readonly TopicRef[], now: Date = new Date()): Projection {
  const remaining = refs.filter((r) => r.topic.status !== 'mastered').length;
  if (remaining === 0) return { state: 'complete' };

  const v = velocity(refs, now);
  if (!v.defined) return { state: 'not_enough_data' };

  // Guard the divide: 2+ topics mastered historically but none inside the
  // window yields a rate of 0, which would project an infinite date.
  if (v.topicsPerWeek <= 0) return { state: 'not_enough_data' };

  const weeksAt = (rate: number) => (remaining / rate) * DAYS_PER_WEEK * 86_400_000;
  const best = new Date(now.getTime() + weeksAt(v.topicsPerWeek * CONFIG.PROJECTION_OPTIMISM));
  const worst = new Date(now.getTime() + weeksAt(v.topicsPerWeek * CONFIG.PROJECTION_PESSIMISM));

  return { state: 'range', best, worst, topicsPerWeek: v.topicsPerWeek };
}

/* ── Due queue — Document 2 §11 ──────────────────────────────────── */

/**
 * Topics with `R < DUE_THRESHOLD`, lowest retention first, then **section
 * spreading**: prefer not to place two consecutive topics from the same
 * section, so the queue interleaves subjects rather than dumping one section.
 */
export function dueQueue(
  refs: readonly TopicRef[],
  size: number = CONFIG.REVIEW_QUEUE_SIZE,
  now: Date = new Date(),
): TopicRef[] {
  const pool = refs
    .filter((r) => isDue(r.topic, now))
    .sort((a, b) => (predictRetention(a.topic, now) ?? 0) - (predictRetention(b.topic, now) ?? 0));

  const picked: TopicRef[] = [];
  const remaining = [...pool];

  while (picked.length < size && remaining.length > 0) {
    const lastSection = picked[picked.length - 1]?.section.section_id;
    // Prefer the most-decayed topic from a different section; fall back to the
    // most-decayed overall when every candidate shares the last section.
    const idx = remaining.findIndex((r) => r.section.section_id !== lastSection);
    const take = idx === -1 ? 0 : idx;
    picked.push(remaining[take]!);
    remaining.splice(take, 1);
  }

  return picked;
}
