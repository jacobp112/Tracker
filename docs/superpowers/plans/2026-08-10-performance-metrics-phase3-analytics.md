# Performance Metrics — Phase 3: Analytics Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement this plan task-by-task — a fresh subagent per task with review between. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive the Performance-layer metrics — Independent Performance, Transfer Ability, Cold Performance, performance-by-difficulty/novelty, calibration error, and Performance Health — live from the assessment blocks now carried on events, with transparent weights, min-data guards, and graceful degradation.

**Architecture:** One new pure module, `src/engine/performance.ts`, computing over `ReviewEvent[]` (so the same functions serve per-topic and global aggregation; the Phase 5 dashboard flattens the store into event arrays). A new additive `CONFIG.PERFORMANCE` block holds every threshold and weight. Nothing existing is modified except `constants.ts` (additive). The read-side-only invariant holds by construction: this module only *reads* events.

**Tech Stack:** TypeScript 5.6 (strict), Vitest 2.1.4. No new dependencies.

## Global Constraints

Every task inherits these. The first three are the invariants that regress silently — each is restated in the task that owns it and pinned by a named test.

- **INVARIANT — strict independence (`=== 3`, never `>= 2`).** "Independent" means `assessment.independence === 3` only. `2` is "lightly assisted" and MUST NOT count as independent. This is the conflation design §10 exists to prevent, and it is a one-character regression (`>=` vs `===`) that typechecks and passes shallow tests. Owned by Tasks 2 and 5; each has a named `independence: 2` exclusion test.
- **INVARIANT — calibration foresight rule.** An attempt counts toward calibration ONLY when `assessment.predicted_success` is present AND `assessment.predicted_at` is present AND `predicted_at` is **strictly before** `event.date`. Absent `predicted_at`, or `predicted_at >= event.date`, → excluded as hindsight. Do not infer foresight from the field merely existing — the math produces a plausible number either way, so hindsight creeping back in is the hardest regression to notice. Owned by Task 6; named tests for after / equal / absent / before.
- **INVARIANT — accuracy is NOT gated on a difficulty floor (deliberate).** In Performance Health, the independent-accuracy component banks its weight regardless of task difficulty; difficulty/novelty gate only the *top end*. A learner drilling easy-but-independent work reads as "solid but untested" (modest score), not zero. This is a chosen behaviour (design §D), not an oversight — do not "fix" it by multiplying accuracy by difficulty. Owned by Task 7; named test asserts the exact modest score.
- **Read-side-only (design §A).** `performance.ts` only reads events. It must not import from or mutate `recalculate.ts`, `retention.ts`, `metrics.ts`, `leveling.ts`, or any store-writing path, and nothing here may feed `health`, `topicLevel`, EXP, mastery, OCI, etc. Keep `overconfidenceIndex` untouched — calibration error is a *separate* concept (design §D).
- **Graceful degradation, never zero-fill (design §B, §D).** A missing dimension drops out of a composite and the remaining weights **re-normalise**; it never becomes an implicit `0`. Below a metric's min-data threshold the metric returns `null` (→ UI "—"), never an inflated number.
- **No manufactured values.** `observedSuccess` returns `undefined` when neither a test score nor a quality score exists — never a default. `observedSuccess` prefers `test.actual_retention`, then `performance_quality / 5` (the documented commensurability approximation, design §D), then `undefined`.
- **All tunables are named `CONFIG.PERFORMANCE` constants.** No inline magic numbers (mirrors the existing constant discipline). Weight tables get a sum-to-1 check like the existing `W_*` check.
- **Baseline is NOT fully green.** The branch carries 18 pre-existing UI failures in `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. Verify against `npm run typecheck` + `tests/engine tests/domain tests/core` (green) and treat `npm test` as "still exactly those 3 files failing, nothing new."
- **Naming:** subject-agnostic; snake_case for stored field reads (`transfer_level`, `predicted_at`), camelCase for derived TS.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/config/constants.ts` | Tunables. | Modify: add `CONFIG.PERFORMANCE` (thresholds + weight tables) + two sum-to-1 checks (Task 1). |
| `src/engine/performance.ts` | All Performance-layer derivations, pure over `ReviewEvent[]`. | Create (Tasks 1–7, additively). |
| `tests/engine/assessment-fixtures.ts` | Shared `makeEvent()` factory for building assessed events in tests. | Create (Task 1). |
| `tests/engine/performance-helpers.test.ts` | `observedSuccess`, `independenceTier`, `weightedComposite`. | Create (Task 1). |
| `tests/engine/independent-performance.test.ts` | Independent Performance + strict-tier invariant. | Create (Task 2). |
| `tests/engine/transfer-ability.test.ts` | Transfer Ability + min-data guard. | Create (Task 3). |
| `tests/engine/cold-performance.test.ts` | Cold Performance + re-normalisation + cold-only. | Create (Task 4). |
| `tests/engine/performance-by-dimension.test.ts` | perf-by-difficulty / -by-novelty + strict-tier invariant. | Create (Task 5). |
| `tests/engine/calibration.test.ts` | calibrationError + foresight invariant. | Create (Task 6). |
| `tests/engine/performance-health.test.ts` | Performance Health + no-difficulty-floor + success-gating. | Create (Task 7). |

Existing files untouched beyond `constants.ts`.

---

## Task 1: `CONFIG.PERFORMANCE` + shared helpers + test fixture

The foundation every later task consumes. Thresholds, weight tables (with sum checks), and the four primitives: `observedSuccess`, `isIndependent`, `independenceTier`, `mean`, `weightedComposite`.

**Files:**
- Modify: `src/config/constants.ts` (add `PERFORMANCE` block before the closing `} as const;` ~line 131; add sum checks after the existing `WEIGHT_SUM` check ~line 138)
- Create: `src/engine/performance.ts`
- Create: `tests/engine/assessment-fixtures.ts`
- Test: `tests/engine/performance-helpers.test.ts`

**Interfaces:**
- Consumes: `CONFIG` (`@/config/constants`), `ReviewEvent`, `AssessmentEvidence` (`@/domain/types`).
- Produces:
  - `CONFIG.PERFORMANCE.{ MIN_INDEPENDENT_N, MIN_TRANSFER_N, MIN_COLD_N, MIN_CALIBRATION_N, MIN_HEALTH_INPUTS, DIFFICULTY_MAX, NOVELTY_MAX, INDEPENDENCE_MAX, TRANSFER_MAX, QUALITY_MAX, HEALTH_WEIGHTS, COLD_WEIGHTS }`
  - `observedSuccess(e: ReviewEvent): number | undefined`
  - `isIndependent(e: ReviewEvent): boolean`
  - `type IndependenceTier = 'independent' | 'lightly_assisted' | 'assisted'`
  - `independenceTier(e: ReviewEvent): IndependenceTier | undefined`
  - `mean(xs: number[]): number | null`
  - `weightedComposite(parts: Array<{ weight: number; score: number | null }>): number | null`
  - `makeEvent(assessment, opts?)` test factory.

- [ ] **Step 1: Add the `CONFIG.PERFORMANCE` block and sum checks**

In `src/config/constants.ts`, before the closing `} as const;`, add:

```ts
  /**
   * Performance layer (engine/performance.ts) — all derived, never stored
   * (design 2026-08-10). Weights are the semantic knobs; thresholds are the
   * min-data guards below which a metric returns null rather than a number.
   */
  PERFORMANCE: {
    /** Min qualifying attempts before a headline metric shows a number. */
    MIN_INDEPENDENT_N: 5,
    MIN_TRANSFER_N: 5,
    MIN_COLD_N: 5,
    MIN_CALIBRATION_N: 5,
    /** Min distinct sub-scores present before Performance Health is defined. */
    MIN_HEALTH_INPUTS: 2,
    /** Ordinal maxima, for normalising each dimension to 0–1. */
    DIFFICULTY_MAX: 5,
    NOVELTY_MAX: 4,
    INDEPENDENCE_MAX: 3,
    TRANSFER_MAX: 3,
    QUALITY_MAX: 5,
    /** Performance Health composite weights (design §D, user-approved). */
    HEALTH_WEIGHTS: {
      accuracy: 0.3,
      difficulty: 0.2,
      novelty: 0.15,
      transfer: 0.2,
      quality: 0.15,
    },
    /** Cold Performance composite weights (proposed; tunable). Plain weighted
     *  average of present dimensions of cold attempts (design §D). */
    COLD_WEIGHTS: {
      correctness: 0.3,
      difficulty: 0.15,
      novelty: 0.15,
      independence: 0.15,
      transfer: 0.15,
      quality: 0.1,
    },
  },
```

After the existing `WEIGHT_SUM` check, add:

```ts
/** Performance-layer weight tables must each sum to 1 (0–100 composites). */
for (const [name, table] of [
  ['HEALTH_WEIGHTS', CONFIG.PERFORMANCE.HEALTH_WEIGHTS],
  ['COLD_WEIGHTS', CONFIG.PERFORMANCE.COLD_WEIGHTS],
] as const) {
  const sum = Object.values(table).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`CONFIG.PERFORMANCE.${name} must sum to 1, got ${sum}`);
  }
}
```

- [ ] **Step 2: Write the failing test + fixture**

Create `tests/engine/assessment-fixtures.ts`:

```ts
import type { AssessmentEvidence, ReviewEvent } from '@/domain/types';

let seq = 0;

/**
 * Build an assessed ReviewEvent for Performance-layer tests. `opts.test` adds a
 * test block (so observedSuccess reads actual_retention); otherwise the event is
 * a study_review (observedSuccess falls back to performance_quality/5).
 */
export function makeEvent(
  assessment: AssessmentEvidence | undefined,
  opts: { date?: string; test?: { score: number; out_of: number } } = {},
): ReviewEvent {
  seq += 1;
  return {
    event_id: `event_${seq}`,
    date: opts.date ?? '2026-08-10T00:00:00.000Z',
    kind: opts.test ? (opts.test.score >= 0.8 * opts.test.out_of ? 'test_pass' : 'test_fail') : 'study_review',
    source: opts.test ? 'exam' : 'session',
    source_id: `src_${seq}`,
    confidence_reported: 3,
    ...(opts.test ? { test: { ...opts.test, actual_retention: opts.test.score / opts.test.out_of } } : {}),
    ...(assessment ? { assessment } : {}),
  };
}
```

Create `tests/engine/performance-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { observedSuccess, isIndependent, independenceTier, mean, weightedComposite } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('observedSuccess — commensurability fallback (design §D)', () => {
  it('prefers a test score (actual_retention)', () => {
    expect(observedSuccess(makeEvent({ performance_quality: 2 }, { test: { score: 9, out_of: 10 } }))).toBe(0.9);
  });
  it('falls back to performance_quality / 5 when there is no test', () => {
    expect(observedSuccess(makeEvent({ performance_quality: 4 }))).toBe(0.8);
  });
  it('is undefined when neither a test nor quality exists (never fabricated)', () => {
    expect(observedSuccess(makeEvent({ difficulty: 3 }))).toBeUndefined();
  });
});

describe('independence tiers — strict boundary', () => {
  it('independence 3 is independent', () => {
    expect(isIndependent(makeEvent({ independence: 3 }))).toBe(true);
    expect(independenceTier(makeEvent({ independence: 3 }))).toBe('independent');
  });
  it('independence 2 is lightly_assisted, NOT independent', () => {
    expect(isIndependent(makeEvent({ independence: 2 }))).toBe(false);
    expect(independenceTier(makeEvent({ independence: 2 }))).toBe('lightly_assisted');
  });
  it('independence 0–1 is assisted', () => {
    expect(independenceTier(makeEvent({ independence: 1 }))).toBe('assisted');
    expect(independenceTier(makeEvent({ independence: 0 }))).toBe('assisted');
  });
  it('no independence value → undefined tier', () => {
    expect(independenceTier(makeEvent({ difficulty: 2 }))).toBeUndefined();
  });
});

describe('mean / weightedComposite', () => {
  it('mean is null for an empty set (no false zero)', () => {
    expect(mean([])).toBeNull();
    expect(mean([0.2, 0.4])).toBeCloseTo(0.3);
  });
  it('weightedComposite re-normalises over present (non-null) parts', () => {
    // Only accuracy present → returns accuracy regardless of the other weights.
    expect(weightedComposite([
      { weight: 0.3, score: 0.9 },
      { weight: 0.7, score: null },
    ])).toBeCloseTo(0.9);
  });
  it('weightedComposite is null when no part has a score', () => {
    expect(weightedComposite([{ weight: 0.3, score: null }])).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/engine/performance-helpers.test.ts`
Expected: FAIL — `@/engine/performance` does not exist / exports missing.

- [ ] **Step 4: Create `performance.ts` with the helpers**

Create `src/engine/performance.ts`:

```ts
import { CONFIG } from '@/config/constants';
import type { ReviewEvent } from '@/domain/types';

/**
 * Performance layer — design 2026-08-10 §D. Pure, read-only over ReviewEvent[].
 * Nothing here feeds retention/health/levels (§A read-side-only invariant).
 */

const P = CONFIG.PERFORMANCE;

/** Realised success in [0,1]: test score first, else quality/5, else undefined.
 *  Never fabricated (design §D commensurability decision). */
export function observedSuccess(e: ReviewEvent): number | undefined {
  if (e.test) return e.test.actual_retention;
  const q = e.assessment?.performance_quality;
  return q === undefined ? undefined : q / P.QUALITY_MAX;
}

/** Independent === 3 ONLY (design §10). A minor prompt (2) is still assistance. */
export function isIndependent(e: ReviewEvent): boolean {
  return e.assessment?.independence === 3;
}

export type IndependenceTier = 'independent' | 'lightly_assisted' | 'assisted';

export function independenceTier(e: ReviewEvent): IndependenceTier | undefined {
  const i = e.assessment?.independence;
  if (i === undefined) return undefined;
  if (i === 3) return 'independent';
  if (i === 2) return 'lightly_assisted';
  return 'assisted'; // 0 | 1
}

/** Arithmetic mean, or null for an empty set (never a false zero). */
export function mean(xs: number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Weighted composite over parts, re-normalising to the weights of the parts that
 * actually have a score. A null score drops out (never treated as 0). Returns
 * null when no part has a score (graceful degradation, design §D).
 */
export function weightedComposite(parts: Array<{ weight: number; score: number | null }>): number | null {
  const present = parts.filter((p): p is { weight: number; score: number } => p.score !== null);
  if (present.length === 0) return null;
  const wsum = present.reduce((a, p) => a + p.weight, 0);
  if (wsum === 0) return null;
  return present.reduce((a, p) => a + p.weight * p.score, 0) / wsum;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/engine/performance-helpers.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: GREEN.

- [ ] **Step 6: Commit**

```bash
git add src/config/constants.ts src/engine/performance.ts tests/engine/assessment-fixtures.ts tests/engine/performance-helpers.test.ts
git commit -m "feat(performance): CONFIG.PERFORMANCE + shared helpers

observedSuccess (test→quality/5→undefined), strict independence tiers
(===3 only), mean, and re-normalising weightedComposite. Weight tables
sum-checked. Read-only foundation for the Performance layer.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Independent Performance (strict tier)

Break performance into independent / lightly-assisted / assisted tiers so assisted success is never mistaken for autonomous mastery.

**⚠ INVARIANT (Global Constraints #1):** the `independent` tier is `independence === 3` ONLY. An `independence: 2` attempt belongs in `lightlyAssisted` — never `independent`. Named test below.

**Files:**
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/independent-performance.test.ts`

**Interfaces:**
- Consumes: `observedSuccess`, `independenceTier`, `mean` (Task 1); `CONFIG.PERFORMANCE.MIN_INDEPENDENT_N`.
- Produces:
  - `interface TierStats { n: number; accuracy: number | null; avgDifficulty: number | null; avgNovelty: number | null; }`
  - `interface IndependentPerformance { independent: TierStats; lightlyAssisted: TierStats; assisted: TierStats; sufficient: boolean; }`
  - `independentPerformance(events: ReviewEvent[]): IndependentPerformance | null` (null iff no attempt carries an `independence` value).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/independent-performance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { independentPerformance } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('independentPerformance — strict tiering', () => {
  it('an independence-2 attempt lands in lightlyAssisted, NOT independent', () => {
    const r = independentPerformance([makeEvent({ independence: 2 }, { test: { score: 10, out_of: 10 } })])!;
    expect(r.independent.n).toBe(0);
    expect(r.lightlyAssisted.n).toBe(1);
  });

  it('an independence-3 attempt lands in independent', () => {
    const r = independentPerformance([makeEvent({ independence: 3 }, { test: { score: 8, out_of: 10 } })])!;
    expect(r.independent.n).toBe(1);
    expect(r.independent.accuracy).toBeCloseTo(0.8);
  });

  it('reports difficulty/novelty of the independent tier separately from assisted', () => {
    const r = independentPerformance([
      makeEvent({ independence: 3, difficulty: 4, novelty: 3 }, { test: { score: 8, out_of: 10 } }),
      makeEvent({ independence: 0, difficulty: 1 }, { test: { score: 10, out_of: 10 } }),
    ])!;
    expect(r.independent.avgDifficulty).toBeCloseTo(4);
    expect(r.independent.avgNovelty).toBeCloseTo(3);
    expect(r.assisted.n).toBe(1);
    expect(r.assisted.accuracy).toBeCloseTo(1);
  });

  it('sufficient is false below MIN_INDEPENDENT_N independent attempts', () => {
    const few = [makeEvent({ independence: 3 }, { test: { score: 8, out_of: 10 } })];
    expect(independentPerformance(few)!.sufficient).toBe(false);
  });

  it('returns null when no attempt carries an independence value', () => {
    expect(independentPerformance([makeEvent({ difficulty: 3 })])).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/independent-performance.test.ts`
Expected: FAIL — `independentPerformance` not exported.

- [ ] **Step 3: Implement**

Append to `src/engine/performance.ts`:

```ts
export interface TierStats {
  n: number;
  accuracy: number | null;
  avgDifficulty: number | null;
  avgNovelty: number | null;
}

export interface IndependentPerformance {
  independent: TierStats;
  lightlyAssisted: TierStats;
  assisted: TierStats;
  /** independent.n >= MIN_INDEPENDENT_N — is the headline safe to present? */
  sufficient: boolean;
}

function tierStats(events: ReviewEvent[]): TierStats {
  const outcomes = events.map(observedSuccess).filter((x): x is number => x !== undefined);
  const diffs = events
    .map((e) => e.assessment?.difficulty)
    .filter((x): x is number => x !== undefined);
  const novs = events
    .map((e) => e.assessment?.novelty)
    .filter((x): x is number => x !== undefined);
  return {
    n: events.length,
    accuracy: mean(outcomes),
    avgDifficulty: mean(diffs),
    avgNovelty: mean(novs),
  };
}

/** Independent / lightly-assisted / assisted breakdown (design §10). Null when no
 *  attempt carries an independence value — nothing to say. */
export function independentPerformance(events: ReviewEvent[]): IndependentPerformance | null {
  const tiered = { independent: [] as ReviewEvent[], lightly_assisted: [] as ReviewEvent[], assisted: [] as ReviewEvent[] };
  let any = false;
  for (const e of events) {
    const t = independenceTier(e);
    if (t === undefined) continue;
    any = true;
    tiered[t].push(e);
  }
  if (!any) return null;
  return {
    independent: tierStats(tiered.independent),
    lightlyAssisted: tierStats(tiered.lightly_assisted),
    assisted: tierStats(tiered.assisted),
    sufficient: tiered.independent.length >= P.MIN_INDEPENDENT_N,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/independent-performance.test.ts`
Expected: PASS. Then `npm run typecheck` — GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance.ts tests/engine/independent-performance.test.ts
git commit -m "feat(performance): Independent Performance (strict === 3 tiers)

independent tier is independence===3 ONLY; 2 is lightly_assisted, 0-1
assisted. Reports per-tier accuracy + difficulty/novelty; sufficient flag
guards the headline below MIN_INDEPENDENT_N. Assisted success never merged
into the independent number.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Transfer Ability

Aggregate `transfer_level` with a min-data guard and a simple recent-vs-earlier trend.

**Files:**
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/transfer-ability.test.ts`

**Interfaces:**
- Consumes: `mean` (Task 1); `CONFIG.PERFORMANCE.{ MIN_TRANSFER_N, TRANSFER_MAX }`.
- Produces:
  - `interface TransferAbility { score: number; n: number; trend: number | null; }` (`score` 0–100)
  - `transferAbility(events: ReviewEvent[]): TransferAbility | null` (null below `MIN_TRANSFER_N` observations).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/transfer-ability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { transferAbility } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

const withTransfer = (level: number, date?: string) => makeEvent({ transfer_level: level }, { date });

describe('transferAbility', () => {
  it('returns null below MIN_TRANSFER_N observations (no score on 1–2 obs)', () => {
    expect(transferAbility([withTransfer(3), withTransfer(3)])).toBeNull();
  });

  it('scores mean transfer_level on a 0–100 scale once enough data exists', () => {
    const r = transferAbility(Array.from({ length: 5 }, () => withTransfer(3)))!; // 3/3 → 100
    expect(r.n).toBe(5);
    expect(r.score).toBeCloseTo(100);
  });

  it('ignores events with no transfer_level', () => {
    const events = [...Array.from({ length: 5 }, () => withTransfer(3)), makeEvent({ difficulty: 2 })];
    expect(transferAbility(events)!.n).toBe(5);
  });

  it('trend is later-half minus earlier-half (improving → positive)', () => {
    const events = [
      withTransfer(0, '2026-08-01T00:00:00.000Z'),
      withTransfer(0, '2026-08-02T00:00:00.000Z'),
      withTransfer(3, '2026-08-03T00:00:00.000Z'),
      withTransfer(3, '2026-08-04T00:00:00.000Z'),
      withTransfer(3, '2026-08-05T00:00:00.000Z'),
      withTransfer(3, '2026-08-06T00:00:00.000Z'),
    ];
    expect(transferAbility(events)!.trend!).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/engine/transfer-ability.test.ts` → FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `src/engine/performance.ts`:

```ts
export interface TransferAbility {
  score: number; // 0–100
  n: number;
  trend: number | null; // later-half minus earlier-half, in score points
}

/** Mean transfer_level → 0–100, with a recent-vs-earlier trend. Null below
 *  MIN_TRANSFER_N so a high score never rests on 1–2 observations (design §9). */
export function transferAbility(events: ReviewEvent[]): TransferAbility | null {
  const dated = events
    .filter((e) => e.assessment?.transfer_level !== undefined)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (dated.length < P.MIN_TRANSFER_N) return null;

  const toScore = (e: ReviewEvent) => (e.assessment!.transfer_level! / P.TRANSFER_MAX) * 100;
  const score = mean(dated.map(toScore))!;

  const mid = Math.floor(dated.length / 2);
  const earlier = mean(dated.slice(0, mid).map(toScore));
  const later = mean(dated.slice(dated.length - mid).map(toScore));
  const trend = earlier === null || later === null ? null : later - earlier;

  return { score, n: dated.length, trend };
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance.ts tests/engine/transfer-ability.test.ts
git commit -m "feat(performance): Transfer Ability with min-data guard + trend

Mean transfer_level → 0–100 with a later-vs-earlier trend; null below
MIN_TRANSFER_N so a high score never rests on 1–2 observations.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Cold Performance

A transparent weighted composite over the *present* dimensions of **cold attempts only**, re-normalising over missing dimensions, null below `MIN_COLD_N`.

**⚠ Note for reviewer/checkpoint:** Cold Performance is a plain weighted average of present dimensions (design §D), NOT success-gated the way Performance Health's difficulty/novelty are — cold attempts already fold correctness in as the highest-weighted dimension (0.30). Flag at checkpoint if success-gating is wanted here too.

**Files:**
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/cold-performance.test.ts`

**Interfaces:**
- Consumes: `observedSuccess`, `mean`, `weightedComposite` (Task 1); `CONFIG.PERFORMANCE.{ MIN_COLD_N, COLD_WEIGHTS, *_MAX }`.
- Produces:
  - `interface ColdPerformance { score: number; n: number; }` (`score` 0–100)
  - `coldPerformance(events: ReviewEvent[]): ColdPerformance | null` (null below `MIN_COLD_N` cold attempts).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/cold-performance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { coldPerformance } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

const cold = (extra = {}, test?: { score: number; out_of: number }) =>
  makeEvent({ cold: true, ...extra }, test ? { test } : {});

describe('coldPerformance', () => {
  it('excludes non-cold attempts entirely', () => {
    const events = [
      ...Array.from({ length: 5 }, () => cold({ difficulty: 3 }, { score: 8, out_of: 10 })),
      makeEvent({ difficulty: 5, performance_quality: 5 }), // not cold — must not count
    ];
    expect(coldPerformance(events)!.n).toBe(5);
  });

  it('returns null below MIN_COLD_N cold attempts', () => {
    expect(coldPerformance([cold({ difficulty: 3 }, { score: 8, out_of: 10 })])).toBeNull();
  });

  it('re-normalises over missing dimensions rather than zero-filling them', () => {
    // Cold, correctness only (no difficulty/novelty/etc). Score must reflect the
    // correctness alone (~80), NOT be dragged toward 0 by absent dimensions.
    const events = Array.from({ length: 5 }, () => cold({}, { score: 8, out_of: 10 }));
    expect(coldPerformance(events)!.score).toBeCloseTo(80, 0);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `src/engine/performance.ts`:

```ts
export interface ColdPerformance {
  score: number; // 0–100
  n: number;
}

/** Weighted composite over the present dimensions of cold attempts only,
 *  re-normalising over missing ones (never zero-filled). Null below MIN_COLD_N
 *  (design §8). */
export function coldPerformance(events: ReviewEvent[]): ColdPerformance | null {
  const coldEvents = events.filter((e) => e.assessment?.cold === true);
  if (coldEvents.length < P.MIN_COLD_N) return null;

  const w = P.COLD_WEIGHTS;
  const dim = (pick: (e: ReviewEvent) => number | undefined, max: number): number | null =>
    mean(coldEvents.map(pick).filter((x): x is number => x !== undefined).map((x) => x / max));

  const correctness = mean(
    coldEvents.map(observedSuccess).filter((x): x is number => x !== undefined),
  );

  const composite = weightedComposite([
    { weight: w.correctness, score: correctness },
    { weight: w.difficulty, score: dim((e) => e.assessment?.difficulty, P.DIFFICULTY_MAX) },
    { weight: w.novelty, score: dim((e) => e.assessment?.novelty, P.NOVELTY_MAX) },
    { weight: w.independence, score: dim((e) => e.assessment?.independence, P.INDEPENDENCE_MAX) },
    { weight: w.transfer, score: dim((e) => e.assessment?.transfer_level, P.TRANSFER_MAX) },
    { weight: w.quality, score: dim((e) => e.assessment?.performance_quality, P.QUALITY_MAX) },
  ]);

  return composite === null ? null : { score: composite * 100, n: coldEvents.length };
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance.ts tests/engine/cold-performance.test.ts
git commit -m "feat(performance): Cold Performance composite (cold-only, re-normalised)

Weighted average over present dimensions of cold attempts only; missing
dimensions re-normalise rather than zero-fill; null below MIN_COLD_N.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Performance by difficulty / by novelty

Bucketed success rate by difficulty and by novelty, restricted to independent attempts — the difficulty×independent-success signal.

**⚠ INVARIANT (Global Constraints #1):** buckets count `isIndependent` (`=== 3`) attempts ONLY. An `independence: 2` attempt must not appear in any bucket. Named test below.

**Files:**
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/performance-by-dimension.test.ts`

**Interfaces:**
- Consumes: `isIndependent`, `observedSuccess` (Task 1); `CONFIG.TEST_PASS_MARK`.
- Produces:
  - `interface DimensionBucket { level: number; n: number; successRate: number | null; }` (`successRate` = fraction with `observedSuccess >= TEST_PASS_MARK`)
  - `performanceByDifficulty(events: ReviewEvent[]): DimensionBucket[]`
  - `performanceByNovelty(events: ReviewEvent[]): DimensionBucket[]`
  - (both return one bucket per level that has ≥1 independent attempt, ascending.)

- [ ] **Step 1: Write the failing test**

Create `tests/engine/performance-by-dimension.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { performanceByDifficulty, performanceByNovelty } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('performanceByDifficulty — independent-only', () => {
  it('excludes an independence-2 attempt from every bucket', () => {
    const buckets = performanceByDifficulty([
      makeEvent({ independence: 2, difficulty: 4 }, { test: { score: 10, out_of: 10 } }),
    ]);
    expect(buckets).toEqual([]); // the lightly-assisted attempt is not counted
  });

  it('buckets independent attempts by difficulty with a pass-rate', () => {
    const buckets = performanceByDifficulty([
      makeEvent({ independence: 3, difficulty: 4 }, { test: { score: 10, out_of: 10 } }), // pass
      makeEvent({ independence: 3, difficulty: 4 }, { test: { score: 5, out_of: 10 } }),  // fail
    ]);
    expect(buckets).toEqual([{ level: 4, n: 2, successRate: 0.5 }]);
  });
});

describe('performanceByNovelty — independent-only', () => {
  it('buckets independent attempts by novelty', () => {
    const buckets = performanceByNovelty([
      makeEvent({ independence: 3, novelty: 3 }, { test: { score: 9, out_of: 10 } }), // pass
    ]);
    expect(buckets).toEqual([{ level: 3, n: 1, successRate: 1 }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `src/engine/performance.ts`:

```ts
export interface DimensionBucket {
  level: number;
  n: number;
  successRate: number | null;
}

function bucketBy(
  events: ReviewEvent[],
  pick: (e: ReviewEvent) => number | undefined,
): DimensionBucket[] {
  const byLevel = new Map<number, ReviewEvent[]>();
  for (const e of events) {
    if (!isIndependent(e)) continue; // INVARIANT: === 3 only (design §10)
    const level = pick(e);
    if (level === undefined) continue;
    (byLevel.get(level) ?? byLevel.set(level, []).get(level)!).push(e);
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, es]) => {
      const outcomes = es.map(observedSuccess).filter((x): x is number => x !== undefined);
      const passes = outcomes.filter((x) => x >= CONFIG.TEST_PASS_MARK).length;
      return {
        level,
        n: es.length,
        successRate: outcomes.length === 0 ? null : passes / outcomes.length,
      };
    });
}

/** Pass-rate by difficulty over independent (===3) attempts only (design §13). */
export function performanceByDifficulty(events: ReviewEvent[]): DimensionBucket[] {
  return bucketBy(events, (e) => e.assessment?.difficulty);
}

/** Pass-rate by novelty over independent (===3) attempts only (design §13). */
export function performanceByNovelty(events: ReviewEvent[]): DimensionBucket[] {
  return bucketBy(events, (e) => e.assessment?.novelty);
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance.ts tests/engine/performance-by-dimension.test.ts
git commit -m "feat(performance): performance-by-difficulty / -by-novelty (independent-only)

Pass-rate bucketed by difficulty and novelty over independence===3 attempts
only — the difficulty×independent-success signal. Lightly-assisted attempts
are excluded from every bucket.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Calibration error (foresight rule)

Mean `|predicted_success − observedSuccess|` plus signed bias, over **foresight** predictions only. Separate from OCI.

**⚠ INVARIANT (Global Constraints #2):** count an attempt ONLY when `predicted_success` and `predicted_at` are both present AND `predicted_at` is **strictly before** `event.date`. Absent, or `>=` the date, → excluded. Named tests for after / equal / absent / before below. Do NOT touch `overconfidenceIndex` — this is a distinct metric.

**Files:**
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/calibration.test.ts`

**Interfaces:**
- Consumes: `observedSuccess`, `mean` (Task 1); `CONFIG.PERFORMANCE.MIN_CALIBRATION_N`.
- Produces:
  - `isForesightPrediction(e: ReviewEvent): boolean`
  - `interface Calibration { meanAbsError: number; bias: number; n: number; }` (`bias` = mean(predicted − observed); positive = over-prediction)
  - `calibrationError(events: ReviewEvent[]): Calibration | null` (null below `MIN_CALIBRATION_N` foresight predictions).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/calibration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calibrationError, isForesightPrediction } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

const ATTEMPT = '2026-08-10T12:00:00.000Z';
const BEFORE = '2026-08-10T09:00:00.000Z';
const AFTER = '2026-08-10T15:00:00.000Z';

const pred = (predicted_at: string | undefined, score = 8) =>
  makeEvent(
    { predicted_success: 0.9, ...(predicted_at ? { predicted_at } : {}) },
    { date: ATTEMPT, test: { score, out_of: 10 } },
  );

describe('isForesightPrediction — the foresight rule', () => {
  it('counts a prediction made strictly before the attempt', () => {
    expect(isForesightPrediction(pred(BEFORE))).toBe(true);
  });
  it('excludes a prediction timestamped AT the attempt (not strictly before)', () => {
    expect(isForesightPrediction(pred(ATTEMPT))).toBe(false);
  });
  it('excludes a prediction made AFTER the attempt (hindsight)', () => {
    expect(isForesightPrediction(pred(AFTER))).toBe(false);
  });
  it('excludes a prediction with no predicted_at (unverifiable → hindsight)', () => {
    expect(isForesightPrediction(pred(undefined))).toBe(false);
  });
});

describe('calibrationError', () => {
  it('aggregates only foresight predictions; hindsight ones do not move it', () => {
    // 5 foresight predictions (0.9 predicted, 0.8 observed) + a hindsight one that
    // would skew the number if wrongly counted.
    const foresight = Array.from({ length: 5 }, () => pred(BEFORE)); // |0.9-0.8|=0.1
    const hindsight = pred(AFTER, 0); // predicted 0.9, observed 0 — must be ignored
    const r = calibrationError([...foresight, hindsight])!;
    expect(r.n).toBe(5);
    expect(r.meanAbsError).toBeCloseTo(0.1);
    expect(r.bias).toBeCloseTo(0.1); // over-predicted by 0.1
  });

  it('returns null below MIN_CALIBRATION_N foresight predictions', () => {
    expect(calibrationError([pred(BEFORE), pred(BEFORE)])).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `src/engine/performance.ts`:

```ts
export interface Calibration {
  meanAbsError: number;
  bias: number; // mean(predicted − observed); positive = over-prediction
  n: number;
}

/** Foresight rule (design §D, §11): predicted_success AND predicted_at present,
 *  and predicted_at STRICTLY before the attempt's date. Absence or a
 *  not-strictly-before timestamp → hindsight → excluded. */
export function isForesightPrediction(e: ReviewEvent): boolean {
  const a = e.assessment;
  if (!a || a.predicted_success === undefined || a.predicted_at === undefined) return false;
  return new Date(a.predicted_at).getTime() < new Date(e.date).getTime();
}

/** Tutor-prediction-vs-outcome error over foresight predictions only. Distinct
 *  from OCI (confidence-vs-performance). Null below MIN_CALIBRATION_N. */
export function calibrationError(events: ReviewEvent[]): Calibration | null {
  const pairs: Array<{ predicted: number; observed: number }> = [];
  for (const e of events) {
    if (!isForesightPrediction(e)) continue;
    const observed = observedSuccess(e);
    if (observed === undefined) continue;
    pairs.push({ predicted: e.assessment!.predicted_success!, observed });
  }
  if (pairs.length < P.MIN_CALIBRATION_N) return null;
  return {
    meanAbsError: mean(pairs.map((p) => Math.abs(p.predicted - p.observed)))!,
    bias: mean(pairs.map((p) => p.predicted - p.observed))!,
    n: pairs.length,
  };
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance.ts tests/engine/calibration.test.ts
git commit -m "feat(performance): calibration error (foresight predictions only)

isForesightPrediction requires predicted_success + predicted_at strictly
before the attempt; hindsight is excluded, defaulting absence to exclusion.
Reports meanAbsError + signed bias; null below MIN_CALIBRATION_N. Separate
from OCI (untouched).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Performance Health composite

The parallel 0–100 headline. Weighted composite of independent accuracy, success-gated difficulty/novelty, transfer, and quality — re-normalised over present inputs.

**⚠ INVARIANT (Global Constraints #3):** the accuracy component is NOT gated on a difficulty floor — an easy-but-independent high-accuracy learner banks the accuracy weight and reads "solid but untested" (a modest, non-zero score), while difficulty/novelty gate the top end. Difficulty/novelty ARE success-gated (a failed hard attempt contributes ~0). Named tests for both below. Do not "fix" the non-gated accuracy.

**Files:**
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/performance-health.test.ts`

**Interfaces:**
- Consumes: `isIndependent`, `observedSuccess`, `mean`, `weightedComposite` (Task 1); `CONFIG.PERFORMANCE.{ HEALTH_WEIGHTS, MIN_HEALTH_INPUTS, *_MAX }`.
- Produces: `performanceHealth(events: ReviewEvent[]): number | null` (0–100; null if fewer than `MIN_HEALTH_INPUTS` sub-scores are present).

Sub-score definitions (all 0–1):
- `accuracy` = mean `observedSuccess` over independent (`=== 3`) attempts.
- `difficulty` = mean over independent attempts of `(difficulty / DIFFICULTY_MAX) × observedSuccess` (success-gated).
- `novelty` = mean over independent attempts of `(novelty / NOVELTY_MAX) × observedSuccess` (success-gated).
- `transfer` = mean `transfer_level / TRANSFER_MAX` over all attempts with a transfer level (its own scale already encodes independence).
- `quality` = mean `performance_quality / QUALITY_MAX` over all attempts with a quality score.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/performance-health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { performanceHealth } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('performanceHealth — anti-gaming invariants', () => {
  it('NO difficulty floor on accuracy: easy independent high-accuracy → modest, non-zero (solid but untested)', () => {
    // independent, difficulty 0, novelty 0, success 0.9. Present sub-scores:
    // accuracy=0.9 (w .30), difficulty=0 (w .20), novelty=0 (w .15). transfer/
    // quality absent → excluded. composite = (.30*.9)/(.30+.20+.15) = .27/.65.
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 0, novelty: 0 }, { test: { score: 9, out_of: 10 } }),
    );
    expect(performanceHealth(events)).toBe(Math.round((0.3 * 0.9) / 0.65 * 100)); // 42
  });

  it('difficulty is success-gated: a failed hard independent attempt adds ~0 difficulty credit', () => {
    // independent, difficulty 5, success 0 → difficulty sub-score 0.
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 5 }, { test: { score: 0, out_of: 10 } }),
    );
    // accuracy=0 and difficulty=0 → composite 0.
    expect(performanceHealth(events)).toBe(0);
  });

  it('rewards difficulty WITH success: solved-hard beats solved-easy', () => {
    const hard = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 5 }, { test: { score: 9, out_of: 10 } }),
    );
    const easy = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 0 }, { test: { score: 9, out_of: 10 } }),
    );
    expect(performanceHealth(hard)!).toBeGreaterThan(performanceHealth(easy)!);
  });

  it('returns null when fewer than MIN_HEALTH_INPUTS sub-scores are present', () => {
    // Only accuracy is present (no difficulty/novelty/transfer/quality anywhere).
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3 }, { test: { score: 9, out_of: 10 } }),
    );
    expect(performanceHealth(events)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `src/engine/performance.ts`:

```ts
/**
 * Performance Health, 0–100 (design §12/§D). Weighted composite, re-normalised
 * over present sub-scores. Difficulty/novelty are SUCCESS-GATED (multiplied by
 * observedSuccess) and drawn from independent (===3) attempts only — performance
 * at difficulty *while independent*. Accuracy is deliberately NOT gated on
 * difficulty (see INVARIANT). Null if fewer than MIN_HEALTH_INPUTS sub-scores
 * are present.
 */
export function performanceHealth(events: ReviewEvent[]): number | null {
  const w = P.HEALTH_WEIGHTS;
  const indep = events.filter(isIndependent);

  const accuracy = mean(indep.map(observedSuccess).filter((x): x is number => x !== undefined));

  const gated = (max: number, pick: (e: ReviewEvent) => number | undefined): number | null =>
    mean(
      indep
        .map((e) => {
          const dim = pick(e);
          const s = observedSuccess(e);
          return dim === undefined || s === undefined ? undefined : (dim / max) * s;
        })
        .filter((x): x is number => x !== undefined),
    );

  const dimAll = (max: number, pick: (e: ReviewEvent) => number | undefined): number | null =>
    mean(events.map(pick).filter((x): x is number => x !== undefined).map((x) => x / max));

  const parts = [
    { weight: w.accuracy, score: accuracy },
    { weight: w.difficulty, score: gated(P.DIFFICULTY_MAX, (e) => e.assessment?.difficulty) },
    { weight: w.novelty, score: gated(P.NOVELTY_MAX, (e) => e.assessment?.novelty) },
    { weight: w.transfer, score: dimAll(P.TRANSFER_MAX, (e) => e.assessment?.transfer_level) },
    { weight: w.quality, score: dimAll(P.QUALITY_MAX, (e) => e.assessment?.performance_quality) },
  ];

  if (parts.filter((p) => p.score !== null).length < P.MIN_HEALTH_INPUTS) return null;
  const composite = weightedComposite(parts);
  return composite === null ? null : Math.round(composite * 100);
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Full-phase verification**

Run: `npx vitest run tests/engine tests/domain tests/core`
Expected: PASS (all Performance tests + the untouched existing suites).

Run: `npm test`
Expected: the SAME 3 pre-existing UI files failing, nothing new.

- [ ] **Step 6: Commit**

```bash
git add src/engine/performance.ts tests/engine/performance-health.test.ts
git commit -m "feat(performance): Performance Health composite

Weighted 0–100 composite: independent accuracy (NOT difficulty-gated — solid
but untested reads modest, not zero), success-gated difficulty/novelty over
independent attempts, transfer, quality. Re-normalises over present inputs;
null below MIN_HEALTH_INPUTS. Parallel to Knowledge Health; feeds nothing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §D — Phase 3 scope):**
- Independent Performance, strict tiers → Task 2. ✔
- Transfer Ability + trend + min-data → Task 3. ✔
- Cold Performance, cold-only, re-normalised → Task 4. ✔
- perf-by-difficulty / -by-novelty, independent-only → Task 5. ✔
- calibrationError, foresight rule, separate from OCI → Task 6. ✔
- Performance Health, weights, no-difficulty-floor, success-gating → Task 7. ✔
- `observedSuccess` commensurability decision, graceful degradation, min-data guards, `CONFIG.PERFORMANCE` → Task 1. ✔

**2. The three named invariants (the user's ask):**
- Strict independence (`=== 3`) → Task 2 (`independence: 2` → lightlyAssisted) AND Task 5 (`independence: 2` → excluded from buckets), each a named test. ✔
- Foresight rule → Task 6 named tests for after / equal / absent / before. ✔
- No-difficulty-floor + success-gating → Task 7 named tests (exact modest score; failed-hard → 0; solved-hard > solved-easy). ✔

**3. Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. ✔

**4. Type consistency:** helper names (`observedSuccess`, `isIndependent`, `independenceTier`, `mean`, `weightedComposite`) are defined in Task 1 and consumed with identical signatures in Tasks 2–7. `CONFIG.PERFORMANCE` keys used in later tasks (`MIN_*`, `*_MAX`, `HEALTH_WEIGHTS`, `COLD_WEIGHTS`) all exist in the Task 1 block. Return interfaces (`TierStats`, `IndependentPerformance`, `TransferAbility`, `ColdPerformance`, `DimensionBucket`, `Calibration`) are each defined in their producing task and not referenced before definition. `P = CONFIG.PERFORMANCE` alias is established in Task 1 and reused. ✔

**5. Read-side-only:** `performance.ts` imports only `CONFIG` and types — no engine-write modules. `overconfidenceIndex` and all existing metrics untouched. ✔

**6. Open decision surfaced for checkpoint:** Cold Performance uses a plain (non-success-gated) weighted average per design §D — flagged in Task 4 for a checkpoint decision, not silently chosen.
