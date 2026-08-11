import { type SchemaName } from '@/domain/schemas';
import { type Course, type Exam, emptyStore, SCHEMA_VERSION, type Store } from '@/domain/types';
import type { AssessmentAttempt, AssessmentDefinition } from '@/domain/assessment';
import type { AssessmentRepo } from './assessment-store';
import type { FriendlyError } from './errorTranslation';
import { checkIntegrity } from './integrity';
import { recomputeLapseContamination } from './migrations';
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
  /** Assessment domain (design §O). Optional so ≤3.3.0 bundles (which never had
   *  it) round-trip unchanged, and the sync localStorage-only path still works. */
  assessments?: AssessmentDefinition[];
  attempts?: AssessmentAttempt[];
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
  // Older bundles migrate forward (courses + exams are unchanged, removed
  // domains are simply ignored below); only a NEWER version is rejected.
  if (parsed.schema_version && parsed.schema_version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        {
          path: '/schema_version',
          message: `This export is version ${parsed.schema_version}, but this app expects ${SCHEMA_VERSION}.`,
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

  // Error patterns are app-owned domain objects (no ingestion schema); restore
  // them verbatim so the round-trip is identity-preserving (E8-S1). Absent in
  // ≤3.2.0 bundles → [].
  draft.error_patterns = Array.isArray(src.error_patterns) ? src.error_patterns : [];
  draft.assessment_refs = Array.isArray(src.assessment_refs) ? src.assessment_refs : [];

  if (errors.length > 0) return { ok: false, errors };

  // Import must run the same v3.1.0 migration as the load path (design §4): a
  // pre-3.1.0 bundle imported after deploy would otherwise reinstate contaminated
  // kFactor. Idempotent, so a 3.1.0+ bundle is untouched.
  if ((parsed.schema_version ?? '0.0.0') < '3.1.0') recomputeLapseContamination(draft);

  return {
    ok: true,
    store: draft,
    counts: {
      courses: draft.courses.length,
      exams: draft.exams.length,
    },
  };
}

/* ── Both-stores backup/restore (design §O) ────────────────────────
 * The async variants add the IndexedDB assessment domain to the same bundle.
 * They compose the sync study-store path so its validation/migration guarantees
 * are untouched, and only reach IndexedDB once the study store has validated —
 * so a failure never leaves the two stores in a partial cross-store state. */

/** Export the whole app: study store (localStorage) + assessment domain (IndexedDB). */
export async function exportBundleAsync(store: Store, repo: AssessmentRepo): Promise<string> {
  const snap = await repo.dump();
  const bundle: Bundle = {
    kind: BUNDLE_KIND,
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    store,
    assessments: snap.assessments,
    attempts: snap.attempts,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Import both stores, in the ONLY safe order (design review Fix 2):
 *   validate study store → persist study store (localStorage) → restore repo (IDB).
 * localStorage is the failure-prone step (quota), so it goes first: if it throws,
 * IndexedDB is never touched, so there is no partial two-store restore. If the
 * later IDB restore fails, the study store is already consistent and re-import
 * recovers the assessment domain.
 *
 * `saveStudyStore` persists the validated study store synchronously and must throw
 * on failure. When omitted (e.g. some tests), the study store is left for the
 * caller to adopt and only the repo is restored.
 */
export async function importBundleAsync(
  input: string,
  repo: AssessmentRepo,
  saveStudyStore?: (store: Store) => void,
): Promise<ImportResult> {
  const res = importBundle(input);
  if (!res.ok) return res; // study store invalid → nothing written anywhere

  let parsed: Bundle;
  try {
    parsed = JSON.parse(input.trim()) as Bundle;
  } catch {
    return { ok: false, errors: [{ path: '', message: "That file isn't valid JSON." }] };
  }

  // 1) Persist the study store FIRST — fail fast before touching IndexedDB.
  if (saveStudyStore) {
    try {
      saveStudyStore(res.store);
    } catch (e) {
      return { ok: false, errors: [{ path: '', message: `${e instanceof Error ? e.message : "Your data couldn't be saved"}. Nothing was changed.` }] };
    }
  }

  // 2) Then restore the assessment domain (atomic within IndexedDB).
  try {
    await repo.restore({ assessments: parsed.assessments ?? [], attempts: parsed.attempts ?? [] });
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: '/assessments', message: `The assessment data couldn't be restored: ${e instanceof Error ? e.message : 'unknown error'}.` }],
    };
  }

  return {
    ...res,
    counts: {
      ...res.counts,
      assessments: parsed.assessments?.length ?? 0,
      attempts: parsed.attempts?.length ?? 0,
    },
  };
}
