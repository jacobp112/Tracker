import { type SchemaName } from '@/domain/schemas';
import { type Course, type Exam, emptyStore, type LiftingSession, type RunningActivity, SCHEMA_VERSION, type Store } from '@/domain/types';
import type { FriendlyError } from './errorTranslation';
import { checkIntegrity } from './integrity';
import { validateAgainst } from './validate';

/**
 * Full data export / import — Document 4 E8-S1.
 *
 * Export is a single JSON bundle of every domain. Import **schema-validates and
 * integrity-checks every object** (E2-S1…S3), so a hand-edited or corrupt
 * bundle cannot enter unchecked — held to the same standard as a fresh paste.
 *
 * Import RESTORES, it does not re-ingest. This distinction is load-bearing for
 * the round-trip guarantee (E8-S1: export → import into empty → identical
 * state): a bundle's objects are already-merged *domain* objects — a Course
 * whose topics already carry their session- and exam-derived events, plus the
 * Exam objects those events came from. Re-running the ingestion merge would call
 * the engine's `applyEvent` a second time and double-count every exam. So each
 * object is validated, then placed back verbatim; nothing is re-derived.
 */

export const BUNDLE_KIND = 'studyos-export';

export interface Bundle {
  kind: typeof BUNDLE_KIND;
  schema_version: string;
  exported_at: string;
  store: Store;
}

export function exportBundle(store: Store): string {
  const bundle: Bundle = {
    kind: BUNDLE_KIND,
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    store,
  };
  return JSON.stringify(bundle, null, 2);
}

export type ImportResult =
  | { ok: true; store: Store; counts: Record<string, number> }
  | { ok: false; errors: FriendlyError[] };

/**
 * Validate one object against its schema and the store built so far, then hand
 * back the checked value for the caller to place verbatim. Returns errors
 * instead of the value on failure. Objects are fed in dependency order (courses
 * before the exams that reference their topics).
 */
function check(draft: Store, schemaName: SchemaName, value: unknown): FriendlyError[] {
  const validated = validateAgainst(schemaName, value);
  if (!validated.ok) return validated.errors;
  // Integrity for a bundle: exam topic references must resolve against the
  // courses already restored. The course "already exists" rule can't fire —
  // draft starts empty and each course_id appears once in a valid bundle.
  return checkIntegrity(schemaName, validated.value, draft);
}

/**
 * Parse and import a bundle into a **fresh** store (E8-S1 imports into empty
 * state). Rebuilds the store object-by-object through validation so the result
 * is guaranteed schema-clean.
 */
export function importBundle(input: string): ImportResult {
  let parsed: Bundle;
  try {
    parsed = JSON.parse(input.trim()) as Bundle;
  } catch {
    return { ok: false, errors: [{ path: '', message: "That file isn't valid JSON." }] };
  }

  if (parsed?.kind !== BUNDLE_KIND) {
    return {
      ok: false,
      errors: [
        { path: '/kind', message: "This doesn't look like a StudyOS export. Choose a file you exported from here." },
      ],
    };
  }
  if (parsed.schema_version !== SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        {
          path: '/schema_version',
          message: `This export is version ${parsed.schema_version ?? 'unknown'}, but this app expects ${SCHEMA_VERSION}.`,
        },
      ],
    };
  }

  const src = parsed.store ?? emptyStore();
  const draft = emptyStore();
  const errors: FriendlyError[] = [];

  const prefix = (label: string, errs: FriendlyError[]) =>
    errs.map((e) => ({ ...e, message: `${label}: ${e.message}` }));

  // Courses first — exams resolve topic references against them. Each object is
  // validated, then restored verbatim (no re-derivation — see the file header).
  for (const course of src.courses ?? []) {
    const errs = check(draft, 'course', course);
    if (errs.length === 0) draft.courses.push(course as Course);
    else errors.push(...prefix(`Course "${course.title ?? course.course_id}"`, errs));
  }
  for (const exam of src.exams ?? []) {
    const errs = check(draft, 'exam', exam);
    if (errs.length === 0) draft.exams.push(exam as Exam);
    else errors.push(...prefix(`Exam "${exam.title ?? exam.exam_id}"`, errs));
  }
  for (const run of src.runs ?? []) {
    const errs = check(draft, 'running', run);
    if (errs.length === 0) draft.runs.push(run as RunningActivity);
    else errors.push(...prefix('Run', errs));
  }
  for (const lift of src.lifts ?? []) {
    const errs = check(draft, 'lifting', lift);
    if (errs.length === 0) draft.lifts.push(lift as LiftingSession);
    else errors.push(...prefix('Lift', errs));
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    store: draft,
    counts: {
      courses: draft.courses.length,
      exams: draft.exams.length,
      runs: draft.runs.length,
      lifts: draft.lifts.length,
    },
  };
}
