# Strip to Study-Only — Design

**Date:** 2026-07-24
**Branch:** `strip-to-study-only`
**Status:** approved for planning

## Problem

The tracker spans four domains — Study, Exams, Fitness (running + lifting), and
Jobs. The owner wants it **solely study-oriented**: keep Study and Exams, remove
Fitness and Jobs entirely (type system, schema, routes, engine, shell nav,
ingestion prompts, styles, tests).

The hard constraint: the store validates strictly (`additionalProperties: false`)
and `loadStore` rejects any store whose `schema_version` differs from the app's.
Existing saved data contains `runs`, `lifts`, and `applications`. A naive removal
would make the app **fail to load existing data — including courses and exam
history** — until storage is cleared. Preserving study data through the change is
a first-class requirement.

## End state

```ts
interface Store {
  schema_version: string;
  courses: Course[];
  exams: Exam[];
}
```

- Domains: **Study** (courses → sections → topics) and **Exams**.
- Nav: Overview · Study · Exams · Settings. No Fitness or Jobs tab.
- Overview is the study landing: due queue, EXP/retrievable, work logged, study
  streak, weekly volume, mastery, and an activity feed of **sessions + exams
  only**. The "Coming up" job-deadline section is removed.
- Fitness and Jobs are deleted from the type system, JSON schemas, routes,
  engine, shell, prompts, and styles — not hidden behind a flag.

## Migration (load-bearing)

Bump `SCHEMA_VERSION` from `2.0.0` to `3.0.0` (removing domains is a breaking
schema change).

**`loadStore` gains a forward-migration** instead of a hard version gate. A
`migrate(parsed)` step projects any saved store to study-only:

```ts
function migrate(parsed: unknown): Store {
  const p = (parsed ?? {}) as Partial<Store> & Record<string, unknown>;
  return {
    schema_version: SCHEMA_VERSION,
    courses: Array.isArray(p.courses) ? (p.courses as Course[]) : [],
    exams: Array.isArray(p.exams) ? (p.exams as Exam[]) : [],
  };
}
```

Courses and exams are structurally identical between v2.0.0 and v3.0.0, so this
is a safe forward-migration: it keeps them verbatim and drops
`runs`/`lifts`/`applications`. It applies for any saved `schema_version` **at or
below** the current one (older or equal). A version **newer** than the current
one still surfaces the existing version guard ("export before continuing") rather
than being silently downgraded — we never drop fields we don't understand. A
genuinely unreadable blob (non-object, unparseable) still surfaces the existing
"couldn't be read" error. `{ ...emptyStore(), ...parsed }` is replaced by
`migrate(parsed)` so removed fields cannot spread back in.

**`importBundle` gets the same tolerance:** accept a bundle whose
`schema_version` is `3.0.0` *or an older known version*, import only `courses`
and `exams` (validated as today), and silently drop any `runs`/`lifts`/
`applications` arrays. The run/lift/application import loops and their `counts`
entries are removed. Export writes the study-only store.

## Removal inventory

**Delete outright:**
- `src/routes/Fitness.tsx`, `src/routes/AddFitness.tsx`
- `src/routes/Jobs.tsx`, `src/routes/AddJob.tsx`
- `src/engine/fitness.ts`, `src/engine/jobs.ts`
- `src/styles/jobs.css`
- `src/components/LineChart.tsx` — **only if** nothing outside Fitness uses it
  (verify during implementation; otherwise keep).
- Tests: `tests/engine/fitness.test.ts`, `tests/engine/jobs.test.ts`,
  `tests/engine/overview-jobs.test.ts`.

**Prune fitness/job references from shared files:**
- `src/domain/types.ts` — remove `RunningActivity`, `LiftingSession`, `LiftSet`,
  `JobApplication`, `JobStage`, `StageEvent`, `JobContact`, `currentStage`, the
  fitness/job ingestion types, the `Store` fields, and their use in `emptyStore`
  / `allTopics` (unaffected) — leave Study/Exam types intact.
- `src/domain/schemas.ts` — drop `running`, `lifting`, `job` from `SchemaName`
  and the schema registry; remove those properties from the store schema.
- `src/domain/prompts.ts` — remove running/lifting/job prompt builders.
- `src/core/merge.ts`, `detect.ts`, `integrity.ts`, `pipeline.ts` — remove the
  running/lifting/job ingestion cases, detection heuristics, integrity checks,
  and `COMMIT_VERB` entries.
- `src/hooks/useStore.ts` — remove `moveStage`, `editApplication`,
  `archiveApplication`; keep the study/exam commit + undo + status + quick-review
  + error-toggle + import/clear surface.
- `src/engine/overview.ts` — `activityFeed` emits only session + exam items;
  remove run/lift/job feed kinds and the job `upcomingActions`/funnel usage.
- `src/routes/Overview.tsx` — remove the "Coming up" job section and any
  run/lift/job feed icons; keep hero, due queue, EXP, work logged, streak,
  volume, mastery, recent activity.
- `src/routes/QuickAdd.tsx` — remove add-run/add-lift/add-job entries; likewise
  any command-palette corpus entries for them.
- `src/shell/AppShell.tsx` + `src/shell/icons.tsx` — remove the Fitness and Jobs
  nav items, their active-state mapping, and now-unused icons.
- `src/router.ts` + `src/App.tsx` — remove `fitness`, `add-run`, `add-lift`,
  `jobs`, `add-job` routes and their render cases.
- `src/engine/palette.ts` — remove fitness/job domain colors if domain-keyed.
- `src/routes/Settings.tsx` — drop run/lift/application export/import counts.
- `src/main.tsx` — remove any fitness/job wiring.

## Execution shape

Unlike an additive feature, removing a `Store` field breaks every consumer at
once, so the work cannot be tiny independent TDD tasks — each committed state
must still typecheck and pass tests. It groups into a handful of coherent,
build-green, independently-reviewable commits:

1. **Migration + schema bump + load/import tolerance.** Bump `SCHEMA_VERSION`,
   add `migrate`, relax `loadStore` and `importBundle`. Add the migration test.
   (Store still has the fields at this point; this step is purely additive
   tolerance so nothing breaks yet.)
2. **Remove Jobs end-to-end.** Delete job routes/engine/styles/tests; prune job
   references from types, schemas, prompts, core, useStore, overview, shell,
   router, App, QuickAdd, Settings. Build green, no Jobs anywhere.
3. **Remove Fitness end-to-end.** Same, for running + lifting, including the
   `Store.runs`/`Store.lifts` fields, `LineChart` (if unused), and the feed
   kinds.
4. **Simplify Overview / shell / QuickAdd** to the final study-only shape and
   copy; confirm nav is Overview · Study · Exams · Settings.
5. **Prune/adjust remaining tests + full verification.** Delete dead tests,
   update `overview.test.ts`, `transfer.test.ts`, `pipeline.test.ts`,
   `detect.test.ts`, `app-smoke.test.tsx`, `AppShell.test.tsx`. Full suite +
   typecheck + build green.

## Invariants (encoded as tests)

1. **Study data survives migration.** A v2.0.0 store JSON containing courses,
   exams, `runs`, `lifts`, and `applications` loads (via the migrated
   `loadStore` path) as a v3.0.0 store with the same courses and exams and no
   other domains. Courses/topics/review history are byte-identical.
2. **Old exports import cleanly.** A v2.0.0 export bundle imports to a study-only
   store: courses + exams restored, fitness/job arrays dropped, no error.
3. **Round-trip holds for the reduced store.** export → import into empty →
   identical study-only state.
4. **No dangling domain surface.** `SchemaName` has no `running`/`lifting`/`job`;
   the router has no fitness/job routes; `Store` has only `courses`/`exams`.
5. **Overview feed is study-only.** `activityFeed` emits only `session` and
   `exam` kinds.

## Out of scope

- Any change to Study or Exams behavior (including the in-progress Exams WIP,
  which is untouched — Exams stays).
- Re-styling the study surfaces beyond removing dead fitness/job CSS.
- Data export format changes beyond dropping the removed arrays.
