import { CONFIG } from '@/config/constants';
import type { Exam, ExamBreakdownEntry, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';

export type ExamEffect = 'boosted' | 'flagged';

export interface ExamTopicRow {
  topicId: string;
  title: string;
  /** Present when the exam carried a per-topic breakdown. */
  earned: number | null;
  possible: number | null;
  effect: ExamEffect;
  /** Errors attributed to this topic on the exam (Document 1 §4). */
  errors: ExamBreakdownEntry['errors'];
}

export interface ExamCourseGroup {
  courseId: string | null;
  courseTitle: string;
  topics: ExamTopicRow[];
}

export interface ExamView {
  exam: Exam;
  scorePct: number;
  /** Cross-topic reach grouped by parent course (Document 3 §5.4). */
  groups: ExamCourseGroup[];
  topicCount: number;
}

/** 
 * A pass ≥ 80% reads as "boosted"; below reads as "flagged weak" — the same
 * 0.80 mark the engine uses for `kind` (Document 2 §1). 
 */
function effectOf(earned: number, possible: number): ExamEffect {
  if (possible === 0) return 'flagged'; // Guard against 0 * 0.8 edge cases
  return earned >= CONFIG.TEST_PASS_MARK * possible ? 'boosted' : 'flagged';
}

// Helper type to define the shape of our hoisted index
type TopicRecord = ReturnType<typeof allTopics>[number];
export type TopicIndex = Map<string, { title: string; course: TopicRecord['course'] }>;

/**
 * Note: Signature updated to accept a pre-computed TopicIndex instead of the raw Store.
 * This prevents rebuilding the index on every loop iteration.
 */
export function buildExamView(exam: Exam, topicIndex: TopicIndex): ExamView {
  const breakdownByTopic = new Map(exam.breakdown?.map((b) => [b.topic_id, b]) ?? []);

  // Maps support null keys natively, removing the need for a magic string like '__unknown__'
  const groups = new Map<string | null, ExamCourseGroup>();

  for (const topicId of exam.linked_topic_ids) {
    const resolved = topicIndex.get(topicId);
    const courseId = resolved?.course.course_id ?? null;

    let group = groups.get(courseId);
    if (!group) {
      group = {
        courseId,
        courseTitle: resolved?.course.title ?? 'Removed course',
        topics: [],
      };
      groups.set(courseId, group);
    }

    const bd = breakdownByTopic.get(topicId);
    const earned = bd ? bd.points_earned : exam.score;
    const possible = bd ? bd.points_possible : exam.max_score;

    group.topics.push({
      topicId,
      title: resolved?.title ?? topicId,
      earned: bd ? bd.points_earned : null,
      possible: bd ? bd.points_possible : null,
      effect: effectOf(earned, possible),
      errors: bd?.errors ?? [],
    });
  }

  return {
    exam,
    // Math.max prevents returning NaN if an exam is ever saved with a max_score of 0
    scorePct: Math.round((exam.score / Math.max(1, exam.max_score)) * 100),
    groups: Array.from(groups.values()),
    topicCount: exam.linked_topic_ids.length,
  };
}

/** Newest exams first. */
export function examViews(store: Store): ExamView[] {
  // Hoisted: We now traverse the store and build the topic index exactly once.
  const topicIndex: TopicIndex = new Map(
    allTopics(store).map(({ topic, course }) => [
      topic.topic_id,
      { title: topic.title, course },
    ])
  );

  return [...store.exams]
    // ISO 8601 date strings ("YYYY-MM-DD") sort perfectly alphabetically. 
    // localeCompare avoids instantiating a new Date() object for every single comparison check.
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((exam) => buildExamView(exam, topicIndex));
}