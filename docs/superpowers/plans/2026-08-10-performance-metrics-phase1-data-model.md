# Performance Metrics — Phase 1: Data Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the tutor→tracker assessment fields and the topic dependency field to the domain types — pure type additions, no behaviour — as the foundation for the Performance Health layer.

**Architecture:** Extend `src/domain/types.ts` only. Add five ordinal types and an optional `AssessmentEvidence` block on `ReviewEvent` (mirroring the existing `test?: TestEvidence` precedent), plus an optional `prerequisites?: string[]` on `Topic`. Every addition is optional and additive, so existing data and every existing metric are untouched by construction. No schema, merge, engine, or UI code changes in this phase.

**Tech Stack:** TypeScript 5.6 (strict), Vitest 2.1.4 (jsdom, globals), `@/` → `src/` path alias.

## Global Constraints

- **Read-side-only invariant:** these types exist for a future Performance layer (`src/engine/performance.ts`, Phase 3). Phase 1 adds types ONLY — it must not wire them into `retention`, `k_factor`, `strength`, `health`, `topicLevel`, EXP, mastery, badges, OCI, or projections. (Design 2026-08-10 §A.)
- **Everything optional/additive:** no new required field anywhere; a `ReviewEvent` with no `assessment` and a `Topic` with no `prerequisites` must remain valid. (Design §B, §C; requirement #15.)
- **No manufactured values:** a missing dimension stays `undefined` — never zero-filled or guessed. This is a type-shape rule here (all fields optional) and a derivation rule later.
- **Naming:** storage field names are snake_case (`transfer_level`, `performance_quality`, `predicted_at`); type names are PascalCase (`Difficulty`, `AssessmentEvidence`). Follow `src/domain/types.ts` exactly.
- **Generic, subject-agnostic:** no subject-specific terminology in names or doc comments — especially not "mathematical". The same fields serve history, physics, languages, GCSE/A-level. (Requirement #25.)
- **Do NOT bump `SCHEMA_VERSION`** in this phase. It stays `'3.1.0'`. The `3.1.0 → 3.2.0` bump is tied to the Ajv schema/merge change in Phase 2 (design §C); bumping it now, with no persisted-shape or validation change, would be a lie about the on-disk contract.
- **Red/green gate for type-only changes is `npm run typecheck`.** Vitest (esbuild) strips types without checking them, so a missing type will NOT fail Vitest — it fails `tsc`. Each task runs `npm run typecheck` as the failing-then-passing gate, and Vitest to confirm the runtime assertions hold.
- **Baseline is NOT fully green — do not chase pre-existing failures.** The branch base (`823397d`) carries **18 pre-existing UI-test failures** in exactly three files: `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. These are a property of a mid-refactor base (committed route components lag their committed tests; the reconciling work is stashed), **not** something Phase 1 introduces or fixes. The layer Phase 1 touches — `tests/domain tests/engine tests/core` — is **fully green (240 tests)**. Verify against that subset plus your new tests, and treat `npm test` as a regression check meaning *"still exactly those 3 files failing, nothing new."*

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/domain/types.ts` | The domain type surface — the single source of the storage shape. | Modify: add ordinals + `AssessmentEvidence` + `ReviewEvent.assessment` (Task 1); add `Topic.prerequisites` (Task 2). |
| `tests/domain/assessment-evidence.test.ts` | Pins the assessment block's shape, optionality, backward-compatibility, and ordinal bounds. | Create (Task 1). |
| `tests/domain/prerequisites.test.ts` | Pins the topic dependency field's shape and optionality. | Create (Task 2). |

Both tasks touch only `src/domain/types.ts` plus their own new test file. No other file changes in Phase 1.

---

## Task 1: Assessment evidence types + `ReviewEvent.assessment`

Add the five ordinal types, the `AssessmentEvidence` interface, and an optional `assessment` field on `ReviewEvent`. This is the tutor→tracker per-attempt contract at the type level.

**Files:**
- Modify: `src/domain/types.ts` (add types after the existing `TestEvidence` interface, ~line 30; add `assessment?` to `ReviewEvent`, ~line 32–51)
- Test: `tests/domain/assessment-evidence.test.ts`

**Interfaces:**
- Consumes: existing `ReviewEvent` interface (`src/domain/types.ts:32`).
- Produces:
  - `type Difficulty = 0 | 1 | 2 | 3 | 4 | 5`
  - `type Novelty = 0 | 1 | 2 | 3 | 4`
  - `type Independence = 0 | 1 | 2 | 3`
  - `type TransferLevel = 0 | 1 | 2 | 3`
  - `type PerformanceQuality = 0 | 1 | 2 | 3 | 4 | 5`
  - `interface AssessmentEvidence` with all-optional fields: `difficulty?`, `novelty?`, `independence?`, `transfer_level?`, `performance_quality?`, `quality_rationale?: string`, `cold?: boolean`, `predicted_success?: number`, `predicted_at?: string`, `assessed_by?: string`
  - `ReviewEvent.assessment?: AssessmentEvidence`

- [ ] **Step 1: Write the failing test**

Create `tests/domain/assessment-evidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type {
  AssessmentEvidence,
  Difficulty,
  Independence,
  Novelty,
  PerformanceQuality,
  ReviewEvent,
  TransferLevel,
} from '@/domain/types';

describe('AssessmentEvidence type', () => {
  it('accepts a fully-populated block and round-trips its values', () => {
    const a: AssessmentEvidence = {
      difficulty: 4,
      novelty: 3,
      independence: 3,
      transfer_level: 2,
      performance_quality: 5,
      quality_rationale: 'clear method selection, minor slips',
      cold: true,
      predicted_success: 0.7,
      predicted_at: '2026-08-10T09:00:00.000Z',
      assessed_by: 'tutor:opus',
    };
    expect(a.difficulty).toBe(4);
    expect(a.cold).toBe(true);
    expect(a.predicted_at).toBe('2026-08-10T09:00:00.000Z');
  });

  it('accepts an empty block (every dimension optional — partial applicability)', () => {
    const a: AssessmentEvidence = {};
    expect(a.difficulty).toBeUndefined();
    expect(a.transfer_level).toBeUndefined();
  });

  it('attaches to a ReviewEvent as an optional field', () => {
    const event: ReviewEvent = {
      event_id: 'event_abc123',
      date: '2026-08-10T10:00:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 'session_x',
      confidence_reported: 4,
      assessment: { difficulty: 2, independence: 3 },
    };
    expect(event.assessment?.independence).toBe(3);
  });

  it('a ReviewEvent WITHOUT assessment is still valid (backward compatible)', () => {
    const legacy: ReviewEvent = {
      event_id: 'event_legacy',
      date: '2026-01-01T00:00:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 'session_old',
      confidence_reported: 3,
    };
    expect(legacy.assessment).toBeUndefined();
  });

  it('ordinals reject out-of-range values at compile time', () => {
    // @ts-expect-error 6 is above the Difficulty range (0–5)
    const badDifficulty: Difficulty = 6;
    // @ts-expect-error 5 is above the Novelty range (0–4)
    const badNovelty: Novelty = 5;
    // @ts-expect-error 4 is above the Independence range (0–3)
    const badIndependence: Independence = 4;
    // @ts-expect-error 4 is above the TransferLevel range (0–3)
    const badTransfer: TransferLevel = 4;
    // @ts-expect-error 6 is above the PerformanceQuality range (0–5)
    const badQuality: PerformanceQuality = 6;
    expect([badDifficulty, badNovelty, badIndependence, badTransfer, badQuality]).toHaveLength(5);
  });
});
```

Note on the last test: the values (6, 5, 4, …) are assigned at runtime because esbuild ignores the `@ts-expect-error` directive — the runtime assertion just checks the array length. The real assertion is at compile time: each `@ts-expect-error` MUST suppress a genuine error. If an ordinal were accidentally widened to `number`, the directive becomes unused and `tsc` fails — which is exactly the regression we want to catch.

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `npm run typecheck`
Expected: FAIL — `Module '"@/domain/types"' has no exported member 'AssessmentEvidence'` (and `Difficulty`, `Novelty`, etc.).

- [ ] **Step 3: Add the ordinal types and `AssessmentEvidence` interface**

In `src/domain/types.ts`, immediately after the `TestEvidence` interface (currently ending ~line 30), insert:

```ts
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
```

- [ ] **Step 4: Add the `assessment` field to `ReviewEvent`**

In the `ReviewEvent` interface (`src/domain/types.ts`, currently ~line 32–51), add one field alongside the existing optional `notes?`:

```ts
  /**
   * Tutor-supplied assessment metadata (design 2026-08-10 §B). Optional and
   * additive — historical events have none. Read only by the Performance layer;
   * never feeds retention/health/levels (§A read-side-only invariant).
   */
  assessment?: AssessmentEvidence;
```

- [ ] **Step 5: Run typecheck to verify it passes**

Run: `npm run typecheck`
Expected: PASS (exit 0, no errors).

- [ ] **Step 6: Run the new test and the full suite**

Run: `npx vitest run tests/domain/assessment-evidence.test.ts`
Expected: PASS (5 tests).

Run: `npx vitest run tests/domain tests/engine tests/core`
Expected: PASS — the layer Phase 1 can affect is fully green (240 baseline tests + the 5 new = 245).

Run: `npm test`
Expected: the SAME 3 pre-existing UI files still failing (`app-smoke`, `CourseDashboard`, `TopicDetail`) and nothing new — adding optional fields breaks nothing. Do NOT attempt to fix those 3; they are the mid-refactor baseline (see Global Constraints).

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts tests/domain/assessment-evidence.test.ts
git commit -m "feat(domain): assessment evidence types + ReviewEvent.assessment

Add difficulty/novelty/independence/transfer/quality ordinals and an
optional AssessmentEvidence block on ReviewEvent (mirrors test?). Pure
additive type surface for the Performance layer; no behaviour, no schema
change, SCHEMA_VERSION unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `Topic.prerequisites`

Add an optional topic dependency list to `Topic`, the type-level foundation for the prerequisite-instability diagnostic (Phase 4). Authored by the course layer; assumed a DAG; diagnostic-only.

**Files:**
- Modify: `src/domain/types.ts` (add `prerequisites?` to the `Topic` interface, ~line 64–88)
- Test: `tests/domain/prerequisites.test.ts`

**Interfaces:**
- Consumes: existing `Topic` interface (`src/domain/types.ts:64`).
- Produces: `Topic.prerequisites?: string[]` (topic_ids of upstream dependencies).

- [ ] **Step 1: Write the failing test**

Create `tests/domain/prerequisites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Topic } from '@/domain/types';

function baseTopic(): Topic {
  return {
    topic_id: 'topic_a',
    title: 'A',
    status: 'not_started',
    conf: 1,
    strength: 0,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: null,
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
  };
}

describe('Topic.prerequisites', () => {
  it('accepts an optional list of upstream topic_ids', () => {
    const topic: Topic = { ...baseTopic(), prerequisites: ['topic_b', 'topic_c'] };
    expect(topic.prerequisites).toEqual(['topic_b', 'topic_c']);
  });

  it('is optional — a topic without prerequisites is valid (backward compatible)', () => {
    const topic = baseTopic();
    expect(topic.prerequisites).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `npm run typecheck`
Expected: FAIL — `Object literal may only specify known properties, and 'prerequisites' does not exist in type 'Topic'`.

- [ ] **Step 3: Add the `prerequisites` field to `Topic`**

In the `Topic` interface (`src/domain/types.ts`, ~line 64–88), add one field after `error_log`:

```ts
  /**
   * Upstream topic_ids this topic depends on (design 2026-08-10 §E). Optional;
   * authored by the course layer, assumed a DAG. Diagnostic only — used by the
   * prerequisite-instability check (Phase 4); NEVER overwrites mastery or any
   * stored state.
   */
  prerequisites?: string[];
```

- [ ] **Step 4: Run typecheck to verify it passes**

Run: `npm run typecheck`
Expected: PASS (exit 0).

- [ ] **Step 5: Run the new test and the full suite**

Run: `npx vitest run tests/domain/prerequisites.test.ts`
Expected: PASS (2 tests).

Run: `npx vitest run tests/domain tests/engine tests/core`
Expected: PASS — fully green (now 247 tests with both new files).

Run: `npm test`
Expected: the SAME 3 pre-existing UI files still failing and nothing new (see Global Constraints). Do NOT fix those 3.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts tests/domain/prerequisites.test.ts
git commit -m "feat(domain): optional Topic.prerequisites dependency list

Add an optional topic_id[] declaring upstream dependencies, the type-level
foundation for prerequisite-instability diagnostics (Phase 4). Additive and
optional; diagnostic-only, never overwrites mastery.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (Phase 1 scope — design §F.1: "types (AssessmentEvidence, ordinals, ReviewEvent.assessment, Topic.prerequisites). No behaviour yet."):**
- `AssessmentEvidence` + all five ordinals → Task 1. ✔
- `ReviewEvent.assessment` → Task 1. ✔
- `Topic.prerequisites` → Task 2. ✔
- Partial applicability / all-optional (§B, #16) → Task 1 "empty block" + "backward compatible" tests. ✔
- `predicted_at` foresight field (§B) → present in `AssessmentEvidence`, documented; enforcement is Phase 3. ✔
- Provenance-by-presence + `assessed_by` (§14) → field present; no per-field origin, per design. ✔
- No behaviour, read-side-only, no version bump → Global Constraints + explicit "Do NOT bump SCHEMA_VERSION". ✔
- No subject-specific naming (#25) → doc comments explicitly say "NOT mathematics-specific". ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every step has concrete code or an exact command. ✔

**3. Type consistency:** Field names are identical across the plan and tests: `transfer_level`, `performance_quality`, `quality_rationale`, `predicted_success`, `predicted_at`, `assessed_by`, `difficulty`, `novelty`, `independence`, `cold`. Ordinal type names (`Difficulty`, `Novelty`, `Independence`, `TransferLevel`, `PerformanceQuality`) match between the interface, the `import type` in the test, and the `@ts-expect-error` cases. `ReviewEvent.assessment` and `Topic.prerequisites` names match their tests. ✔

**4. Gate correctness:** Every type-shape step uses `npm run typecheck` as the red/green gate (not Vitest, which can't see type errors), with `npx vitest run` + `npm test` confirming runtime assertions and no regressions. ✔
