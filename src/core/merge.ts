import { CONFIG } from '@/config/constants';
import type { SchemaName } from '@/domain/schemas';
import type {
  Confidence,
  Course,
  ErrorLogEntry,
  Exam,
  LiftingSession,
  ReviewEvent,
  RunningActivity,
  Store,
  StudySession,
  Topic,
} from '@/domain/types';
import { allTopics } from '@/domain/types';
import { applyEvent } from '@/engine/recalculate';

/**
 * Domain-specific merge logic — Document 1 §6.3.
 *
 * Every function here mutates a *draft* store (a clone made by `commit`), never
 * the live one — that is what makes the commit atomic (Document 4 E2-S4).
 *
 * This module decomposes ingestion objects into events, then hands each one to
 * the engine's single recalculation path (`applyEvent`, Document 4 E3-S3).
 * Nothing here appends to `review_history` directly — one path, no duplicates.
 */

let idCounter = 0;

/** `{prefix}_{id}` per Document 1 §1.1. Uses crypto when available. */
export function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${(idCounter++).toString(36)}`.slice(0, 10);
  return `${prefix}_${rand}`;
}

/** Document 2 §1 "Test pass mark": a test passes at ≥ 80% of `out_of`.
 *  Derived from marks on ingestion so `kind` can never contradict the score
 *  (Document 1 v0.2 §2.4). */
export function testKind(earned: number, possible: number): 'test_pass' | 'test_fail' {
  return earned >= CONFIG.TEST_PASS_MARK * possible ? 'test_pass' : 'test_fail';
}

function findTopicRef(store: Store, topicId: string): Topic | undefined {
  return allTopics(store).find((t) => t.topic.topic_id === topicId)?.topic;
}

function toErrorEntries(
  errors: Array<{ error_type: ErrorLogEntry['error_type']; description: string }> | undefined,
  date: string,
  source: 'session' | 'exam',
  sourceId: string,
): ErrorLogEntry[] {
  return (errors ?? []).map((e) => ({
    error_id: makeId('error'),
    date,
    source,
    source_id: sourceId,
    error_type: e.error_type,
    description: e.description,
    resolved: false,
    resolved_date: null,
  }));
}

/**
 * Document 1 §6.3 — a course is created once; re-adding is rejected upstream by
 * the integrity check, so reaching here means it's new.
 *
 * `mastered_at` is engine-managed and optional on input (the §8 course prompt
 * doesn't ask for it — a fresh syllabus has nothing mastered). Normalise it to
 * null on the way in so the stored shape always matches the domain type rather
 * than leaving a required field undefined.
 */
function mergeCourse(draft: Store, course: Course): void {
  draft.courses.push({
    ...course,
    sections: course.sections.map((section) => ({
      ...section,
      topics: section.topics.map((topic) => ({ ...topic, mastered_at: topic.mastered_at ?? null })),
    })),
  });
}

/**
 * Document 1 §6.3 — decompose per `topics_covered[]`: append one ReviewEvent
 * (`kind: study_review`, `source: session`) and any ErrorLogEntry objects.
 */
function mergeSession(draft: Store, session: StudySession): void {
  for (const entry of session.topics_covered) {
    const topic = findTopicRef(draft, entry.topic_id);
    // Integrity already guaranteed this resolves; a miss here is a real bug,
    // and failing loudly beats silently dropping the user's session.
    if (!topic) {
      throw new Error(`Topic ${entry.topic_id} vanished between validation and commit`);
    }

    const event: ReviewEvent = {
      event_id: makeId('event'),
      date: session.date,
      kind: 'study_review',
      source: 'session',
      source_id: session.session_id,
      confidence_reported: entry.confidence_reported,
      ...(entry.notes ? { notes: entry.notes } : {}),
    };

    // Errors land before the recalculation so the engine sees the true active
    // error count for this event.
    topic.error_log.push(...toErrorEntries(entry.errors, session.date, 'session', session.session_id));

    // The single recalculation path (Document 2 §3, Document 4 E3-S3) — it
    // appends the event AND updates strength/conf/last_reviewed. Never append
    // by hand here, or the two paths drift.
    Object.assign(topic, applyEvent(topic, event));
  }
}

/**
 * Document 1 §6.3 / §4 — for each linked topic, append a ReviewEvent with
 * `source: exam`, a `kind` derived from that topic's own marks, and a `test`
 * block. Uses `breakdown` when present, else the uniform fallback
 * (Document 2 §4.2).
 */
function mergeExam(draft: Store, exam: Exam): void {
  draft.exams.push(exam);

  const byTopic = new Map(exam.breakdown?.map((b) => [b.topic_id, b]) ?? []);

  for (const topicId of exam.linked_topic_ids) {
    const topic = findTopicRef(draft, topicId);
    if (!topic) throw new Error(`Topic ${topicId} vanished between validation and commit`);

    const entry = byTopic.get(topicId);
    const earned = entry ? entry.points_earned : exam.score;
    const possible = entry ? entry.points_possible : exam.max_score;

    const confidence: Confidence | undefined = entry?.confidence_reported ?? exam.confidence_reported;

    const event: ReviewEvent = {
      event_id: makeId('event'),
      date: exam.date,
      kind: testKind(earned, possible),
      source: 'exam',
      source_id: exam.exam_id,
      // Document 2 §5: only tests carrying a confidence contribute to OCI.
      // With none reported we fall back to the topic's current conf, which
      // keeps the event valid without inventing a calibration signal.
      confidence_reported: confidence ?? topic.conf,
      test: {
        score: earned,
        out_of: possible,
        // Computed here, never user-supplied (Document 1 v0.2 §2.4).
        actual_retention: earned / possible,
      },
    };

    topic.error_log.push(...toErrorEntries(entry?.errors, exam.date, 'exam', exam.exam_id));

    // Same single path as sessions. Because this event is a test, applyEvent
    // additionally pushes drift and tunes k_factor (Document 2 §4) — which is
    // the actual mechanism by which exams outweigh sessions. Each topic
    // recalculates against its OWN prior state, so identical inputs can produce
    // different results per topic (Document 4 E5-S2).
    Object.assign(topic, applyEvent(topic, event));
  }
}

/** Document 1 §6.3 — fitness objects append directly; no recalculation. */
function mergeRunning(draft: Store, run: RunningActivity): void {
  draft.runs.push({
    ...run,
    // Computed on ingestion, never user-supplied (Document 1 §5.1).
    pace_sec_per_km: run.duration_seconds / run.distance_km,
  });
}

function mergeLifting(draft: Store, session: LiftingSession): void {
  draft.lifts.push(session);
}

export function mergeInto(draft: Store, schemaName: SchemaName, value: unknown): void {
  switch (schemaName) {
    case 'course':
      return mergeCourse(draft, value as Course);
    case 'session':
      return mergeSession(draft, value as StudySession);
    case 'exam':
      return mergeExam(draft, value as Exam);
    case 'running':
      return mergeRunning(draft, value as RunningActivity);
    case 'lifting':
      return mergeLifting(draft, value as LiftingSession);
  }
}
