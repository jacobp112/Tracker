import { toLocalDateKey } from '@/components/ActivityCalendar';
import type { JobStage, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { courseHealth, dueQueue, type TopicRef } from './course';
import { formatPace } from './fitness';

/**
 * Cross-domain aggregations for the Overview — Document 3 §5.1, Document 4 E7-S1.
 * The only screen that spans all domains.
 */

export function allCourseRefs(store: Store): TopicRef[] {
  return allTopics(store).map(({ topic, section }) => ({ topic, section }));
}

/** Due-for-review across every course, most-decayed first with section
 *  spreading (Document 2 §11). Reuses the same queue the course dashboard uses. */
export function globalDueQueue(store: Store, size = 5, now = new Date()): Array<TopicRef & { courseTitle: string }> {
  const withCourse = new Map(allTopics(store).map(({ topic, course }) => [topic.topic_id, course.title]));
  return dueQueue(allCourseRefs(store), size, now).map((r) => ({
    ...r,
    courseTitle: withCourse.get(r.topic.topic_id) ?? '',
  }));
}

/** Mean active-topic health across ALL courses — the hero ring. */
export function globalHealth(store: Store, now = new Date()): number | null {
  return courseHealth(allCourseRefs(store), now);
}

/** Mastered ÷ total topics across every course (0–100). Replaces the withdrawn
 *  next-exam tile (Document 3 §5.1 v0.4). */
export function overallMastery(store: Store): { pct: number; mastered: number; total: number } {
  const topics = allTopics(store);
  const mastered = topics.filter((t) => t.topic.status === 'mastered').length;
  return {
    pct: topics.length === 0 ? 0 : Math.round((mastered / topics.length) * 100),
    mastered,
    total: topics.length,
  };
}

/**
 * Study streak — consecutive days up to today with at least one study session.
 * Counts distinct study-session days; a gap of a full day breaks it. If today
 * has no session yet but yesterday did, the streak still stands (you have the
 * rest of today to keep it) — so the walk starts from the most recent active
 * day when that day is today or yesterday.
 */
export function studyStreak(store: Store, now = new Date()): number {
  const activeDays = new Set<string>();
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'session') activeDays.add(toLocalDateKey(new Date(e.date)));
    }
  }
  if (activeDays.size === 0) return 0;

  const today = toLocalDateKey(now);
  const yesterday = toLocalDateKey(new Date(now.getTime() - 86_400_000));
  if (!activeDays.has(today) && !activeDays.has(yesterday)) return 0;

  let streak = 0;
  const cursor = new Date(now);
  if (!activeDays.has(today)) cursor.setDate(cursor.getDate() - 1); // start from yesterday

  while (activeDays.has(toLocalDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Study sessions and total minutes in the last 7 days. */
export function weeklyVolume(store: Store, now = new Date()): { sessions: number; hours: number } {
  const cutoff = now.getTime() - 7 * 86_400_000;
  const sessionIds = new Set<string>();
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'session' && new Date(e.date).getTime() >= cutoff) sessionIds.add(e.source_id);
    }
  }
  // Duration isn't on the ReviewEvent (it's decomposed away on ingestion), so
  // approximate hours from a nominal 30-min session — honest as a volume proxy,
  // and the count is exact.
  return { sessions: sessionIds.size, hours: Math.round((sessionIds.size * 30) / 60 * 10) / 10 };
}

/* ── Unified activity feed (the visible event-sourcing model) ────── */

export type FeedKind = 'session' | 'exam' | 'run' | 'lift' | 'job';

/** Feed voice per stage — a verb phrase, not a status dump (Document 3 §7). */
const JOB_FEED_TITLE: Record<JobStage, (company: string) => string> = {
  saved: (c) => `Saved ${c}`,
  applied: (c) => `Applied to ${c}`,
  screen: (c) => `Screen scheduled — ${c}`,
  interview: (c) => `Interview — ${c}`,
  offer: (c) => `Offer from ${c}`,
  rejected: (c) => `Rejected by ${c}`,
  accepted: (c) => `Accepted offer — ${c}`,
};

export interface FeedItem {
  id: string;
  kind: FeedKind;
  date: string;
  title: string;
  detail: string;
}

/**
 * One chronological stream across sessions, exams, runs and lifts
 * (Document 3 §5.1). Sessions are reconstructed from the event log by grouping
 * events that share a `source_id`.
 */
export function activityFeed(store: Store, limit = 20): FeedItem[] {
  const items: FeedItem[] = [];

  // Sessions: group study-review events by source_id.
  const sessions = new Map<string, { date: string; topics: Set<string>; courseTitle: string }>();
  for (const { topic, course } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source !== 'session') continue;
      let s = sessions.get(e.source_id);
      if (!s) {
        s = { date: e.date, topics: new Set(), courseTitle: course.title };
        sessions.set(e.source_id, s);
      }
      s.topics.add(topic.title);
    }
  }
  for (const [id, s] of sessions) {
    items.push({
      id,
      kind: 'session',
      date: s.date,
      title: `Studied ${s.courseTitle}`,
      detail: `${s.topics.size} ${s.topics.size === 1 ? 'topic' : 'topics'}`,
    });
  }

  for (const exam of store.exams) {
    items.push({
      id: exam.exam_id,
      kind: 'exam',
      date: exam.date,
      title: exam.title,
      detail: `${exam.score}/${exam.max_score} · ${exam.linked_topic_ids.length} topics`,
    });
  }

  for (const run of store.runs) {
    items.push({
      id: run.activity_id,
      kind: 'run',
      date: run.date,
      title: `${run.type[0]!.toUpperCase()}${run.type.slice(1)} run`,
      detail: `${run.distance_km} km · ${formatPace(run.pace_sec_per_km)}/km`,
    });
  }

  for (const lift of store.lifts) {
    const exercises = lift.exercises.length;
    items.push({
      id: lift.session_id,
      kind: 'lift',
      date: lift.date,
      title: 'Lifting session',
      detail: `${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}`,
    });
  }

  // Every stage move is an activity — the append-only stage_history IS the
  // job domain's event log, so the feed reads straight from it.
  for (const app of store.applications) {
    for (const e of app.stage_history) {
      items.push({
        id: e.event_id,
        kind: 'job',
        date: e.date,
        title: JOB_FEED_TITLE[e.stage](app.company),
        detail: app.role,
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}
