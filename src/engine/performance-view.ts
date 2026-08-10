import type { ReviewEvent, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import {
  calibrationError,
  coldPerformance,
  independentPerformance,
  novelTaskSuccess,
  performanceHealth,
  performanceQuality,
  transferAbility,
  type Calibration,
  type ColdPerformance,
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
