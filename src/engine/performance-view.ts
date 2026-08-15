import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { activeErrorCount } from './metrics';
import { prerequisiteInstability, type PrerequisiteReport } from './prerequisites';
import { isDue } from './retention';
import {
  calibrationError,
  coldPerformance,
  independentPerformance,
  novelTaskSuccess,
  normalizedPresentMean,
  performanceByDifficulty,
  performanceByNovelty,
  performanceHealth,
  performanceQuality,
  transferAbility,
  type Calibration,
  type ColdPerformance,
  type DimensionBucket,
  type IndependentPerformance,
  type NovelTaskSuccess,
  type QualityScore,
  type TransferAbility,
} from './performance';

/**
 * Dashboard view-models — design 2026-08-10 §17. Pure store→display composition:
 * flatten the event log at a scope, then compose the Phase 3/4 metrics. No metric
 * is re-derived here; nothing is written (read-side-only, §A).
 */

/** Every review event across all courses/sections/topics. */
export function allReviewEvents(store: Store): ReviewEvent[] {
  return allTopics(store).flatMap(({ topic }) => topic.review_history);
}

/** Every review event within one course (empty if the id doesn't resolve). */
export function courseReviewEvents(store: Store, courseId: string): ReviewEvent[] {
  const course = store.courses.find((c) => c.course_id === courseId);
  if (!course) return [];
  return course.sections.flatMap((s) => s.topics.flatMap((t) => t.review_history));
}

/** Every review event within one section of one course (empty if either id
 *  doesn't resolve). Scoped by BOTH ids: section_ids are not guaranteed unique
 *  across courses (tutor/manual JSON), so the section is resolved within its
 *  course, mirroring courseReviewEvents one level deeper. */
export function sectionReviewEvents(store: Store, courseId: string, sectionId: string): ReviewEvent[] {
  const course = store.courses.find((c) => c.course_id === courseId);
  const section = course?.sections.find((s) => s.section_id === sectionId);
  if (!section) return [];
  return section.topics.flatMap((t) => t.review_history);
}

export interface PerformanceSummary {
  performanceHealth: number | null;
  cold: ColdPerformance | null;
  independent: IndependentPerformance | null;
  transfer: TransferAbility | null;
  quality: QualityScore | null;
  novelTaskSuccess: NovelTaskSuccess | null;
  calibration: Calibration | null;
}

/** Bundle every Performance headline for a set of events. Each field carries its
 *  own metric's min-data guard (null → the UI shows "—"). No `now`: every bundled
 *  metric is event-array-pure (calibration reads event.date, not a clock). */
export function performanceSummary(events: ReviewEvent[]): PerformanceSummary {
  return {
    performanceHealth: performanceHealth(events),
    cold: coldPerformance(events),
    independent: independentPerformance(events),
    transfer: transferAbility(events),
    quality: performanceQuality(events),
    novelTaskSuccess: novelTaskSuccess(events),
    calibration: calibrationError(events),
  };
}

export interface TopicDiagnostics {
  assessedCount: number;
  independentAccuracy: number | null; // 0–1, raw (no min-N guard)
  independentN: number;
  difficulty: DimensionBucket[];
  novelty: DimensionBucket[];
  avgTransfer: number | null; // 0–100, raw
  avgQuality: number | null;  // 0–100, raw
}

/** Raw, UNGUARDED per-topic assessment diagnostics for the TopicDetail drawer.
 *  Deliberately bypasses the headline min-N guards — those protect the global
 *  dashboard number, not one topic's diagnostics — so a topic with 1–2 assessed
 *  attempts still surfaces its spread and raw means. Pure read; never writes. */
export function topicDiagnostics(events: ReviewEvent[]): TopicDiagnostics {
  const indep = independentPerformance(events)?.independent ?? null;
  const transfer = normalizedPresentMean(events, (e) => e.assessment?.transfer_level, CONFIG.PERFORMANCE.TRANSFER_MAX);
  const quality = normalizedPresentMean(events, (e) => e.assessment?.performance_quality, CONFIG.PERFORMANCE.QUALITY_MAX);
  return {
    assessedCount: events.filter((e) => e.assessment).length,
    independentAccuracy: indep?.accuracy ?? null,
    independentN: indep?.n ?? 0,
    difficulty: performanceByDifficulty(events),
    novelty: performanceByNovelty(events),
    avgTransfer: transfer === null ? null : transfer * 100,
    avgQuality: quality === null ? null : quality * 100,
  };
}

const MS_PER_DAY = 86_400_000;

/** Events whose date falls within the last `days` up to `now`. */
export function windowEvents(events: ReviewEvent[], now: Date, days: number): ReviewEvent[] {
  const cutoff = now.getTime() - days * MS_PER_DAY;
  return events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= cutoff && t <= now.getTime();
  });
}

export interface TrendWindows<T> {
  d7: T;
  d30: T;
  lifetime: T;
}

/** Apply a metric over the 7-day, 30-day, and lifetime event windows (design
 *  §13). Each window is computed independently, so an empty window yields
 *  whatever the metric returns for no data (typically null) — never a false 0. */
export function metricTrend<T>(
  events: ReviewEvent[],
  now: Date,
  metric: (evs: ReviewEvent[]) => T,
): TrendWindows<T> {
  return {
    d7: metric(windowEvents(events, now, CONFIG.PERFORMANCE.TREND_SHORT_DAYS)),
    d30: metric(windowEvents(events, now, CONFIG.PERFORMANCE.TREND_LONG_DAYS)),
    lifetime: metric(events),
  };
}

export interface UnstableUpstream {
  topic_id: string;
  title: string;
  report: PrerequisiteReport;
}

/**
 * Topics that are themselves struggling (active errors, or due) AND have unstable
 * upstream prerequisites — so a repeatedly-failing topic can point at its shaky
 * foundations (design §6, §17). Diagnostic only; reads, never writes.
 *
 * @param courseId When provided, only struggling downstream topics in this course
 *   are considered; the upstream instability walk itself stays store-wide (a
 *   downstream topic's shaky prerequisite may live in another course).
 */
export function unstablePrerequisites(store: Store, now: Date = new Date(), courseId?: string): UnstableUpstream[] {
  const out: UnstableUpstream[] = [];
  for (const { topic, course } of allTopics(store)) {
    if (courseId && course.course_id !== courseId) continue;
    if (!topic.prerequisites || topic.prerequisites.length === 0) continue;
    const struggling = activeErrorCount(topic) > 0 || isDue(topic, now);
    if (!struggling) continue;
    const report = prerequisiteInstability(topic, store, now);
    if (report.unstableCount > 0) {
      out.push({ topic_id: topic.topic_id, title: topic.title, report });
    }
  }
  return out;
}
