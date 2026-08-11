/**
 * Domain types — mirror Document 1 v0.2 storage exactly.
 *
 * Storage is snake_case (Document 1 §1); Document 2 writes the same fields in
 * camelCase. Document 1 v0.2 §0.1 fixes the mapping and rules out a translation
 * layer, so these types use the storage names verbatim.
 */

export const SCHEMA_VERSION = '4.0.0';

/** Document 2 §7 ladder. Stored snake_case; Document 3 owns the display labels. */
export type TopicStatus = 'not_started' | 'learning' | 'practising' | 'mastered';

/** What the event was — drives the math (Document 1 v0.2 §2.4). */
export type ReviewKind = 'study_review' | 'test_pass' | 'test_fail';

/** Where the event came from — provenance. Orthogonal to `kind`. */
export type ReviewSource = 'session' | 'exam' | 'manual_review';

export type ErrorType = 'conceptual' | 'procedural' | 'careless' | 'knowledge_gap';

/**
 * Assessment provenance (design §4/§H). A *component* of an event's evidence tier,
 * combined with sitting conditions — never an arbitrary multiplier. Optional and
 * additive on `ReviewEvent`; legacy events have none. Populated by the assessment
 * decomposition path (later phases), not emitted by the course/session/exam AI.
 */
export type AssessmentProvenance = 'past_paper' | 'ai_generated' | 'diagnostic' | 'custom';

/**
 * Intrinsic error severity (design §I.3) — the *slow-moving damage* of an error,
 * distinct from urgency (when to act, derived live in Phase 2). AI-proposed,
 * app-stored, learner-editable. Three levels; urgency adds CRITICAL on top.
 */
export type ErrorSeverity = 'low' | 'medium' | 'high';

/** Confidence is 1–5 (Document 1 v0.2 §1.3a) — never a percentage. */
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface TestEvidence {
  score: number;
  out_of: number;
  /** score / out_of, computed on ingestion (never user-supplied). */
  actual_retention: number;
}

/* ── Assessment evidence (Performance layer, design 2026-08-10 §B) ─────
 * Generic across subjects — NOT mathematics-specific. Read only by the
 * Performance layer (engine/performance.ts, Phase 3); never feeds retention,
 * health, levels, EXP, or mastery. */

/** Task difficulty, 0–5. 0 recall · 1 direct application · 2 multi-step familiar
 *  · 3 unfamiliar application · 4 non-routine reasoning · 5 exceptionally hard. */
export type Difficulty = 0 | 1 | 2 | 3 | 4 | 5;

/** Task novelty, 0–4. 0 identical · 1 minor variation · 2 different presentation
 *  · 3 genuinely unfamiliar · 4 highly novel. Kept independent of transfer_level. */
export type Novelty = 0 | 1 | 2 | 3 | 4;

/** External assistance required, 0–3. 0 solution required · 1 substantial hinting
 *  · 2 minor hint/prompt · 3 completely independent. Never inferred from correctness. */
export type Independence = 0 | 1 | 2 | 3;

/** Application beyond the learned context, 0–3. 0 cannot transfer · 1 with
 *  prompting · 2 independently · 3 independently transfers AND generalises. */
export type TransferLevel = 0 | 1 | 2 | 3;

/** Subject-appropriate performance quality, 0–5 (correctness, reasoning, clarity,
 *  method, communication, …). Not every subject uses every dimension. */
export type PerformanceQuality = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Tutor-supplied assessment metadata for a single attempt. Every dimension is
 * optional — partial applicability is first-class (a recall card has difficulty
 * but no transfer; a writing task has quality but no novelty). The tracker stores
 * this verbatim and NEVER derives per-attempt values onto it; a missing dimension
 * stays undefined, never zero-filled or guessed (design §B, §14).
 */
export interface AssessmentEvidence {
  difficulty?: Difficulty;
  novelty?: Novelty;
  independence?: Independence;
  transfer_level?: TransferLevel;
  performance_quality?: PerformanceQuality;
  /** Short tutor rationale for the quality judgement. */
  quality_rationale?: string;
  /** Tutor-marked cold assessment. NEVER auto-inferred from source. */
  cold?: boolean;
  /** Tutor's PRE-attempt probability of success, 0–1. Counts toward calibration
   *  only when `predicted_at` verifies it as foresight (strictly before the
   *  event's date); otherwise treated as hindsight and excluded. */
  predicted_success?: number;
  /** ISO timestamp when `predicted_success` was formed. Absent or not strictly
   *  before the attempt's date → excluded from the calibration metric. */
  predicted_at?: string;
  /** Optional tutor/model/session provenance tag (design §14). */
  assessed_by?: string;
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
  /**
   * True when this test event's score was smeared uniformly across an exam's
   * linked topics (no per-topic `breakdown`). Excluded from kFactor self-tuning
   * (§4); still counted, weighted, in the lapse fold (design 2026-08-09 §2.2).
   */
  smeared?: boolean;
  /** Number of topics the source exam linked (`linked_topic_ids.length`).
   *  Stamped for a future `1/√N` fan-out damping; unused at weight 1.0 today. */
  fanout?: number;
  notes?: string;
  /**
   * Tutor-supplied assessment metadata (design 2026-08-10 §B). Optional and
   * additive — historical events have none. Read only by the Performance layer;
   * never feeds retention/health/levels (§A read-side-only invariant).
   */
  assessment?: AssessmentEvidence;
  /**
   * Provenance of the assessment that produced this event (design §4/§H).
   * Optional/additive; absent on study reviews and legacy events. A component of
   * `evidenceTier`, never a multiplier on retention/health.
   */
  provenance?: AssessmentProvenance;
  /**
   * Back-link to the question-level assessment that produced this event (design
   * §B). Present only for events decomposed from an AssessmentAttempt (later
   * phases); lets "which question produced this evidence" be answered without
   * duplicating marks. Never invented for legacy exam/session events.
   */
  assessment_ref?: {
    assessment_id: string;
    attempt_id?: string;
    question_id?: string;
  };
}

export interface ErrorLogEntry {
  error_id: string;
  date: string;
  source: 'session' | 'exam';
  source_id: string;
  error_type: ErrorType;
  /** Natural-language description of THIS occurrence — explanatory evidence only.
   *  It is NOT the pattern's identity; recurrence is keyed on the semantic
   *  `ErrorPattern.signature`, never on this prose (design §I.1). */
  description: string;
  resolved: boolean;
  resolved_date: string | null;
  /**
   * The recurrence pattern this occurrence belongs to (design §I.1). Optional and
   * additive — legacy occurrences have none and are NEVER auto-clustered (never
   * invent recurrence, §24). App-owned; assigned by the Phase 2 matcher.
   */
  pattern_id?: string;
  /** Intrinsic severity of this occurrence (design §I.3). AI-proposed, editable. */
  severity?: ErrorSeverity;
}

/**
 * Recurrence identity for errors (design §I.1). One `ErrorPattern` groups the
 * occurrences (`ErrorLogEntry`s, across topics) of the *same underlying mistake*.
 *
 * `signature` is a NORMALISED SEMANTIC KEY for the error mechanism — the app's
 * canonical identity for "this kind of mistake" — NOT the AI's natural-language
 * description (that stays on each `ErrorLogEntry.description` as explanatory
 * evidence). The tutor may PROPOSE a structured signature; the application owns
 * the resulting `pattern_id`, and matching considers semantic signature + topic/
 * context rather than exact string equality (Phase 2). The lifecycle STATUS is
 * derived live (Phase 2), not stored here, so it can never go stale.
 */
export interface ErrorPattern {
  pattern_id: string;
  /** Normalised semantic mechanism key — canonical identity, not prose. */
  signature: string;
  error_type: ErrorType;
  /** Topics this pattern has shown up on (a pattern can span topics). */
  topic_ids: string[];
  severity: ErrorSeverity;
  /** `error_id`s of the occurrences that belong to this pattern. */
  occurrence_ids: string[];
  first_seen: string;
  last_seen: string;
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
  /**
   * Upstream topic_ids this topic depends on (design 2026-08-10 §E). Optional;
   * authored by the course layer, assumed a DAG. Diagnostic only — used by the
   * prerequisite-instability check (Phase 4); NEVER overwrites mastery or any
   * stored state.
   */
  prerequisites?: string[];
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
  /**
   * Observed mistakes. `proposed_signature`/`proposed_severity` are the tutor's
   * PROPOSED structured error identity (design §M / §I.1) — observations only. The
   * app owns whether they create/link an ErrorPattern; the natural-language
   * `description` stays explanatory evidence, never the identity.
   */
  errors?: Array<{
    error_type: ErrorType;
    description: string;
    proposed_signature?: string;
    proposed_severity?: ErrorSeverity;
  }>;
  assessment?: AssessmentEvidence;
  /** Tutor-observed concepts the learner demonstrated (design §M). Observation only. */
  concepts_demonstrated?: string[];
  /** What the tutor is unsure about (design §M) — lowers how much this topic's
   *  outcome is trusted; never silently accepted. */
  uncertainty?: string;
}

export interface StudySession {
  schema_version: string;
  session_id: string;
  course_id: string;
  date: string;
  duration_minutes: number;
  topics_covered: SessionTopicEntry[];
  /** Tutor's suggested next step (design §M). Advisory observation only. */
  suggested_follow_up?: string;
}

export interface ExamBreakdownEntry {
  topic_id: string;
  points_earned: number;
  points_possible: number;
  confidence_reported?: Confidence;
  errors?: Array<{ error_type: ErrorType; description: string }>;
  assessment?: AssessmentEvidence;
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
  /** Tutor-marked cold paper (design 2026-08-10 §C). Applied to every linked
   *  topic's event unless a per-breakdown assessment.cold overrides. */
  cold?: boolean;
}

/* ── Session Recording ──────────────────────────────────────────── */

export type SessionIntent = 'remediate' | 'retention' | 'new_content' | 'adaptive';
export type SessionScope = 'clean_slate' | 'topic' | 'section' | 'course';

export interface SessionRecord {
  session_id: string;
  topic_id: string;
  course_id: string;
  created_at: string;   // ISO — timer started
  completed_at: string; // ISO — committed
  duration_minutes: number; // measured, authoritative
  intent: SessionIntent;
  scope: SessionScope;
  timer_mode: 'count_up' | 'pomodoro';
  pomodoro_config?: { work_minutes: number; break_minutes: number; long_break_minutes: number };
  /** The plan this session executed, if it came from one (design §G). Optional/
   *  additive — plan-less sessions (and all legacy records) have none. */
  plan_id?: string;
}

/* ── Session planning (design §G) ───────────────────────────────────
 * The intent-BEFORE a session (distinct from SessionRecord, the record-after).
 * A plan is derived from a Recommendation; its `expected_evidence` is what the
 * post-session Evaluation checks deterministically, rather than trusting the
 * tutor's self-report. */

/** What would count as the session having succeeded (design §G). Checkable
 *  against the store afterwards — never a subjective judgement. */
export interface ExpectedEvidence {
  kind: 'independent_success' | 'error_resolved' | 'retrieval' | 'coverage';
  topic_ids?: string[];
  pattern_ids?: string[];
  /** Minimum evidence tier for `independent_success` (design §H). */
  min_tier?: number;
}

export interface SessionPlan {
  plan_id: string;
  created_at: string;
  from_recommendation?: { action: string; target_id: string };
  intent: SessionIntent;
  scope: SessionScope;
  target_topic_ids: string[];
  target_pattern_ids?: string[];
  reason: string;
  expected_evidence: ExpectedEvidence;
  prerequisite_topic_ids?: string[];
  est_duration_minutes: number;
}

/* ── Store ─────────────────────────────────────────────────────── */

/**
 * Compact reference to an assessment whose full definition lives in IndexedDB
 * (design §O). Kept in the localStorage Store so the synchronous hot path
 * (recommendations/readiness) can reason about assessments WITHOUT touching
 * IndexedDB. `topic_ids` are the confirmed-mapping topics — what the assessment
 * actually certifies. Additive: absent in ≤3.3.0 stores.
 */
export interface AssessmentRef {
  assessment_id: string;
  title: string;
  provenance: AssessmentProvenance;
  topic_ids: string[];
  max_marks: number;
  created_at: string;
}

export interface Store {
  schema_version: string;
  courses: Course[];
  exams: Exam[];
  sessions: SessionRecord[];
  /**
   * Error recurrence patterns (design §I.1). Small, localStorage-resident. The
   * grouping identity + attributes only — occurrences stay in each topic's
   * `error_log`; the lifecycle status is derived live (Phase 2). Additive: absent
   * in ≤3.2.0 stores, defaulted to [] on load.
   */
  error_patterns: ErrorPattern[];
  /** Compact references to IndexedDB assessment definitions (design §O, Phase 9).
   *  Additive; defaulted to [] on load. */
  assessment_refs: AssessmentRef[];
}

export function emptyStore(): Store {
  return {
    schema_version: SCHEMA_VERSION,
    courses: [],
    exams: [],
    sessions: [],
    error_patterns: [],
    assessment_refs: [],
  };
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
