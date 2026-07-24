import type { SchemaName } from '@/domain/schemas';
import { allTopics, type Course, type Exam, type Store, type StudySession } from '@/domain/types';
import type { FriendlyError } from './errorTranslation';

/**
 * Referential integrity — Document 1 §1.6 / §6.1 step 3, Document 4 E2-S2.
 *
 * "Any field ending in `_id` or `_ids[]` that references another object must
 * resolve to an object that actually exists in the user's data store. Dangling
 * references are a validation error, not a warning."
 *
 * Every failure names the offending id *and* its field path (E2-S2), and all
 * failures are collected rather than stopping at the first.
 */

function topicIndex(store: Store): Map<string, string> {
  const m = new Map<string, string>();
  for (const { topic, course } of allTopics(store)) m.set(topic.topic_id, course.title);
  return m;
}

export function checkIntegrity(
  schemaName: SchemaName,
  value: unknown,
  store: Store,
): FriendlyError[] {
  switch (schemaName) {
    case 'course':
      return checkCourse(value as Course, store);
    case 'session':
      return checkSession(value as StudySession, store);
    case 'exam':
      return checkExam(value as Exam, store);
    // Fitness objects carry no cross-object references (Document 1 §6.3).
    case 'running':
    case 'lifting':
      return [];
  }
}

/**
 * A course is self-contained, so there are no outbound references to resolve.
 * What *can* go wrong is a collision: Document 1 §6.3 says a course_id that
 * already exists is an error, because v1 creates a course once (amending a
 * syllabus is out of scope — Document 4 §13.2).
 */
function checkCourse(course: Course, store: Store): FriendlyError[] {
  const errors: FriendlyError[] = [];

  if (store.courses.some((c) => c.course_id === course.course_id)) {
    errors.push({
      path: '/course_id',
      message: `A course with the ID '${course.course_id}' already exists. Editing a syllabus after it's created isn't supported yet — re-generate the JSON with a new course ID, or delete the existing course first.`,
    });
  }

  // Internal uniqueness: duplicate ids inside one course would make every
  // downstream topic lookup ambiguous.
  const seenSections = new Set<string>();
  const seenTopics = new Set<string>();
  course.sections?.forEach((section, si) => {
    if (seenSections.has(section.section_id)) {
      errors.push({
        path: `/sections/${si}/section_id`,
        message: `Two sections share the ID '${section.section_id}'. Each section needs its own.`,
      });
    }
    seenSections.add(section.section_id);

    section.topics?.forEach((topic, ti) => {
      if (seenTopics.has(topic.topic_id)) {
        errors.push({
          path: `/sections/${si}/topics/${ti}/topic_id`,
          message: `Two topics share the ID '${topic.topic_id}' (one of them is '${topic.title}'). Each topic needs its own.`,
        });
      }
      seenTopics.add(topic.topic_id);
    });
  });

  return errors;
}

function checkSession(session: StudySession, store: Store): FriendlyError[] {
  const errors: FriendlyError[] = [];

  const course = store.courses.find((c) => c.course_id === session.course_id);
  if (!course) {
    errors.push({
      path: '/course_id',
      message: `This session is for course '${session.course_id}', which doesn't exist in your tracker. Check you copied the prompt from the right course.`,
    });
  }

  // Topics must exist, and must belong to the session's own course — a topic
  // that exists elsewhere is still wrong here.
  const courseTopics = new Set(
    course?.sections.flatMap((s) => s.topics.map((t) => t.topic_id)) ?? [],
  );
  const known = topicIndex(store);

  session.topics_covered?.forEach((entry, i) => {
    if (!course) return; // already reported; don't pile on
    if (courseTopics.has(entry.topic_id)) return;

    const elsewhere = known.get(entry.topic_id);
    errors.push({
      path: `/topics_covered/${i}/topic_id`,
      message: elsewhere
        ? `Topic '${entry.topic_id}' belongs to '${elsewhere}', not '${course.title}'. A session can only cover topics from its own course.`
        : `Topic '${entry.topic_id}' doesn't exist in '${course.title}'.`,
    });
  });

  return errors;
}

function checkExam(exam: Exam, store: Store): FriendlyError[] {
  const errors: FriendlyError[] = [];
  const known = topicIndex(store);

  // An exam may span courses by design (Document 1 §4) — so the only rule is
  // that each topic exists somewhere.
  exam.linked_topic_ids?.forEach((id, i) => {
    if (!known.has(id)) {
      errors.push({
        path: `/linked_topic_ids/${i}`,
        message: `Topic '${id}' doesn't exist in your tracker.`,
      });
    }
  });

  const linked = new Set(exam.linked_topic_ids ?? []);
  exam.breakdown?.forEach((entry, i) => {
    // Document 1 §4: breakdown[].topic_id "must be in linked_topic_ids".
    if (!linked.has(entry.topic_id)) {
      errors.push({
        path: `/breakdown/${i}/topic_id`,
        message: `The breakdown scores topic '${entry.topic_id}', but that topic isn't in this exam's linked topics. Add it there, or remove the breakdown entry.`,
      });
    }
    if (entry.points_earned > entry.points_possible) {
      errors.push({
        path: `/breakdown/${i}/points_earned`,
        message: `Topic '${entry.topic_id}' scored ${entry.points_earned} out of ${entry.points_possible} — you can't earn more than was available.`,
      });
    }
  });

  if (exam.score > exam.max_score) {
    errors.push({
      path: '/score',
      message: `This exam scored ${exam.score} out of ${exam.max_score} — you can't earn more than was available.`,
    });
  }

  return errors;
}
