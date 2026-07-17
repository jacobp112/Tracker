import type { Course, Topic } from '@/domain/types';
import { toLocalDateKey, type ActivityDay } from '@/components/ActivityCalendar';
import type { SparkPoint } from '@/components/Sparkline';
import { courseTopics } from './course';
import { predictRetention } from './retention';

/**
 * Historical series for the dashboard's two charts (Document 3 §5.2).
 *
 * Both are *reconstructed* from the event log rather than stored — same
 * principle as retention itself (Document 1 v0.2 §2.3). Nothing here is
 * persisted, so nothing can go stale.
 */

/**
 * A topic's state as it stood on a past date, rebuilt from `review_history`.
 *
 * Only fields that affect retention are rewound (`strength`, `last_reviewed`).
 * `k_factor` is *not* rewound: the drift history that tuned it isn't
 * timestamped per adjustment, so its past values aren't recoverable. Using the
 * current k for past points is a deliberate approximation — it means the curve
 * shows "what today's model says the past looked like", which is honest for a
 * trend line and cannot mislead about the present.
 */
function topicAsOf(topic: Topic, date: Date): Topic | null {
  const events = topic.review_history
    .filter((e) => new Date(e.date).getTime() <= date.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (events.length === 0) return null;

  // Rebuild strength by replaying the increments that had happened by `date`.
  // Importing the increment table would be circular, so recompute from source
  // of truth: strength is the sum of increments (Document 2 §3).
  return {
    ...topic,
    strength: replayStrength(topic, events.length),
    last_reviewed: events[events.length - 1]!.date,
    // A topic can't have been Not Started once it had a logged event.
    status: topic.status === 'not_started' ? 'learning' : topic.status,
  };
}

/**
 * Strength after the first `n` events. Reconstructed by subtracting the
 * increments of the events that came *after* n, which avoids duplicating the
 * increment table and stays correct as long as strength is append-only (§3).
 */
function replayStrength(topic: Topic, n: number): number {
  const later = topic.review_history.slice(n);
  const subtract = later.reduce((acc, e) => acc + incrementOf(e.kind, e.confidence_reported), 0);
  return Math.max(0, topic.strength - subtract);
}

// Local mirror of Document 2 §3 to keep this module free of a cycle through
// recalculate.ts. Kept beside the table it mirrors via the shared CONFIG.
import { CONFIG } from '@/config/constants';
function incrementOf(kind: string, conf: number): number {
  const g = CONFIG.STRENGTH_GAIN;
  if (kind === 'test_pass') return g.TEST_PASS;
  if (kind === 'test_fail') return g.TEST_FAIL;
  if (conf <= 2) return g.CONF_LOW;
  if (conf === 3) return g.CONF_MID;
  return g.CONF_HIGH;
}

/**
 * Average retention across the course for each of the last `days` days —
 * the hero sparkline's series (Document 3 §5.2).
 */
export function retentionSeries(course: Course, days = 30, now: Date = new Date()): SparkPoint[] {
  const refs = courseTopics(course);
  const out: SparkPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const values: number[] = [];
    for (const { topic } of refs) {
      const past = topicAsOf(topic, date);
      if (!past) continue;
      const r = predictRetention(past, date);
      if (r !== null) values.push(r);
    }

    out.push({
      value: values.length === 0 ? 0 : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100),
      date,
    });
  }

  return out;
}

/**
 * Study-session volume per day — the activity calendar's series
 * (Document 3 §5.2, ramp §2.2b). Counts *sessions*, not topics touched, so a
 * single long session doesn't read as a heavy day per topic covered.
 */
export function activitySeries(course: Course): ActivityDay[] {
  const counts = new Map<string, Set<string>>();

  for (const { topic } of courseTopics(course)) {
    for (const event of topic.review_history) {
      const key = toLocalDateKey(new Date(event.date));
      let bucket = counts.get(key);
      if (!bucket) {
        bucket = new Set();
        counts.set(key, bucket);
      }
      // Dedupe by source_id: one session covering six topics is one session.
      bucket.add(event.source_id);
    }
  }

  return [...counts.entries()].map(([date, sources]) => ({ date, count: sources.size }));
}
