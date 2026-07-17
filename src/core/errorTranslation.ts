import type { ErrorObject } from 'ajv';
import type { SchemaName } from '@/domain/schemas';

/**
 * Plain-English error translation — Document 3 §5.6, Document 4 E2-S3.
 *
 * The rule: errors are shown in the interface's own voice, translated from raw
 * JSON-Schema output. Not `"instance.sections[0].topics[2].confidence must be
 * <= 100"` but `"Topic 'Chain rule' has a confidence of 105 — confidence is a
 * 1–5 rating, not a percentage."`
 *
 * Each message names the field by its *user-facing* label and states the fix
 * (Document 4 E2-S3). Voice rules (Document 3 §7): explain and instruct, never
 * apologise, never go vague.
 */

export interface FriendlyError {
  /** JSON pointer into the pasted object, e.g. /sections/0/topics/2/conf */
  path: string;
  /** The sentence shown to the user. */
  message: string;
}

/** User-facing labels for storage field names (Document 3 §5.6). */
const FIELD_LABELS: Record<string, string> = {
  schema_version: 'schema version',
  course_id: 'course ID',
  section_id: 'section ID',
  topic_id: 'topic ID',
  session_id: 'session ID',
  exam_id: 'exam ID',
  activity_id: 'activity ID',
  event_id: 'event ID',
  error_id: 'error ID',
  source_id: 'source ID',
  title: 'title',
  created_at: 'created date',
  date: 'date',
  status: 'status',
  conf: 'confidence',
  confidence_reported: 'confidence',
  strength: 'strength',
  k_factor: 'decay constant',
  cards: 'flashcard count',
  last_reviewed: 'last reviewed date',
  drift_history: 'drift history',
  review_history: 'review history',
  error_log: 'error log',
  sections: 'sections',
  topics: 'topics',
  topics_covered: 'topics covered',
  duration_minutes: 'duration',
  linked_topic_ids: 'linked topics',
  score: 'score',
  max_score: 'maximum score',
  out_of: 'marks available',
  points_earned: 'points earned',
  points_possible: 'points possible',
  breakdown: 'breakdown',
  error_type: 'error type',
  description: 'description',
  resolved: 'resolved flag',
  distance_km: 'distance',
  duration_seconds: 'duration',
  pace_sec_per_km: 'pace',
  type: 'run type',
  exercises: 'exercises',
  exercise_name: 'exercise name',
  sets: 'sets',
  set_number: 'set number',
  reps: 'reps',
  weight_kg: 'weight',
  rpe: 'RPE',
  kind: 'event kind',
  source: 'source',
  notes: 'notes',
  test: 'test result',
  actual_retention: 'observed retention',
};

/** Fields withdrawn in Document 1 v0.2 — worth naming explicitly, because
 *  JSON built against the old model is the likeliest thing a user pastes. */
const WITHDRAWN_FIELDS: Record<string, string> = {
  ease_factor: "`ease_factor` isn't part of this tracker any more",
  memory_strength: "`memory_strength` has been replaced by `strength`",
  next_review_due: '`next_review_due` is worked out automatically now, not stored',
  recall_success: '`recall_success` has been replaced by the event kind',
  confidence: '`confidence` on a topic is called `conf` now',
};

function label(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function lastSegment(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? '';
}

/** Read a value out of the pasted object by JSON pointer. */
function valueAt(root: unknown, pointer: string): unknown {
  if (!pointer) return root;
  let cur: unknown = root;
  for (const raw of pointer.split('/').slice(1)) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Name the thing the error is about, e.g. "Topic 'Chain rule'".
 * Walks up from the error path to the nearest object with a title, so the user
 * gets a name they recognise rather than an array index.
 */
function subject(root: unknown, pointer: string): string | null {
  const parts = pointer.split('/');
  for (let i = parts.length; i > 0; i--) {
    const p = parts.slice(0, i).join('/');
    const v = valueAt(root, p);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      const title = obj['title'] ?? obj['exercise_name'];
      if (typeof title === 'string' && title.length > 0) {
        const kind = p.includes('/topics/')
          ? 'Topic'
          : p.includes('/sections/')
            ? 'Section'
            : p.includes('/exercises/')
              ? 'Exercise'
              : null;
        return kind ? `${kind} '${title}'` : `'${title}'`;
      }
    }
  }
  return null;
}

function withSubject(root: unknown, pointer: string, rest: string, fallback: string): string {
  const s = subject(root, pointer);
  return s ? `${s} ${rest}` : `${fallback} ${rest}`;
}

/**
 * Translate one Ajv error into a sentence. `root` is the pasted object, used to
 * name topics/sections by title rather than index.
 */
export function translateError(
  err: ErrorObject,
  root: unknown,
  schemaName: SchemaName,
): FriendlyError {
  const path = err.instancePath;
  const field = lastSegment(path);
  const actual = valueAt(root, path);

  switch (err.keyword) {
    case 'additionalProperties': {
      const extra = String((err.params as { additionalProperty: string }).additionalProperty);
      const withdrawn = WITHDRAWN_FIELDS[extra];
      if (withdrawn) {
        return {
          path: `${path}/${extra}`,
          message: `${withdrawn}. Remove it and re-generate with the current prompt — this JSON looks like it was made for an older version.`,
        };
      }
      return {
        path: `${path}/${extra}`,
        message: `There's an unexpected field '${extra}' that this ${schemaName} doesn't have. Remove it — extra fields usually mean the AI invented something.`,
      };
    }

    case 'required': {
      const missing = String((err.params as { missingProperty: string }).missingProperty);
      return {
        path: `${path}/${missing}`,
        message: withSubject(
          root,
          path,
          `is missing its ${label(missing)}. Add it.`,
          `This ${schemaName}`,
        ),
      };
    }

    case 'enum': {
      const allowed = (err.params as { allowedValues: unknown[] }).allowedValues;
      return {
        path,
        message: withSubject(
          root,
          path,
          `has a ${label(field)} of '${String(actual)}', which isn't one of the allowed values: ${allowed
            .map((v) => `'${String(v)}'`)
            .join(', ')}.`,
          `The ${label(field)}`,
        ),
      };
    }

    case 'maximum':
    case 'exclusiveMaximum': {
      const limit = (err.params as { limit: number }).limit;
      // The confidence 1–5 vs percentage confusion is the single likeliest
      // mistake now that Document 1 v0.2 changed the scale — name it directly.
      if (field === 'conf' || field === 'confidence_reported') {
        return {
          path,
          message: withSubject(
            root,
            path,
            `has a confidence of ${String(actual)} — confidence is a 1–5 rating, not a percentage.`,
            'A confidence',
          ),
        };
      }
      return {
        path,
        message: withSubject(
          root,
          path,
          `has a ${label(field)} of ${String(actual)} — it can't be above ${limit}.`,
          `The ${label(field)}`,
        ),
      };
    }

    case 'minimum':
    case 'exclusiveMinimum': {
      const limit = (err.params as { limit: number }).limit;
      if (field === 'conf' || field === 'confidence_reported') {
        return {
          path,
          message: withSubject(
            root,
            path,
            `has a confidence of ${String(actual)} — confidence is a 1–5 rating, so ${limit} is the lowest it goes.`,
            'A confidence',
          ),
        };
      }
      return {
        path,
        message: withSubject(
          root,
          path,
          `has a ${label(field)} of ${String(actual)} — it can't be below ${limit}.`,
          `The ${label(field)}`,
        ),
      };
    }

    case 'type': {
      const expected = (err.params as { type: string }).type;
      return {
        path,
        message: withSubject(
          root,
          path,
          `has a ${label(field)} of '${String(actual)}', but it needs to be ${
            /^[aeiou]/i.test(expected) ? 'an' : 'a'
          } ${expected}.`,
          `The ${label(field)}`,
        ),
      };
    }

    case 'minItems': {
      const limit = (err.params as { limit: number }).limit;
      return {
        path,
        message: withSubject(
          root,
          path,
          `needs at least ${limit} ${label(field)}, but has none.`,
          `The ${label(field)}`,
        ),
      };
    }

    case 'maxItems': {
      const limit = (err.params as { limit: number }).limit;
      return {
        path,
        message: `The ${label(field)} has more than ${limit} entries, which is the most allowed.`,
      };
    }

    case 'maxLength': {
      const limit = (err.params as { limit: number }).limit;
      return {
        path,
        message: withSubject(
          root,
          path,
          `has a ${label(field)} longer than ${limit} characters. Shorten it.`,
          `The ${label(field)}`,
        ),
      };
    }

    case 'minLength': {
      return {
        path,
        message: withSubject(root, path, `has an empty ${label(field)}. Fill it in.`, `The ${label(field)}`),
      };
    }

    case 'pattern': {
      return {
        path,
        message: `The ${label(field)} '${String(actual)}' isn't formatted right — it should start with '${
          field.replace(/_id$/, '')
        }_' followed by letters or numbers.`,
      };
    }

    case 'format': {
      const fmt = (err.params as { format: string }).format;
      return {
        path,
        message: `The ${label(field)} '${String(actual)}' isn't a valid ${
          fmt === 'date-time' ? 'date and time' : 'date'
        }. Use ${fmt === 'date-time' ? '2026-07-16T14:32:00Z' : '2026-07-16'} format.`,
      };
    }

    // The `test`-required-with-kind rule (Document 1 v0.2 §2.4).
    case 'not':
      return {
        path,
        message: `This review event has a test result but isn't marked as a test. Only 'test_pass' and 'test_fail' events carry one.`,
      };

    case 'if':
    case 'allOf':
      // Structural wrappers — the real cause is reported by a sibling error.
      return { path, message: '' };

    default:
      return {
        path,
        message: withSubject(
          root,
          path,
          `has a problem with its ${label(field)}: ${err.message ?? 'it failed validation'}.`,
          `This ${schemaName}`,
        ),
      };
  }
}

/**
 * Translate a whole error list, dropping structural noise and de-duplicating.
 * Ajv reports `if`/`allOf`/`not` wrappers alongside the real cause; surfacing
 * those would defeat the point of translating at all.
 */
export function translateErrors(
  errors: readonly ErrorObject[],
  root: unknown,
  schemaName: SchemaName,
): FriendlyError[] {
  const out: FriendlyError[] = [];
  const seen = new Set<string>();

  for (const err of errors) {
    const t = translateError(err, root, schemaName);
    if (!t.message) continue;
    const key = `${t.path}|${t.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }

  return out;
}
