/**
 * JSON Schemas (2020-12) — the literal encoding of Document 1 v0.2 §2–5.
 *
 * Rules carried from Document 1 §1:
 *  - `additionalProperties: false` everywhere: hallucinated fields fail rather
 *    than being silently accepted (§1.5). This is also what rejects JSON built
 *    against the withdrawn v0.1 model (`ease_factor`, `recall_success`, …).
 *  - Confidence is 1–5, percentages are 0–100 (§1.3a) — different scales.
 *  - Enums are closed sets (§1.7).
 */
import type { SchemaObject } from 'ajv';

const ID_PATTERN = (prefix: string) => ({ type: 'string', pattern: `^${prefix}_[A-Za-z0-9]+$` });

const ISO_DATETIME = { type: 'string', format: 'date-time' };

const CONFIDENCE = {
  type: 'integer',
  minimum: 1,
  maximum: 5,
  // Document 1 §1.3a — the 0–100/1–5 distinction is load-bearing.
  description: 'Confidence, 1–5. Not a percentage.',
};

const ERROR_TYPE = {
  type: 'string',
  enum: ['conceptual', 'procedural', 'careless', 'knowledge_gap'],
};

const ERROR_LITE = {
  type: 'object',
  additionalProperties: false,
  required: ['error_type', 'description'],
  properties: {
    error_type: ERROR_TYPE,
    description: { type: 'string', maxLength: 500 },
    // Phase 5 (design §M/§I.1). Tutor-PROPOSED structured error identity —
    // observations only; the app owns pattern creation/linking.
    proposed_signature: { type: 'string', maxLength: 200 },
    proposed_severity: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

const TEST_EVIDENCE = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'out_of', 'actual_retention'],
  properties: {
    score: { type: 'number', minimum: 0 },
    out_of: { type: 'number', exclusiveMinimum: 0 },
    actual_retention: { type: 'number', minimum: 0, maximum: 1 },
  },
};

// Design 2026-08-10 §B. Every dimension optional (partial applicability, #16);
// additionalProperties:false so a hallucinated dimension fails rather than being
// silently accepted (§1.5). Ordinals are integers with explicit bounds.
const ASSESSMENT_EVIDENCE: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    difficulty: { type: 'integer', minimum: 0, maximum: 5 },
    novelty: { type: 'integer', minimum: 0, maximum: 4 },
    independence: { type: 'integer', minimum: 0, maximum: 3 },
    transfer_level: { type: 'integer', minimum: 0, maximum: 3 },
    performance_quality: { type: 'integer', minimum: 0, maximum: 5 },
    quality_rationale: { type: 'string', maxLength: 1000 },
    cold: { type: 'boolean' },
    // 0–1 probability. Stored now; the strictly-before-completion foresight
    // check for calibration is a Phase 3 concern (design §D).
    predicted_success: { type: 'number', minimum: 0, maximum: 1 },
    predicted_at: ISO_DATETIME,
    assessed_by: { type: 'string', maxLength: 200 },
  },
};

const REVIEW_EVENT: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['event_id', 'date', 'kind', 'source', 'source_id', 'confidence_reported'],
  properties: {
    event_id: ID_PATTERN('event'),
    date: ISO_DATETIME,
    kind: { type: 'string', enum: ['study_review', 'test_pass', 'test_fail'] },
    source: { type: 'string', enum: ['session', 'exam', 'manual_review'] },
    source_id: { type: 'string' },
    confidence_reported: CONFIDENCE,
    test: TEST_EVIDENCE,
    smeared: { type: 'boolean' },
    fanout: { type: 'integer', minimum: 1 },
    notes: { type: 'string', maxLength: 500 },
    assessment: ASSESSMENT_EVIDENCE,
    // Phase 1 (design §4/§H, §B). Optional/additive; a store or bundle that has
    // decomposed assessment evidence must re-validate. additionalProperties:false
    // still rejects anything hallucinated.
    provenance: { type: 'string', enum: ['past_paper', 'ai_generated', 'diagnostic', 'custom'] },
    assessment_ref: {
      type: 'object',
      additionalProperties: false,
      required: ['assessment_id'],
      properties: {
        assessment_id: { type: 'string' },
        attempt_id: { type: 'string' },
        question_id: { type: 'string' },
      },
    },
  },
  // Document 1 v0.2 §2.4: `test` is required when kind is a test, forbidden otherwise.
  allOf: [
    {
      if: { properties: { kind: { enum: ['test_pass', 'test_fail'] } }, required: ['kind'] },
      then: { required: ['test'] },
      else: { not: { required: ['test'] } },
    },
  ],
};

const ERROR_LOG_ENTRY: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['error_id', 'date', 'source', 'source_id', 'error_type', 'description', 'resolved', 'resolved_date'],
  properties: {
    error_id: ID_PATTERN('error'),
    date: ISO_DATETIME,
    source: { type: 'string', enum: ['session', 'exam'] },
    source_id: { type: 'string' },
    error_type: ERROR_TYPE,
    description: { type: 'string', maxLength: 500 },
    resolved: { type: 'boolean' },
    resolved_date: { anyOf: [ISO_DATETIME, { type: 'null' }] },
    // Phase 1 (design §I.1/§I.3). Optional/additive; app-owned recurrence link and
    // intrinsic severity. `pattern_` prefix mirrors the other id patterns.
    pattern_id: ID_PATTERN('pattern'),
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
};

const TOPIC: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'topic_id', 'title', 'status', 'conf', 'strength', 'k_factor', 'cards',
    'last_reviewed', 'drift_history', 'review_history', 'error_log',
  ],
  properties: {
    topic_id: ID_PATTERN('topic'),
    title: { type: 'string', minLength: 1 },
    status: { type: 'string', enum: ['not_started', 'learning', 'practising', 'mastered'] },
    conf: CONFIDENCE,
    strength: { type: 'number', minimum: 0 },
    // Clamped to [K_MIN, K_MAX] = [4.2, 16.8] (Document 2 §1).
    k_factor: { type: 'number', minimum: 4.2, maximum: 16.8 },
    cards: { type: 'integer', minimum: 0 },
    last_reviewed: { anyOf: [ISO_DATETIME, { type: 'null' }] },
    // Engine-managed (Document 1 v0.2.1 §2.3). Optional on input so the §8
    // course prompt stays short — a fresh syllabus has nothing mastered.
    mastered_at: { anyOf: [ISO_DATETIME, { type: 'null' }] },
    drift_history: { type: 'array', items: { type: 'number' }, maxItems: 5 },
    review_history: { type: 'array', items: REVIEW_EVENT },
    error_log: { type: 'array', items: ERROR_LOG_ENTRY },
    // Design 2026-08-10 §E — optional upstream dependency list (topic_ids).
    prerequisites: { type: 'array', items: ID_PATTERN('topic') },
  },
};

export const COURSE_SCHEMA: SchemaObject = {
  $id: 'course',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'course_id', 'title', 'created_at', 'source', 'sections'],
  properties: {
    schema_version: { type: 'string' },
    course_id: ID_PATTERN('course'),
    title: { type: 'string', minLength: 1, maxLength: 120 },
    created_at: ISO_DATETIME,
    source: { type: 'string', enum: ['ai_generated', 'manual'] },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['section_id', 'title', 'order', 'topics'],
        properties: {
          section_id: ID_PATTERN('section'),
          title: { type: 'string', minLength: 1 },
          order: { type: 'integer', minimum: 0 },
          topics: { type: 'array', minItems: 1, items: TOPIC },
        },
      },
    },
  },
};

export const SESSION_SCHEMA: SchemaObject = {
  $id: 'session',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'session_id', 'course_id', 'date', 'duration_minutes', 'topics_covered'],
  properties: {
    schema_version: { type: 'string' },
    session_id: ID_PATTERN('session'),
    course_id: ID_PATTERN('course'),
    date: ISO_DATETIME,
    // The app is the timekeeper: a pasted session's duration is never stored
    // (see core/merge.ts mergeSession + hooks/useStore.ts commitSession), so
    // 0 — "the app records the real time" per the start-session briefing — is
    // a valid placeholder, not a real duration to reject.
    duration_minutes: { type: 'integer', minimum: 0 },
    // Phase 5 (design §M): tutor's advisory next step. Observation only.
    suggested_follow_up: { type: 'string', maxLength: 500 },
    topics_covered: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic_id', 'confidence_reported'],
        properties: {
          topic_id: ID_PATTERN('topic'),
          confidence_reported: CONFIDENCE,
          notes: { type: 'string', maxLength: 500 },
          errors: { type: 'array', items: ERROR_LITE },
          assessment: ASSESSMENT_EVIDENCE,
          // Phase 5 (design §M). Tutor observations, mapped to state by the app.
          concepts_demonstrated: { type: 'array', items: { type: 'string', maxLength: 200 } },
          uncertainty: { type: 'string', maxLength: 500 },
        },
      },
    },
  },
};

export const EXAM_SCHEMA: SchemaObject = {
  $id: 'exam',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'exam_id', 'title', 'date', 'linked_topic_ids', 'score', 'max_score'],
  properties: {
    schema_version: { type: 'string' },
    exam_id: ID_PATTERN('exam'),
    title: { type: 'string', minLength: 1 },
    date: ISO_DATETIME,
    linked_topic_ids: { type: 'array', minItems: 1, items: ID_PATTERN('topic') },
    score: { type: 'number', minimum: 0 },
    max_score: { type: 'number', exclusiveMinimum: 0 },
    confidence_reported: CONFIDENCE,
    // Design 2026-08-10 §C — tutor marks the whole paper cold; per-breakdown
    // assessment.cold overrides per topic (fallback resolved in merge.ts).
    cold: { type: 'boolean' },
    breakdown: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic_id', 'points_earned', 'points_possible'],
        properties: {
          topic_id: ID_PATTERN('topic'),
          points_earned: { type: 'number', minimum: 0 },
          points_possible: { type: 'number', exclusiveMinimum: 0 },
          confidence_reported: CONFIDENCE,
          errors: { type: 'array', items: ERROR_LITE },
          assessment: ASSESSMENT_EVIDENCE,
        },
      },
    },
  },
};

export type SchemaName = 'course' | 'session' | 'exam';

export const SCHEMAS: Record<SchemaName, SchemaObject> = {
  course: COURSE_SCHEMA,
  session: SESSION_SCHEMA,
  exam: EXAM_SCHEMA,
};

/** User-facing name for each schema, for error messages and previews. */
export const SCHEMA_LABEL: Record<SchemaName, string> = {
  course: 'course',
  session: 'study session',
  exam: 'exam result',
};
