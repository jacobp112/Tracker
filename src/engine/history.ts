import type { Course } from '@/domain/types';
import { toLocalDateKey, type ActivityDay } from '@/components/ActivityCalendar';
import type { SparkPoint } from '@/components/Sparkline';
import { courseTopics } from './course';
import { predictRetention } from './retention';
import { topicStateAsOf } from './replay';

/**
 * Historical series for the dashboard's two charts (Document 3 §5.2).
 *
 * Both are *reconstructed* from the event log rather than stored — same
 * principle as retention itself (Document 1 v0.2 §2.3). Nothing here is
 * persisted, so nothing can go stale.
 *
 * Past points are rebuilt by **forward replay** (`topicStateAsOf`), not by
 * subtracting later increments off the current topic. The subtraction path kept
 * the full `review_history` on each past-state, so once retention began reading
 * the lapse fold (design 2026-08-09) a *future* fail leaked its penalty back
 * onto earlier points. Forward replay only ever sees events up to `date`.
 */

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
      const past = topicStateAsOf(topic, date);
      if (past.last_reviewed === null) continue; // no events by this date
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
