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
const ISO_DATE = { type: 'string', format: 'date' };

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
    notes: { type: 'string', maxLength: 500 },
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
    duration_minutes: { type: 'integer', exclusiveMinimum: 0 },
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
        },
      },
    },
  },
};

export const RUNNING_SCHEMA: SchemaObject = {
  $id: 'running',
  type: 'object',
  additionalProperties: false,
  // pace_sec_per_km is computed on ingestion (Document 1 §5.1), so it is NOT
  // required on input — supplying it is how inconsistent math gets in.
  required: ['schema_version', 'activity_id', 'date', 'distance_km', 'duration_seconds', 'type'],
  properties: {
    schema_version: { type: 'string' },
    activity_id: ID_PATTERN('activity'),
    date: ISO_DATE,
    distance_km: { type: 'number', exclusiveMinimum: 0 },
    duration_seconds: { type: 'integer', exclusiveMinimum: 0 },
    pace_sec_per_km: { type: 'number', exclusiveMinimum: 0 },
    type: { type: 'string', enum: ['easy', 'tempo', 'long', 'interval', 'race'] },
    notes: { type: 'string' },
  },
};

export const LIFTING_SCHEMA: SchemaObject = {
  $id: 'lifting',
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'session_id', 'date', 'exercises'],
  properties: {
    schema_version: { type: 'string' },
    session_id: ID_PATTERN('session'),
    date: ISO_DATE,
    exercises: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['exercise_name', 'sets'],
        properties: {
          exercise_name: { type: 'string', minLength: 1 },
          sets: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['set_number', 'reps', 'weight_kg'],
              properties: {
                set_number: { type: 'integer', minimum: 1 },
                reps: { type: 'integer', minimum: 0 },
                weight_kg: { type: 'number', minimum: 0 },
                rpe: { type: 'number', minimum: 1, maximum: 10 },
              },
            },
          },
        },
      },
    },
  },
};

export type SchemaName = 'course' | 'session' | 'exam' | 'running' | 'lifting';

export const SCHEMAS: Record<SchemaName, SchemaObject> = {
  course: COURSE_SCHEMA,
  session: SESSION_SCHEMA,
  exam: EXAM_SCHEMA,
  running: RUNNING_SCHEMA,
  lifting: LIFTING_SCHEMA,
};

/** User-facing name for each schema, for error messages and previews. */
export const SCHEMA_LABEL: Record<SchemaName, string> = {
  course: 'course',
  session: 'study session',
  exam: 'exam result',
  running: 'run',
  lifting: 'lifting session',
};
