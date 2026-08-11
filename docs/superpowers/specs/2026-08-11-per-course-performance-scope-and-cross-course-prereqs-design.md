# Per-course Performance scope selector + cross-course prerequisites

**Date:** 2026-08-11
**Status:** Design approved, pending spec review
**Base:** `main` @ `83a73f8` (schema 3.2.0)

## Problem

Two related gaps in the just-landed Performance layer and course-construction flow:

1. **`Performance.tsx` renders one global aggregate across all courses.** A single
   Performance-Health number spanning three unrelated subjects is not
   decision-useful. The engine already scopes per course
   (`courseReviewEvents` in `performance-view.ts`), but the UI never exposes it.

2. **Course construction cannot express cross-course prerequisites.** The course
   prompt (`prompts.ts:50`) restricts prerequisites to "topic_id values FROM THIS
   COURSE," and `COURSE_PROMPT` is a static template that never sees the other
   courses' topic IDs. So a new course can never declare that it builds on
   material already tracked — even though the engine and validation already
   support it.

These are linked: scoping the Performance page to one course (Part A) makes the
"Upstream instability" section point at that course's struggling topics, whose
shaky prerequisites may legitimately live in *another* course — which is only
meaningful if cross-course prerequisites can actually be created (Part B).

## What already works (no change needed)

- **Engine resolves prerequisites store-wide.** `upstreamPrerequisites`
  (`prerequisites.ts:26`) builds its lookup from `allTopics(store)` — every
  course — and **skips unresolvable IDs** (`prerequisites.ts:39`). Cross-course
  prerequisite chains already resolve at runtime.
- **Validation accepts any well-formed topic ID.** `schemas.ts:140` checks only
  that each prerequisite matches `ID_PATTERN('topic')`; it does not require
  same-course membership. Foreign IDs already pass validation.
- **Per-course event scoping exists.** `courseReviewEvents(store, courseId)`
  (`performance-view.ts:35`) already flattens one course's review history.

The only real blocker for cross-course prerequisites is the **prompt text** and
the fact that it is delivered without store context.

## Part A — Per-course Performance scope selector

### Control

A `SegmentedControl` (`src/components/controls.tsx`) at the top of
`Performance.tsx`:

```
All · <Course A title> · <Course B title> · …
```

- One segment per course in `store.courses`, plus a leading **All** segment.
- Default selection: **All** (preserves today's behavior).
- Lists **all** courses. A course with no assessment data is still shown; it
  renders the scoped empty message (below) rather than being hidden — honest and
  predictable.

### Scoping

A single `scope` state: `'all' | <courseId>`. The event array is chosen at the
source, and every downstream metric flows from it:

- `scope === 'all'` → `allReviewEvents(store)`
- `scope === <courseId>` → `courseReviewEvents(store, courseId)`

The six headline cards, `performanceByDifficulty`, and `performanceByNovelty` all
consume that one array, so they scope with a single swap. **No engine change.**

### Upstream instability (Option B — scope to the selected course)

Extend `unstablePrerequisites` with an optional course filter:

```ts
unstablePrerequisites(store: Store, now?: Date, courseId?: string): UnstableUpstream[]
```

- When `courseId` is provided, only *struggling downstream topics belonging to
  that course* are considered.
- The upstream walk stays **store-wide** (it already is), so a topic in one
  course can still point at a shaky prerequisite in another course.
- Remains strictly **read-only** over the store (Performance read-side-only
  invariant, `tests/engine/read-side-only.test.ts`).

`Performance.tsx` passes the current scope's `courseId` (or omits it for `all`).

### Empty states

- **No assessments anywhere** (across all courses): the existing global empty
  state renders, with **no selector** — there is nothing to compare.
- **Data exists somewhere, but the selected course has none:** the selector stays
  visible and the metrics area shows a scoped message, e.g.
  *"No performance data for this course yet."* The user can switch back to All or
  another course.

## Part B — Cross-course prerequisites at course construction

### Convert the static template to a function

`COURSE_PROMPT` (a static `export const`) becomes `coursePrompt(store: Store):
string`, matching the existing `examPrompt(store)` / `coldAssessmentPrompt(store)`
pattern. Two text changes:

1. **Relax the same-course restriction** (`prompts.ts:50`). Prerequisites may
   reference topics defined **in this course** *or* any existing topic already in
   the tracker (by ID). The syllabus-driven guidance is preserved: only record a
   dependency where the syllabus implies one ("B builds on A"); this now includes
   a syllabus that builds on material from an already-tracked course.

2. **Inject the existing topic list.** Append an `id → title (course)` listing of
   `allTopics(store)`, exactly as `examPrompt` does, so the AI has real IDs to
   reference. When no other courses exist, the list is empty and the prompt
   behaves identically to today — the mechanism functions the same regardless of
   how many courses are present.

The AI still generates fresh `topic_` IDs for the new course's own topics; the
injected list is only the pool of *existing* IDs it may cite as upstream.

### Consumer + test updates

- `AddCourse.tsx` calls `coursePrompt(store)` (`store` is already a prop) instead
  of importing the static `COURSE_PROMPT`.
- Update `tests/domain/prompts.test.ts` — the seam test pinning prompt↔schema
  lockstep — for the new function signature and the relaxed prerequisite wording.
- No schema or engine change: both already accept cross-course prerequisite IDs.

## Non-goals

- Per-section / per-topic Performance scoping (deferred; engine helper is a
  trivial future add).
- Trend charts (7/30/lifetime) — separate deferred UI item.
- Any change to the calibration predict-first flow (deliberate product decision,
  out of scope).
- Backfilling prerequisites on existing courses — this affects newly constructed
  courses only.

## Verification targets

- `npm run typecheck` green.
- `npm test` green, with no regression to the Performance read-side-only
  invariant, `tests/routes/Performance.test.tsx`, `tests/domain/prompts.test.ts`,
  or `tests/shell/AppShell.test.tsx`.
- New coverage: scope selector switches the rendered metrics between All and a
  specific course; `unstablePrerequisites` course filter narrows downstream
  topics while keeping cross-course upstream; `coursePrompt` includes existing
  topic IDs and permits cross-course prerequisite references.
