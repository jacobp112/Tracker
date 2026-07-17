import { CONFIG } from '@/config/constants';
import type { Exam, ExamBreakdownEntry, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';

/**
 * Exam display derivations — Document 3 §5.4, Document 4 E5-S3.
 *
 * Resolves each linked topic back to its parent course (an exam may span
 * courses — Document 1 §4) and computes the per-topic effect the exam had, so
 * a card can read "boosted / flagged weak".
 */

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

/** A pass ≥ 80% reads as "boosted"; below reads as "flagged weak" — the same
 *  0.80 mark the engine uses for `kind` (Document 2 §1). */
function effectOf(earned: number, possible: number): ExamEffect {
  return earned >= CONFIG.TEST_PASS_MARK * possible ? 'boosted' : 'flagged';
}

export function buildExamView(exam: Exam, store: Store): ExamView {
  const topicIndex = new Map(
    allTopics(store).map(({ topic, course }) => [topic.topic_id, { title: topic.title, course }]),
  );
  const breakdownByTopic = new Map(exam.breakdown?.map((b) => [b.topic_id, b]) ?? []);

  // Group linked topics by parent course, preserving first-seen order.
  const groups = new Map<string, ExamCourseGroup>();

  for (const topicId of exam.linked_topic_ids) {
    const resolved = topicIndex.get(topicId);
    const courseId = resolved?.course.course_id ?? null;
    const courseKey = courseId ?? '__unknown__';

    let group = groups.get(courseKey);
    if (!group) {
      group = {
        courseId,
        // A topic can be deleted after an exam references it; say so rather
        // than dropping the row silently.
        courseTitle: resolved?.course.title ?? 'Removed course',
        topics: [],
      };
      groups.set(courseKey, group);
    }

    const bd = breakdownByTopic.get(topicId);
    const earned = bd ? bd.points_earned : exam.score;
    const possible = bd ? bd.points_possible : exam.max_score;

    group.topics.push({
      topicId,
      title: resolved?.title ?? topicId,
      // Null earned/possible only when we fell back to the exam total AND want
      // to signal "no per-topic breakdown"; here we always have a number, so
      // expose it, but flag that uniform rows share the exam's overall ratio.
      earned: bd ? bd.points_earned : null,
      possible: bd ? bd.points_possible : null,
      effect: effectOf(earned, possible),
      errors: bd?.errors ?? [],
    });
  }

  return {
    exam,
    scorePct: Math.round((exam.score / exam.max_score) * 100),
    groups: [...groups.values()],
    topicCount: exam.linked_topic_ids.length,
  };
}

/** Newest exams first. */
export function examViews(store: Store): ExamView[] {
  return [...store.exams]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((exam) => buildExamView(exam, store));
}
