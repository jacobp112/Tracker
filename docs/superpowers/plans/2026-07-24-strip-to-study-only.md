# Strip to Study-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Fitness (running + lifting) and Jobs domains entirely, leaving a study-only tracker (Study + Exams), while preserving existing saved courses and exam history through a forward-migration.

**Architecture:** Remove one domain at a time keeping the build green (TypeScript enforces completeness — dropping keys from `SchemaName` and `Store` breaks every consumer until cleaned). The schema-version bump and the load/import migration land last, once `Store` is already study-only, so `migrate()` can typecheck against the reduced type. Existing `2.0.0` data continues to load throughout (version unchanged until the final task).

**Tech Stack:** TypeScript (strict), React 18, Vite, Vitest + Testing Library (jsdom), ajv JSON Schema, hash routing, localStorage.

## Global Constraints

- **Preserve study data.** Courses, topics, review history, and exams must survive the change intact. A v2.0.0 store containing fitness/job data must load as a study-only store with courses+exams unchanged.
- **Build stays green per task.** Each task ends with `npm run typecheck` clean AND `npx vitest run` green. No task may leave dangling references.
- **Full deletion, not hiding.** Removed domains leave no routes, engine modules, schemas, types, nav, prompts, or dead CSS.
- **No behavior change to Study or Exams**, including the in-progress Exams work.
- **Strict ingestion preserved** for the remaining domains (`additionalProperties: false`).
- **Completeness gate:** after each removal, a `grep` for the domain's terms over `src/` and `tests/` returns no live references.

---

## File / structure map

**Deleted:** `src/routes/{Fitness,AddFitness,Jobs,AddJob}.tsx`, `src/engine/{fitness,jobs}.ts`, `src/styles/jobs.css`, `tests/engine/{fitness,jobs,overview-jobs}.test.ts`, and `src/components/LineChart.tsx` (Fitness task, only if unused elsewhere).

**Pruned (fitness/job references removed, study/exam kept):** `src/domain/{types,schemas,prompts}.ts`, `src/core/{merge,detect,integrity,pipeline,transfer,storage}.ts`, `src/hooks/useStore.ts`, `src/engine/{overview,palette}.ts`, `src/routes/{Overview,QuickAdd,Settings}.tsx`, `src/shell/{AppShell,icons}.tsx`, `src/router.ts`, `src/App.tsx`, `src/main.tsx`, and the tests that reference the removed domains.

---

## Task 1: Remove the Jobs domain end-to-end

**Files:**
- Delete: `src/routes/Jobs.tsx`, `src/routes/AddJob.tsx`, `src/engine/jobs.ts`, `src/styles/jobs.css`, `tests/engine/jobs.test.ts`, `tests/engine/overview-jobs.test.ts`
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/prompts.ts`, `src/core/merge.ts`, `src/core/detect.ts`, `src/core/integrity.ts`, `src/core/pipeline.ts`, `src/core/transfer.ts`, `src/hooks/useStore.ts`, `src/engine/overview.ts`, `src/engine/palette.ts`, `src/routes/Overview.tsx`, `src/routes/QuickAdd.tsx`, `src/shell/AppShell.tsx`, `src/shell/icons.tsx`, `src/router.ts`, `src/App.tsx`, `src/main.tsx`, and any test that references jobs.

**Interfaces:**
- Produces: a `Store` type without `applications`; `SchemaName` without `'job'`; no `moveStage`/`editApplication`/`archiveApplication` on `useStore`.

**Do NOT** bump `SCHEMA_VERSION` in this task (keep it `2.0.0` so existing data still loads via the current version check).

- [ ] **Step 1: Delete the job-only files**

```bash
git rm src/routes/Jobs.tsx src/routes/AddJob.tsx src/engine/jobs.ts src/styles/jobs.css tests/engine/jobs.test.ts tests/engine/overview-jobs.test.ts
```

- [ ] **Step 2: Prune job types from `src/domain/types.ts`**

Remove: `JobStage`, `StageEvent`, `JobContact`, `JobApplication`, the `currentStage` function, and `applications` from the `Store` interface and from `emptyStore()`. Leave all Study/Exam/Fitness types untouched (Fitness goes in Task 2). The `Store` interface becomes (fitness still present here — removed next task):

```ts
export interface Store {
  schema_version: string;
  courses: Course[];
  exams: Exam[];
  runs: RunningActivity[];
  lifts: LiftingSession[];
}
```
and `emptyStore()` drops the `applications: []` line.

- [ ] **Step 3: Prune the job schema from `src/domain/schemas.ts`**

Remove `JOB_STAGE`, `STAGE_EVENT`, `JOB_SCHEMA`; drop `'job'` from the `SchemaName` union; remove the `job:` entries from `SCHEMAS` and `SCHEMA_LABEL`.

- [ ] **Step 4: Prune job handling from core + prompts + engine + hooks**

- `src/core/pipeline.ts`: remove the `case 'job':` block in `buildPreview` and the `job:` entry in `COMMIT_VERB`.
- `src/core/merge.ts`: remove `mergeJob`, the `case 'job':` in `mergeInto`, and the `JobApplication`/`JobStage` imports.
- `src/core/detect.ts`: remove any job detection heuristic/branch.
- `src/core/integrity.ts`: remove any job integrity rule.
- `src/core/transfer.ts`: remove the `applications` import (`JobApplication`), the `for (const app of src.applications …)` loop, and the `applications:` line in `counts`.
- `src/domain/prompts.ts`: remove the job prompt builder(s) and any job entry in a prompt registry.
- `src/hooks/useStore.ts`: remove `moveStage`, `editApplication`, `archiveApplication` and drop them from the returned object and the `JobApplication`/`JobStage`/`currentStage` imports.
- `src/engine/overview.ts`: remove the `job` feed kind from `FeedKind` and the `for (const app of store.applications …)` block in `activityFeed`; remove `upcomingActions`/job-funnel exports if job-only, and the `JobStage` import + `JOB_FEED_TITLE`.
- `src/engine/palette.ts`: remove any job domain color entry.

- [ ] **Step 5: Prune job UI/routing**

- `src/routes/Overview.tsx`: remove the "Coming up" job-deadline section, the `upcomingActions`/`STAGE_LABEL`/`currentStage`/`JobsIcon` imports, and `job` from the feed icon map.
- `src/routes/QuickAdd.tsx`: remove the add-job action/entry.
- `src/shell/AppShell.tsx`: remove the Jobs nav item, the `add-job → 'jobs'` active-state mapping, and the Jobs nav block; remove the `JobsIcon` import.
- `src/shell/icons.tsx`: remove `JobsIcon` (now unused).
- `src/router.ts`: remove `{ name: 'jobs' }`, `{ name: 'add-job' }` from the route union and their `case` parsing.
- `src/App.tsx`: remove the `case 'jobs':` and `case 'add-job':` render branches and the `Jobs`/`AddJob` imports.
- `src/main.tsx`: remove any job wiring if present.

- [ ] **Step 6: Typecheck and fix every dangling reference**

Run: `npm run typecheck`
Expected: passes. TypeScript will point at any missed `Record<SchemaName,…>` key, `switch` case, or import — fix each until clean. This is the completeness gate.

- [ ] **Step 7: Update/remove tests that reference jobs**

Run: `npx vitest run` — for each failure caused by a removed job reference, update the test (drop job assertions/fixtures) or delete it if it was job-only. Known candidates: `tests/core/transfer.test.ts` (round-trip counts/objects), `tests/core/pipeline.test.ts` (job preview/verb), `tests/core/detect.test.ts` (job detection), `tests/integration/app-smoke.test.tsx` (job nav/seed), `tests/shell/AppShell.test.tsx` (Jobs nav item), `tests/engine/overview.test.ts` (job feed items). Do not weaken a study/exam assertion — only remove job-specific ones.

- [ ] **Step 8: Confirm no live job references remain**

Run: `grep -rniE "\bjob\b|application|stage_history|jobstage|movestage|currentStage" src/ tests/`
Expected: no live references (matches only in unrelated words, if any — inspect each). Fix any stragglers.

- [ ] **Step 9: Full suite + commit**

Run: `npx vitest run` (green) and `npm run typecheck` (clean).
```bash
git add -A
git commit -m "refactor: remove the Jobs domain"
```

---

## Task 2: Remove the Fitness domain (running + lifting) end-to-end

**Files:**
- Delete: `src/routes/Fitness.tsx`, `src/routes/AddFitness.tsx`, `src/engine/fitness.ts`, `tests/engine/fitness.test.ts`, and `src/components/LineChart.tsx` **iff** unused after (verify in Step 5).
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/prompts.ts`, `src/core/merge.ts`, `src/core/detect.ts`, `src/core/integrity.ts`, `src/core/pipeline.ts`, `src/core/transfer.ts`, `src/engine/overview.ts`, `src/engine/palette.ts`, `src/routes/Overview.tsx`, `src/routes/QuickAdd.tsx`, `src/shell/AppShell.tsx`, `src/shell/icons.tsx`, `src/router.ts`, `src/App.tsx`, `src/main.tsx`, and tests referencing fitness.

**Interfaces:**
- Produces: `Store = { schema_version, courses, exams }`; `SchemaName = 'course' | 'session' | 'exam'`.

Do NOT bump `SCHEMA_VERSION` yet.

- [ ] **Step 1: Delete the fitness-only files**

```bash
git rm src/routes/Fitness.tsx src/routes/AddFitness.tsx src/engine/fitness.ts tests/engine/fitness.test.ts
```

- [ ] **Step 2: Prune fitness types from `src/domain/types.ts`**

Remove `RunningActivity`, `LiftingSession`, `LiftSet`, and `runs`/`lifts` from `Store` and `emptyStore()`. Final shapes:

```ts
export interface Store {
  schema_version: string;
  courses: Course[];
  exams: Exam[];
}

export function emptyStore(): Store {
  return { schema_version: SCHEMA_VERSION, courses: [], exams: [] };
}
```

- [ ] **Step 3: Prune fitness schemas from `src/domain/schemas.ts`**

Remove `RUNNING_SCHEMA`, `LIFTING_SCHEMA`; reduce `SchemaName` to `'course' | 'session' | 'exam'`; drop `running`/`lifting` from `SCHEMAS` and `SCHEMA_LABEL`.

- [ ] **Step 4: Prune fitness handling from core + prompts + engine**

- `src/core/pipeline.ts`: remove `case 'running':` and `case 'lifting':` from `buildPreview`; remove `running`/`lifting` from `COMMIT_VERB`; drop the `RunningActivity`/`LiftingSession` imports.
- `src/core/merge.ts`: remove `mergeRunning`, `mergeLifting`, their `mergeInto` cases, and the `RunningActivity`/`LiftingSession` imports.
- `src/core/detect.ts`, `src/core/integrity.ts`: remove any running/lifting branch.
- `src/core/transfer.ts`: remove the `runs`/`lifts` import types, their import loops, and their `counts` lines.
- `src/domain/prompts.ts`: remove running/lifting prompt builders.
- `src/engine/overview.ts`: remove `run` and `lift` from `FeedKind`, the `for (const run of store.runs …)` and `for (const lift of store.lifts …)` blocks in `activityFeed`, and the `formatPace` import.
- `src/engine/palette.ts`: remove fitness domain color entries.

- [ ] **Step 5: Prune fitness UI/routing and decide LineChart**

- `src/routes/Overview.tsx`: remove `run`/`lift` from the feed icon map and any `FitnessIcon` import.
- `src/routes/QuickAdd.tsx`: remove add-run and add-lift actions.
- `src/shell/AppShell.tsx`: remove the Fitness nav item, the `add-run`/`add-lift → 'fitness'` active mapping, and the `FitnessIcon` import.
- `src/shell/icons.tsx`: remove `FitnessIcon`.
- `src/router.ts`: remove `{ name: 'fitness' }`, `{ name: 'add-run' }`, `{ name: 'add-lift' }` and their parsing.
- `src/App.tsx`: remove the `case 'fitness':`, `case 'add-run':`, `case 'add-lift':` branches and the `Fitness`/`AddFitness` imports.
- LineChart: run `grep -rn "LineChart" src/` — if the only importers were the deleted fitness routes, `git rm src/components/LineChart.tsx`; otherwise leave it.

- [ ] **Step 6: Typecheck and fix dangling references**

Run: `npm run typecheck`
Expected: passes after fixing every reference TS flags.

- [ ] **Step 7: Update/remove fitness tests**

Run: `npx vitest run` — fix or remove fitness references in `tests/core/transfer.test.ts`, `tests/core/pipeline.test.ts`, `tests/core/detect.test.ts`, `tests/integration/app-smoke.test.tsx`, `tests/shell/AppShell.test.tsx`, `tests/engine/overview.test.ts`. Only remove fitness-specific assertions.

- [ ] **Step 8: Confirm no live fitness references remain**

Run: `grep -rniE "fitness|running|lifting|\bruns\b|\blifts\b|runningactivity|liftingsession|pace_sec" src/ tests/`
Expected: no live references. Fix stragglers.

- [ ] **Step 9: Full suite + commit**

Run: `npx vitest run` (green) and `npm run typecheck` (clean).
```bash
git add -A
git commit -m "refactor: remove the Fitness domain (running + lifting)"
```

---

## Task 3: Migration, schema bump, load/import tolerance, and final verification

Now `Store` is study-only, so the migration typechecks. This task makes existing v2.0.0 data (with the removed fields still on disk) load cleanly as v3.0.0, and locks the guarantee with a test.

**Files:**
- Modify: `src/domain/types.ts` (SCHEMA_VERSION), `src/core/storage.ts` (migrate + loadStore), `src/core/transfer.ts` (importBundle tolerance), `src/routes/Settings.tsx` (counts copy), `src/routes/Overview.tsx` / `src/shell/AppShell.tsx` (final copy if any cross-domain wording remains).
- Create/Modify tests: `tests/core/storage.test.ts` (migration — create if absent), `tests/core/transfer.test.ts` (old-bundle import).

- [ ] **Step 1: Bump the schema version**

In `src/domain/types.ts`: `export const SCHEMA_VERSION = '3.0.0';`

- [ ] **Step 2: Write the failing migration test**

Create/extend `tests/core/storage.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { loadStore, STORE_KEY } from '@/core/storage';
import { SCHEMA_VERSION } from '@/domain/types';

describe('loadStore — forward migration from v2 (study-only)', () => {
  beforeEach(() => localStorage.clear());

  it('keeps courses and exams, drops runs/lifts/applications, restamps the version', () => {
    const v2 = {
      schema_version: '2.0.0',
      courses: [
        {
          schema_version: '2.0.0', course_id: 'course_1', title: 'C',
          created_at: '2026-07-01T00:00:00Z', source: 'ai_generated',
          sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [] }],
        },
      ],
      exams: [
        { schema_version: '2.0.0', exam_id: 'exam_1', title: 'Mock',
          date: '2026-07-10T00:00:00Z', linked_topic_ids: ['topic_1'], score: 8, max_score: 10 },
      ],
      runs: [{ activity_id: 'activity_1' }],
      lifts: [{ session_id: 'session_1' }],
      applications: [{ application_id: 'application_1' }],
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(v2));

    const store = loadStore();

    expect(store.schema_version).toBe(SCHEMA_VERSION);
    expect(store.courses).toHaveLength(1);
    expect(store.courses[0].course_id).toBe('course_1');
    expect(store.exams).toHaveLength(1);
    expect(store.exams[0].exam_id).toBe('exam_1');
    // No fitness/job domains survive on the returned object.
    expect((store as Record<string, unknown>).runs).toBeUndefined();
    expect((store as Record<string, unknown>).lifts).toBeUndefined();
    expect((store as Record<string, unknown>).applications).toBeUndefined();
  });

  it('returns an empty study-only store when nothing is saved', () => {
    const store = loadStore();
    expect(store).toEqual({ schema_version: SCHEMA_VERSION, courses: [], exams: [] });
  });
});
```

Run: `npx vitest run tests/core/storage.test.ts`
Expected: FAIL — the first test fails because the current `loadStore` throws on the `2.0.0 !== 3.0.0` version mismatch (and/or spreads the extra fields back in).

- [ ] **Step 3: Add `migrate` and rewrite `loadStore` in `src/core/storage.ts`**

Replace the parse/return block (the `try { const parsed … return { ...emptyStore(), ...parsed } }` section) with a migration:

```ts
/**
 * Forward-migrate any saved store to the current study-only shape. Courses and
 * exams are structurally unchanged across versions, so they carry over verbatim;
 * removed domains (runs/lifts/applications) are dropped. Applied for any saved
 * version at or below the current one.
 */
function migrate(parsed: unknown): Store {
  const p = (parsed ?? {}) as Record<string, unknown>;
  return {
    schema_version: SCHEMA_VERSION,
    courses: Array.isArray(p.courses) ? (p.courses as Store['courses']) : [],
    exams: Array.isArray(p.exams) ? (p.exams as Store['exams']) : [],
  };
}
```

and the `loadStore` body after `if (!raw) return emptyStore();` becomes:

```ts
  try {
    const parsed = JSON.parse(raw) as { schema_version?: string };
    // A version NEWER than ours isn't something we can safely down-convert.
    if (parsed.schema_version && parsed.schema_version > SCHEMA_VERSION) {
      throw new StorageError(
        `Your saved data is version ${parsed.schema_version}, but this app expects ${SCHEMA_VERSION}. It hasn't been touched — export it before continuing.`,
      );
    }
    return migrate(parsed);
  } catch (e) {
    if (e instanceof StorageError) throw e;
    throw new StorageError(
      "Your saved data couldn't be read — it may be corrupted. It hasn't been overwritten.",
    );
  }
```

(Keep the `emptyStore` import; drop it only if now unused — `if (!raw) return emptyStore();` still uses it.)

Run: `npx vitest run tests/core/storage.test.ts`
Expected: PASS (both tests).

- [ ] **Step 4: Make `importBundle` tolerant of old bundles**

In `src/core/transfer.ts`, change the version gate so an older bundle is accepted (only a *newer* version is rejected), and import only courses + exams (already the only loops left after Tasks 1–2). Replace the `if (parsed.schema_version !== SCHEMA_VERSION) { … reject … }` block with:

```ts
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
```

`counts` now reports only `{ courses, exams }`.

- [ ] **Step 5: Add an old-bundle import test**

In `tests/core/transfer.test.ts`, add a case: a bundle with `schema_version: '2.0.0'` containing courses + exams **and** stray `runs`/`lifts`/`applications` arrays imports `ok: true` with the courses/exams restored and the fitness/job arrays ignored (no error). Reuse the file's existing bundle-builder helpers; if it round-trips via `exportBundle`, construct the old bundle inline as a JSON string.

Run: `npx vitest run tests/core/transfer.test.ts`
Expected: PASS.

- [ ] **Step 6: Final copy pass**

- `src/routes/Settings.tsx`: export/import summary counts show only courses + exams; remove run/lift/application count lines and any fitness/jobs mention.
- `src/routes/Overview.tsx` and `src/shell/AppShell.tsx`: remove any remaining cross-domain wording (e.g. copy implying fitness/jobs). Keep it study-focused. (Content-only; no behavior change.)

- [ ] **Step 7: Full verification**

Run: `npx vitest run` — all green.
Run: `npm run typecheck` — clean.
Run: `npm run build` — succeeds.
Run: `grep -rniE "fitness|running|lifting|\bruns\b|\blifts\b|\bjob\b|application|stage_history" src/ tests/` — no live references (inspect any incidental word matches).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: study-only migration + schema v3.0.0"
```

---

## Self-Review

**Spec coverage:**
- Remove Fitness + Jobs, keep Study + Exams → Tasks 1 & 2. ✓
- `Store = { schema_version, courses, exams }` → Task 2 Step 2. ✓
- Forward migration preserving courses+exams, dropping runs/lifts/applications, version bump → Task 3 Steps 1–3. ✓
- `importBundle` tolerance for old bundles → Task 3 Steps 4–5. ✓
- Nav = Overview · Study · Exams · Settings; Overview feed session+exam only; "Coming up" removed → Tasks 1 (job section) & 2 (feed kinds) & 3 (copy). ✓
- Full deletion of routes/engine/schemas/types/styles/tests → Tasks 1 & 2 file lists. ✓
- Invariant tests: study data survives migration (Task 3 Step 2); old export imports cleanly (Task 3 Step 5); no dangling domain surface (grep gates Steps 8/8/7); feed study-only (Task 2 Step 7 updates overview.test). ✓

**Placeholder scan:** The LineChart deletion is explicitly conditional on a grep (Task 2 Step 5) — an instruction, not a placeholder. Test-update steps name the specific candidate files and the rule (remove domain-specific assertions only), with typecheck+grep as the completeness gate — appropriate for a removal where the exact per-test edits depend on current test contents.

**Type consistency:** `SchemaName` reduces `course|session|exam|running|lifting|job` → (Task 1) `course|session|exam|running|lifting` → (Task 2) `course|session|exam`. `Store` reduces by `applications` (Task 1) then `runs`/`lifts` (Task 2) to `{ schema_version, courses, exams }`. `migrate` (Task 3) returns exactly that shape. `SCHEMA_VERSION` bumps only in Task 3, after the type is final — so `migrate` typechecks.

**Ordering rationale:** version bump is deferred to Task 3 so existing `2.0.0` data keeps loading through Tasks 1–2 (unchanged version check); the inert extra fields carried by the spread in the interim are cleaned up by `migrate` in Task 3.
