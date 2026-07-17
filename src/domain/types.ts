/**
 * Domain types — mirror Document 1 v0.2 storage exactly.
 *
 * Storage is snake_case (Document 1 §1); Document 2 writes the same fields in
 * camelCase. Document 1 v0.2 §0.1 fixes the mapping and rules out a translation
 * layer, so these types use the storage names verbatim.
 */

export const SCHEMA_VERSION = '2.0.0';

/** Document 2 §7 ladder. Stored snake_case; Document 3 owns the display labels. */
export type TopicStatus = 'not_started' | 'learning' | 'practising' | 'mastered';

/** What the event was — drives the math (Document 1 v0.2 §2.4). */
export type ReviewKind = 'study_review' | 'test_pass' | 'test_fail';

/** Where the event came from — provenance. Orthogonal to `kind`. */
export type ReviewSource = 'session' | 'exam' | 'manual_review';

export type ErrorType = 'conceptual' | 'procedural' | 'careless' | 'knowledge_gap';

/** Confidence is 1–5 (Document 1 v0.2 §1.3a) — never a percentage. */
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface TestEvidence {
  score: number;
  out_of: number;
  /** score / out_of, computed on ingestion (never user-supplied). */
  actual_retention: number;
}

export interface ReviewEvent {
  event_id: string;
  date: string;
  kind: ReviewKind;
  source: ReviewSource;
  source_id: string;
  confidence_reported: Confidence;
  /** Required when `kind` is a test; forbidden otherwise. */
  test?: TestEvidence;
  notes?: string;
}

export interface ErrorLogEntry {
  error_id: string;
  date: string;
  source: 'session' | 'exam';
  source_id: string;
  error_type: ErrorType;
  description: string;
  resolved: boolean;
  resolved_date: string | null;
}

export interface Topic {
  topic_id: string;
  title: string;
  status: TopicStatus;
  /** 1–5. */
  conf: Confidence;
  /** Document 2 §3 `s`. Only ever grows. */
  strength: number;
  /** Document 2 §4 `kFactor`. Engine-managed, clamped [K_MIN, K_MAX]. */
  k_factor: number;
  /** Flashcard count only — no flashcard domain in v1 (Doc 4 §13.7). */
  cards: number;
  /** Document 2's `reviewed`. null → retention undefined. */
  last_reviewed: string | null;
  /**
   * When this topic FIRST reached `mastered`. Never cleared on demotion —
   * Document 2 §10 asks how many topics have *ever* mastered. Without it,
   * velocity is uncomputable (Document 1 v0.2.1 §2.3).
   */
  mastered_at: string | null;
  /** Document 2 §4.1, capped at DRIFT_WINDOW most recent. */
  drift_history: number[];
  review_history: ReviewEvent[];
  error_log: ErrorLogEntry[];
}

export interface Section {
  section_id: string;
  title: string;
  order: number;
  topics: Topic[];
}

export interface Course {
  schema_version: string;
  course_id: string;
  title: string;
  created_at: string;
  source: 'ai_generated' | 'manual';
  sections: Section[];
}

/* ── Ingestion objects ─────────────────────────────────────────── */

export interface SessionTopicEntry {
  topic_id: string;
  confidence_reported: Confidence;
  notes?: string;
  errors?: Array<{ error_type: ErrorType; description: string }>;
}

export interface StudySession {
  schema_version: string;
  session_id: string;
  course_id: string;
  date: string;
  duration_minutes: number;
  topics_covered: SessionTopicEntry[];
}

export interface ExamBreakdownEntry {
  topic_id: string;
  points_earned: number;
  points_possible: number;
  confidence_reported?: Confidence;
  errors?: Array<{ error_type: ErrorType; description: string }>;
}

export interface Exam {
  schema_version: string;
  exam_id: string;
  title: string;
  date: string;
  linked_topic_ids: string[];
  score: number;
  max_score: number;
  confidence_reported?: Confidence;
  breakdown?: ExamBreakdownEntry[];
}

export interface RunningActivity {
  schema_version: string;
  activity_id: string;
  date: string;
  distance_km: number;
  duration_seconds: number;
  /** Computed on ingestion (Document 1 §5.1), never user-supplied. */
  pace_sec_per_km: number;
  type: 'easy' | 'tempo' | 'long' | 'interval' | 'race';
  notes?: string;
}

export interface LiftSet {
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe?: number;
}

export interface LiftingSession {
  schema_version: string;
  session_id: string;
  date: string;
  exercises: Array<{ exercise_name: string; sets: LiftSet[] }>;
}

/* ── Store ─────────────────────────────────────────────────────── */

export interface Store {
  schema_version: string;
  courses: Course[];
  exams: Exam[];
  runs: RunningActivity[];
  lifts: LiftingSession[];
}

export function emptyStore(): Store {
  return { schema_version: SCHEMA_VERSION, courses: [], exams: [], runs: [], lifts: [] };
}

/** All topics across all courses, with their parent course/section resolved. */
export function allTopics(store: Store): Array<{ topic: Topic; section: Section; course: Course }> {
  const out: Array<{ topic: Topic; section: Section; course: Course }> = [];
  for (const course of store.courses) {
    for (const section of course.sections) {
      for (const topic of section.topics) {
        out.push({ topic, section, course });
      }
    }
  }
  return out;
}

export function findTopic(store: Store, topicId: string): Topic | undefined {
  return allTopics(store).find((t) => t.topic.topic_id === topicId)?.topic;
}
