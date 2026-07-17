import { SCHEMA_LABEL, type SchemaName } from '@/domain/schemas';
import type { Course, Exam, LiftingSession, RunningActivity, Store, StudySession } from '@/domain/types';
import type { FriendlyError } from './errorTranslation';
import { checkIntegrity } from './integrity';
import { cloneStore } from './storage';
import { parseJson, validateAgainst } from './validate';

/**
 * The ingestion pipeline — Document 1 §6.1, Document 4 E2-S1…S4.
 *
 *   1. Parse            → on failure, stop and show where.
 *   2. Schema validate  → collect ALL errors.
 *   3. Integrity check  → collect ALL failures.
 *   4. On any failure   → do not partially ingest; return the structured list.
 *   5. On success       → preview, then an explicit commit. Never silent.
 */

export interface Preview {
  /** e.g. "Calculus I — 3 sections, 14 topics" (Document 3 §5.6 step 5). */
  summary: string;
  detail: string[];
}

export type IngestResult =
  | { ok: true; schemaName: SchemaName; value: unknown; preview: Preview }
  | { ok: false; errors: FriendlyError[] };

/** Steps 1–3. Produces a preview but commits nothing. */
export function ingest(input: string, schemaName: SchemaName, store: Store): IngestResult {
  const parsed = parseJson(input);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };

  const validated = validateAgainst(schemaName, parsed.value);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const integrity = checkIntegrity(schemaName, validated.value, store);
  if (integrity.length > 0) return { ok: false, errors: integrity };

  return {
    ok: true,
    schemaName,
    value: validated.value,
    preview: buildPreview(schemaName, validated.value),
  };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function buildPreview(schemaName: SchemaName, value: unknown): Preview {
  switch (schemaName) {
    case 'course': {
      const c = value as Course;
      const topics = c.sections.reduce((n, s) => n + s.topics.length, 0);
      return {
        summary: `${c.title} — ${plural(c.sections.length, 'section')}, ${plural(topics, 'topic')}`,
        detail: c.sections.map((s) => `${s.title} · ${plural(s.topics.length, 'topic')}`),
      };
    }
    case 'session': {
      const s = value as StudySession;
      const errs = s.topics_covered.reduce((n, t) => n + (t.errors?.length ?? 0), 0);
      return {
        summary: `${plural(s.duration_minutes, 'minute')} across ${plural(
          s.topics_covered.length,
          'topic',
        )}${errs > 0 ? `, ${plural(errs, 'mistake')} logged` : ''}`,
        detail: s.topics_covered.map(
          (t) => `${t.topic_id} · confidence ${t.confidence_reported}/5${
            t.errors?.length ? ` · ${plural(t.errors.length, 'mistake')}` : ''
          }`,
        ),
      };
    }
    case 'exam': {
      const e = value as Exam;
      const pct = Math.round((e.score / e.max_score) * 100);
      return {
        summary: `${e.title} — ${e.score}/${e.max_score} (${pct}%) across ${plural(
          e.linked_topic_ids.length,
          'topic',
        )}`,
        detail: e.breakdown
          ? e.breakdown.map((b) => `${b.topic_id} · ${b.points_earned}/${b.points_possible}`)
          : [`No per-topic breakdown — ${pct}% will be applied to every linked topic.`],
      };
    }
    case 'running': {
      const r = value as RunningActivity;
      return {
        summary: `${r.distance_km} km ${r.type} run on ${r.date}`,
        detail: [],
      };
    }
    case 'lifting': {
      const l = value as LiftingSession;
      const sets = l.exercises.reduce((n, e) => n + e.sets.length, 0);
      return {
        summary: `${plural(l.exercises.length, 'exercise')}, ${plural(sets, 'set')} on ${l.date}`,
        detail: l.exercises.map((e) => `${e.exercise_name} · ${plural(e.sets.length, 'set')}`),
      };
    }
  }
}

/**
 * Step 5: commit. Mutations are applied to a *clone*; the caller only swaps in
 * the result if this returns. A throw mid-way leaves the live store untouched,
 * which is what makes the commit atomic (Document 4 E2-S4).
 *
 * `merge` is the domain-specific logic from Document 1 §6.3.
 */
export function commit(
  schemaName: SchemaName,
  value: unknown,
  store: Store,
  merge: (draft: Store, schemaName: SchemaName, value: unknown) => void,
): Store {
  const draft = cloneStore(store);
  merge(draft, schemaName, value);
  return draft;
}

/** The action's verb, for the success toast (Document 3 §7). */
export const COMMIT_VERB: Record<SchemaName, string> = {
  course: 'Course added',
  session: 'Session logged',
  exam: 'Exam result added',
  running: 'Run logged',
  lifting: 'Lifting session logged',
};

export { SCHEMA_LABEL };
