# Retention Honesty Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a lapse from making a topic look healthier — derive retention from a lapse-penalised effective stability, make test strength-gains continuous, purge `kFactor` contamination from uniform-fallback exams, de-quantise `t`, and add an offline scorer so the model choice is empirical.

**Architecture:** `strength` stays append-only (velocity/EXP/badges). A derived, unstored **lapse factor `P`** (multiplicative fold over `review_history`) yields `s_eff = max(S_EFF_MIN, strength·P)`, which retention/`projectedDue`/health-via-retention read instead of raw `strength`. Uniform-fallback exam events are marked `smeared` and excluded from `kFactor` self-tuning (kept, dampened, in the lapse fold). A one-time load/import migration recomputes contaminated `k`. An offline vitest harness scores predicted `R` against `actual_retention` at three git checkpoints (baseline / #1 / #1+continuous) plus a rough FSRS port.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Ajv + ajv-formats. Local-first (localStorage). Path alias `@/` → `src/`.

## Global Constraints

- **Named constants only** — no magic numbers inline in the engine (Doc 2 §0). All new tunables live in `src/config/constants.ts`.
- **`schema_version` `3.0.0 → 3.1.0`** — the migration is the one place persisted state changes; everything else is a redeploy.
- **Append-only `strength`** — never subtract from or lower raw `strength`; lapses act only on derived `s_eff`.
- **`date-time` is schema-enforced** — `ReviewEvent.date`/`last_reviewed` always carry a time; fractional `t` is safe.
- **Health weights unchanged** and must still sum to 1 (the `constants.ts` invariant check stays green).
- **TDD, frequent commits** — each task: failing test → verify red → minimal code → verify green → commit.
- **Test commands:** full suite `npm test`; single file `npx vitest run <path>`; filter `npx vitest run <path> -t "<name>"`; types `npm run typecheck`.
- **Default constants (harness-tunable starting points, except `SMEAR_PENALTY_WEIGHT`):** `S_EFF_MIN 0.25`, `LAPSE_RECOVERY 1.25`, `PENALTY_FLOOR 0.40`, `SMEAR_PENALTY_WEIGHT 1.0`, `TEST_GAIN_MIN 0.15`, `TEST_GAIN_AT_PASS_MARK 1.50`, `TEST_GAIN_MAX 2.00`.

---

## File Structure

**Phase A — model prerequisites (land before the baseline):**
- `src/engine/retention.ts` — add `elapsedDays` (fractional), use it in `predictRetention`.
- `src/domain/types.ts` — `ReviewEvent.smeared?: boolean`; `SCHEMA_VERSION` → `3.1.0`.
- `src/domain/schemas.ts` — allow optional `smeared` on `REVIEW_EVENT`.
- `src/core/merge.ts` — `mergeExam` stamps `smeared` on uniform-fallback events.
- `src/engine/recalculate.ts` — `applyEvent` skips drift/`kFactor` tuning when `event.smeared`.
- `src/engine/replay.ts` — extract shared `replayEvents(topic, events)`; `topicStateAsOf` delegates to it.
- `src/core/migrations.ts` *(new)* — `examTopicSmeared`, `recomputeLapseContamination`.
- `src/core/storage.ts` — `migrate` runs the recompute for saved versions `< 3.1.0`.
- `src/core/transfer.ts` — `importBundle` runs the recompute for bundle versions `< 3.1.0`.

**Phase B — baseline harness:**
- `tests/eval/harness.ts` *(new)* — scoring (`scoreStore`), engine/FSRS/constant models.
- `tests/eval/harness.test.ts` *(new)* — always-on unit tests (prior-events-only, clamp, smeared handling).
- `tests/eval/harness.eval.ts` *(new)* — runner, `skipIf(!process.env.EVAL_STORE)`, prints the table.
- `tests/eval/fixture.ts` *(new)* — synthetic multi-topic store so the harness runs without a real export.
- `docs/superpowers/specs/2026-08-09-retention-eval-results.md` *(new, created here)* — the results table; the baseline row is appended in Task 4, `#1` in Task 6, `#1+continuous` in Task 9, and FSRS/constant + decision in Task 11 (it accretes, git-anchored per checkpoint).

**Phase C — #1 + #7:**
- `src/config/constants.ts` — the seven new constants.
- `src/engine/stability.ts` *(new)* — `penaltyFrom`, `lapseFactor`, `effectiveStrength` (imports CONFIG + types only, no engine cycle).
- `src/engine/retention.ts` — `predictRetention` & `projectedDue` use `effectiveStrength`.
- `src/engine/history.ts` — `retentionSeries` onto `topicStateAsOf`; delete the subtraction path.
- `src/engine/recalculate.ts` — `strengthIncrement(event)` continuous for tests.

**Phase D — decide:**
- `docs/superpowers/specs/2026-08-09-retention-eval-results.md` — FSRS/constant rows + the model decision appended to the doc created in Phase B.

---

## Task 1: Fractional elapsed days (§5)

**Files:**
- Modify: `src/engine/retention.ts`
- Test: `tests/engine/retention.test.ts` *(new)*

**Interfaces:**
- Produces: `elapsedDays(from: Date, to: Date): number` (fractional). `predictRetention` unchanged signature, now sub-day sensitive.

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/retention.test.ts
import { describe, it, expect } from 'vitest';
import { predictRetention, elapsedDays, MS_PER_DAY } from '@/engine/retention';
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';

function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 3,
    strength: 1, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: null, mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...over,
  };
}

describe('elapsedDays', () => {
  it('is fractional, not floored', () => {
    const from = new Date('2026-08-08T00:00:00Z');
    const to = new Date('2026-08-08T12:00:00Z');
    expect(elapsedDays(from, to)).toBeCloseTo(0.5, 6);
  });
});

describe('predictRetention with fractional t', () => {
  it('decays within the same day (s=1, k=8.4, 12h → e^(-0.5/8.4))', () => {
    const reviewed = new Date('2026-08-08T00:00:00Z');
    const now = new Date('2026-08-08T12:00:00Z');
    const t = topic({ last_reviewed: reviewed.toISOString(), strength: 1 });
    expect(predictRetention(t, now)).toBeCloseTo(Math.exp(-0.5 / (CONFIG.DECAY_K * 1)), 6);
  });
  it('still returns 1 for t <= 0 (reviewed same instant / backdated)', () => {
    const reviewed = new Date('2026-08-08T12:00:00Z');
    const t = topic({ last_reviewed: reviewed.toISOString() });
    expect(predictRetention(t, reviewed)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/retention.test.ts`
Expected: FAIL — `elapsedDays` is not exported.

- [ ] **Step 3: Implement**

In `src/engine/retention.ts`, add below `daysBetween`:

```ts
/**
 * Fractional days elapsed — the decay input (Document 2 §2, amended 2026-08-09).
 * Unlike `daysBetween` (whole days, for whole-day UI ticks), this is not floored,
 * so `t` isn't quantised and decay is continuous within a day.
 */
export function elapsedDays(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}
```

Then in `predictRetention`, change the `t` line:

```ts
const t = elapsedDays(reviewed, now);
if (t <= 0) return 1; // reviewed just now / backdated
```

Leave `daysBetween` as-is (still used by `RetentionCurve.tsx`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/engine/retention.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the §2 wording**

In `src/engine/retention.ts` header/`daysBetween` doc, note that decay now uses fractional `elapsedDays`; `daysBetween` is retained for whole-day display only.

- [ ] **Step 6: Run the full suite; fix any now-stale "reviewed today = 100%" assertions**

Run: `npm test`
Expected: any failures are pre-existing tests asserting a flat 100% within the review day; update each expected value to `Math.exp(-t/(k·s))` for its fixture's actual elapsed time. Do not weaken assertions — recompute them.

- [ ] **Step 7: Commit**

```bash
git add src/engine/retention.ts tests/engine/retention.test.ts
git commit -m "feat(retention): fractional elapsed days (de-quantise t)"
```

---

## Task 2: `smeared` marker — schema, type, ingestion, drift skip (#6 live rule)

**Files:**
- Modify: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/core/merge.ts`, `src/engine/recalculate.ts`
- Test: `tests/core/merge.test.ts` *(new)*, `tests/engine/recalculate.test.ts` *(new)*

**Interfaces:**
- Produces: `ReviewEvent.smeared?: boolean`. `applyEvent` skips `pushDrift`/`tuneKFactor` when `event.smeared`.
- Consumes: existing `mergeExam` breakdown-vs-fallback branch (`merge.ts:135-137`).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/recalculate.test.ts
import { describe, it, expect } from 'vitest';
import { applyEvent } from '@/engine/recalculate';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

function baseTopic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 3,
    strength: 2, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: '2026-08-01T09:00:00Z', mastered_at: null,
    // three prior drift samples so a fourth would tune k
    drift_history: [-0.2, -0.2, -0.2],
    review_history: [], error_log: [], ...over,
  };
}
function testEvent(over: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    event_id: 'event_x', date: '2026-08-08T09:00:00Z', kind: 'test_fail',
    source: 'exam', source_id: 'exam_1', confidence_reported: 4,
    test: { score: 3, out_of: 10, actual_retention: 0.3 }, ...over,
  };
}

describe('applyEvent drift skip for smeared events', () => {
  it('a smeared test does NOT tune k_factor or push drift', () => {
    const before = baseTopic();
    const after = applyEvent(before, testEvent({ smeared: true }));
    expect(after.k_factor).toBe(before.k_factor);
    expect(after.drift_history).toEqual(before.drift_history);
  });
  it('a non-smeared test DOES push drift and tune k_factor', () => {
    const before = baseTopic();
    const after = applyEvent(before, testEvent({ smeared: false }));
    // toBe(+1), not toBeGreaterThan(-1): the latter passes even when nothing was pushed.
    expect(after.drift_history.length).toBe(before.drift_history.length + 1);
    expect(after.k_factor).not.toBe(before.k_factor);
  });
});
```

```ts
// tests/core/merge.test.ts
import { describe, it, expect } from 'vitest';
import { mergeInto } from '@/core/merge';
import { emptyStore, type Course, type Exam, type Store } from '@/domain/types';

function storeWithTopic(id = 'topic_a'): Store {
  const course: Course = {
    schema_version: '3.1.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: id, title: 'T', status: 'practising', conf: 3, strength: 1,
      k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00Z',
      mastered_at: null, drift_history: [], review_history: [], error_log: [],
    }] }],
  };
  const s = emptyStore(); s.courses.push(course); return s;
}

describe('mergeExam smeared marking', () => {
  it('marks a uniform-fallback exam event smeared: true', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.1.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00Z',
      linked_topic_ids: ['topic_a'], score: 4, max_score: 10, // no breakdown
    };
    mergeInto(s, 'exam', exam);
    const ev = s.courses[0].sections[0].topics[0].review_history.at(-1)!;
    expect(ev.smeared).toBe(true);
    expect(ev.fanout).toBe(1); // linked_topic_ids.length, stamped for a future 1/√N option
  });
  it('marks a breakdown-backed exam event smeared: false', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.1.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00Z',
      linked_topic_ids: ['topic_a'], score: 4, max_score: 10,
      breakdown: [{ topic_id: 'topic_a', points_earned: 4, points_possible: 10 }],
    };
    mergeInto(s, 'exam', exam);
    const ev = s.courses[0].sections[0].topics[0].review_history.at(-1)!;
    expect(ev.smeared).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/engine/recalculate.test.ts tests/core/merge.test.ts`
Expected: FAIL — `smeared` not set / not honored.

- [ ] **Step 3: Add the type**

In `src/domain/types.ts`, add to `ReviewEvent` after `test?`:

```ts
  /**
   * True when this test event's score was smeared uniformly across an exam's
   * linked topics (no per-topic `breakdown`). Excluded from kFactor self-tuning
   * (§4); still counted, weighted, in the lapse fold (design 2026-08-09 §2.2).
   */
  smeared?: boolean;
  /** Number of topics the source exam linked (`linked_topic_ids.length`).
   *  Stamped for a future `1/√N` fan-out damping; unused at weight 1.0 today. */
  fanout?: number;
```

- [ ] **Step 4: Allow it in the schema**

In `src/domain/schemas.ts`, add to `REVIEW_EVENT.properties`:

```ts
    smeared: { type: 'boolean' },
    fanout: { type: 'integer', minimum: 1 },
```

(`additionalProperties: false` means they must be declared; neither is added to `required`, so old JSON without them still validates.)

- [ ] **Step 5: Stamp it in `mergeExam`**

In `src/core/merge.ts` `mergeExam`, in the event object add (the topic's own breakdown entry decides `smeared`; `source_id` is already `exam.exam_id` at line 146, which the migration join relies on):

```ts
      smeared: !entry, // uniform fallback (no per-topic breakdown) → smeared
      fanout: exam.linked_topic_ids.length, // stamped now for a future 1/√N option
```

- [ ] **Step 6: Skip drift in `applyEvent`**

In `src/engine/recalculate.ts`, guard the drift block:

```ts
  if (!event.smeared && event.test && (event.kind === 'test_pass' || event.kind === 'test_fail')) {
    const predicted = predictRetention(topic, new Date(event.date));
    if (predicted !== null) {
      const drift = event.test.actual_retention - predicted;
      next.drift_history = pushDrift(next.drift_history, drift);
      next.k_factor = tuneKFactor(topic.k_factor, next.drift_history);
    }
  }
```

- [ ] **Step 7: Run to verify green**

Run: `npx vitest run tests/engine/recalculate.test.ts tests/core/merge.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/types.ts src/domain/schemas.ts src/core/merge.ts src/engine/recalculate.ts tests/engine/recalculate.test.ts tests/core/merge.test.ts
git commit -m "feat(engine): mark uniform-fallback exam events smeared, skip k-tuning"
```

---

## Task 3: Shared `replayEvents` + migration (recompute k, backfill smeared) on load & import

**Files:**
- Modify: `src/engine/replay.ts`, `src/domain/types.ts`, `src/core/storage.ts`, `src/core/transfer.ts`
- Create: `src/core/migrations.ts`
- Test: `tests/core/migrations.test.ts` *(new)*

**Interfaces:**
- Produces: `replayEvents(topic: Topic, events: readonly ReviewEvent[]): Topic`; `examTopicSmeared(exam: Exam | undefined, topicId: string): boolean`; `recomputeLapseContamination(store: Store): void` (mutates in place).
- Consumes: `topicStateAsOf` (now delegates to `replayEvents`), `applyEvent`, `allTopics`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/core/migrations.test.ts
import { describe, it, expect } from 'vitest';
import { examTopicSmeared, recomputeLapseContamination } from '@/core/migrations';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Exam, type ReviewEvent, type Store } from '@/domain/types';

function smearedExamEvent(i: number): ReviewEvent {
  return {
    event_id: `event_${i}`, date: `2026-08-0${i + 1}T09:00:00Z`, kind: 'test_fail',
    source: 'exam', source_id: 'exam_1', confidence_reported: 3,
    test: { score: 3, out_of: 10, actual_retention: 0.3 }, // smeared flag absent (legacy)
  };
}

function contaminatedStore(): Store {
  const course: Course = {
    schema_version: '3.0.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: 'topic_a', title: 'T', status: 'practising', conf: 3, strength: 3,
      // k tuned away from DECAY_K by the (legacy, smeared) exam; drift stored
      k_factor: 6.3, cards: 0, last_reviewed: '2026-08-03T09:00:00Z', mastered_at: null,
      drift_history: [-0.3, -0.3, -0.3],
      review_history: [smearedExamEvent(0), smearedExamEvent(1), smearedExamEvent(2)],
      error_log: [],
    }] }],
  };
  const exam: Exam = {
    schema_version: '3.0.0', exam_id: 'exam_1', title: 'E', date: '2026-08-03T09:00:00Z',
    linked_topic_ids: ['topic_a'], score: 3, max_score: 10, // no breakdown → smeared
  };
  const s = emptyStore(); s.courses.push(course); s.exams.push(exam); return s;
}

describe('examTopicSmeared', () => {
  it('unresolvable exam → smeared (cautious)', () => {
    expect(examTopicSmeared(undefined, 'topic_a')).toBe(true);
  });
  it('no breakdown → smeared', () => {
    expect(examTopicSmeared({ breakdown: undefined } as Exam, 'topic_a')).toBe(true);
  });
  it('topic present in breakdown → not smeared', () => {
    const e = { breakdown: [{ topic_id: 'topic_a', points_earned: 1, points_possible: 2 }] } as Exam;
    expect(examTopicSmeared(e, 'topic_a')).toBe(false);
  });
});

describe('recomputeLapseContamination', () => {
  it('backfills smeared and recomputes k back to DECAY_K when all tuning was smeared', () => {
    const s = contaminatedStore();
    recomputeLapseContamination(s);
    const t = s.courses[0].sections[0].topics[0];
    expect(t.review_history.every((e) => e.smeared === true)).toBe(true);
    expect(t.k_factor).toBe(CONFIG.DECAY_K);
    expect(t.drift_history).toEqual([]);
  });
  it('is idempotent', () => {
    const s = contaminatedStore();
    recomputeLapseContamination(s);
    const once = JSON.stringify(s);
    recomputeLapseContamination(s);
    expect(JSON.stringify(s)).toBe(once);
  });

  // THE discriminating test: without it, "purged correctly" and "join failed,
  // wiped everything to DECAY_K" are indistinguishable (both leave k===DECAY_K).
  it('PRESERVES legitimate tuning from breakdown-backed exams (join resolves)', () => {
    // Three breakdown-backed exams, each a real per-topic fail → real drift → real k move.
    const exams: Exam[] = [0, 1, 2].map((i) => ({
      schema_version: '3.0.0', exam_id: `exam_${i}`, title: `E${i}`,
      date: `2026-08-0${i + 1}T09:00:00Z`, linked_topic_ids: ['topic_a'],
      score: 2, max_score: 10,
      breakdown: [{ topic_id: 'topic_a', points_earned: 2, points_possible: 10 }],
    }));
    const events: ReviewEvent[] = exams.map((ex, i) => ({
      event_id: `event_${i}`, date: ex.date, kind: 'test_fail', source: 'exam',
      source_id: ex.exam_id, confidence_reported: 3,
      test: { score: 2, out_of: 10, actual_retention: 0.2 },
    }));
    const course: Course = {
      schema_version: '3.0.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00Z',
      source: 'manual', sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
        topic_id: 'topic_a', title: 'T', status: 'practising', conf: 3, strength: 3, k_factor: 8.4,
        cards: 0, last_reviewed: '2026-08-03T09:00:00Z', mastered_at: null, drift_history: [],
        review_history: events, error_log: [],
      }] }],
    };
    const s = emptyStore(); s.courses.push(course); s.exams.push(...exams);

    const counts = recomputeLapseContamination(s);
    const t = s.courses[0].sections[0].topics[0];
    expect(counts.unresolved).toBe(0);            // every source_id resolved to an exam
    expect(t.review_history.every((e) => e.smeared === false)).toBe(true);
    expect(t.drift_history.length).toBeGreaterThan(0); // legitimate drift survived
    expect(t.k_factor).not.toBe(CONFIG.DECAY_K);   // legitimate tuning survived
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/core/migrations.test.ts`
Expected: FAIL — `@/core/migrations` does not exist.

- [ ] **Step 3: Extract `replayEvents` in `replay.ts`**

Replace the body of `topicStateAsOf` with a delegation and export the shared fold:

```ts
export function replayEvents(topic: Topic, events: readonly ReviewEvent[]): Topic {
  const genesis: Topic = {
    ...topic, status: 'not_started', strength: 0, k_factor: CONFIG.DECAY_K,
    conf: 1, last_reviewed: null, mastered_at: null,
    drift_history: [], review_history: [], error_log: [],
  };
  let state = genesis;
  for (const e of events) state = applyEvent(state, e, new Date(e.date));
  return state;
}

export function topicStateAsOf(topic: Topic, asOf: Date): Topic {
  const events = topic.review_history
    .filter((e) => new Date(e.date).getTime() <= asOf.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return replayEvents(topic, events);
}
```

Add `ReviewEvent` to the type import in `replay.ts`. **Keep `genesis` byte-identical to the current implementation** — in particular `error_log: []` and `k_factor: CONFIG.DECAY_K`. `topicLevelHighWater` calls `topicStateAsOf` and then overrides `error_log` with date-filtered active errors (`leveling.ts:77-88`), so it relies on genesis emptying it; any drift here silently changes health-derived level. This is an extraction, not a behavior change.

- [ ] **Step 4: Create the migration module**

```ts
// src/core/migrations.ts
import { allTopics, type Exam, type Store } from '@/domain/types';
import { topicStateAsOf } from '@/engine/replay';

/** Max representable date — replay "everything" without a real clock. */
const FAR_FUTURE = new Date(8_640_000_000_000_000);

/** A topic's exam score is smeared when the exam gave no per-topic breakdown
 *  for it — or when the exam can't be resolved at all (cautious default). */
export function examTopicSmeared(exam: Exam | undefined, topicId: string): boolean {
  if (!exam) return true;
  if (!exam.breakdown) return true;
  return !exam.breakdown.some((b) => b.topic_id === topicId);
}

export interface RecomputeCounts { resolved: number; unresolved: number; }

/**
 * v3.1.0 — purge kFactor/drift_history contamination from uniform-fallback exams.
 * Backfills `smeared` (and `fanout`) on exam-sourced test events by joining
 * source_id → store.exams[] (mergeExam stamps source_id = exam.exam_id), then
 * recomputes k forward under the new skip rule via the shared replay. Idempotent;
 * mutates `store` in place. Returns join counts so a caller/test can assert that
 * provenance actually resolved — an unresolved join silently reduces to "wipe
 * everything to DECAY_K," which would otherwise look like a successful purge.
 */
export function recomputeLapseContamination(store: Store): RecomputeCounts {
  let resolved = 0;
  let unresolved = 0;
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'exam' && (e.kind === 'test_pass' || e.kind === 'test_fail')) {
        const exam = store.exams.find((x) => x.exam_id === e.source_id);
        if (exam) { resolved += 1; e.fanout = exam.linked_topic_ids.length; }
        else unresolved += 1;
        e.smeared = examTopicSmeared(exam, topic.topic_id);
      }
    }
    const replayed = topicStateAsOf(topic, FAR_FUTURE);
    topic.k_factor = replayed.k_factor;
    topic.drift_history = replayed.drift_history;
  }
  return { resolved, unresolved };
}
```

- [ ] **Step 5: Run migration unit tests to green**

Run: `npx vitest run tests/core/migrations.test.ts`
Expected: PASS.

- [ ] **Step 6: Bump the schema version**

In `src/domain/types.ts`: `export const SCHEMA_VERSION = '3.1.0';`

- [ ] **Step 7: Run the recompute on load**

In `src/core/storage.ts` `migrate`, capture the saved version and run the recompute for pre-3.1.0 stores (before `return result`):

```ts
import { recomputeLapseContamination } from './migrations';
// ...
const savedVersion = typeof p.schema_version === 'string' ? p.schema_version : '0.0.0';
// ...build result as today...
if (savedVersion < '3.1.0') recomputeLapseContamination(result); // lexicographic ok for x.y.z here
return result;
```

- [ ] **Step 8: Run the recompute on import**

In `src/core/transfer.ts` `importBundle`, after the exam loop and before the success return, run it for pre-3.1.0 bundles:

```ts
import { recomputeLapseContamination } from './migrations';
// ...after `if (errors.length > 0) return { ok: false, errors };`
if ((parsed.schema_version ?? '0.0.0') < '3.1.0') recomputeLapseContamination(draft);
```

- [ ] **Step 9: Write the import-path integration test**

```ts
// add to tests/core/migrations.test.ts
import { importBundle } from '@/core/transfer';

it('importBundle recomputes contaminated k from an old bundle', () => {
  const s = contaminatedStore();
  const bundle = JSON.stringify({
    kind: 'studyos-export', schema_version: '3.0.0',
    exported_at: '2026-08-08T00:00:00Z', store: s,
  });
  const res = importBundle(bundle);
  expect(res.ok).toBe(true);
  if (res.ok) {
    const t = res.store.courses[0].sections[0].topics[0];
    expect(t.k_factor).toBe(CONFIG.DECAY_K);
  }
});
```

- [ ] **Step 10: Run affected suites**

Run: `npx vitest run tests/core/migrations.test.ts tests/engine/replay.test.ts tests/engine/leveling.test.ts && npm run typecheck`
Expected: PASS. `replay.test.ts` confirms the `topicStateAsOf` extraction is behaviour-preserving; `leveling.test.ts` confirms `topicLevelHighWater` (which depends on genesis emptying `error_log`) is unaffected. If `leveling.test.ts` does **not** exercise high-water with active errors, add a case that does before trusting this step.

- [ ] **Step 11: Commit**

```bash
git add src/engine/replay.ts src/domain/types.ts src/core/migrations.ts src/core/storage.ts src/core/transfer.ts tests/core/migrations.test.ts
git commit -m "feat(migration): v3.1.0 recompute k, backfill smeared on load and import"
```

---

## Task 4: Offline eval harness + baseline capture (Phase B)

**Files:**
- Create: `tests/eval/harness.ts`, `tests/eval/fixture.ts`, `tests/eval/harness.test.ts`, `tests/eval/harness.eval.ts`
- Docs: append the **baseline** engine row to the results doc (created fully in Task 11).

**Interfaces:**
- Produces: `scoreStore(store, model): Scored`; `engineModel`, `fsrsModel`, `constantModel(store)`; `Scored { mae; logLoss; bernoulli; n }`.
- Consumes: `replayEvents` (Task 3), `predictRetention` (Task 1), `MS_PER_DAY`.

- [ ] **Step 1: Write the fixture**

```ts
// tests/eval/fixture.ts
import { emptyStore, type Course, type ReviewEvent, type Store } from '@/domain/types';

function ev(i: number, kind: ReviewEvent['kind'], a: number, smeared = false): ReviewEvent {
  return {
    event_id: `event_${i}`, date: `2026-07-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
    kind, source: kind === 'study_review' ? 'session' : 'exam',
    source_id: kind === 'study_review' ? `session_${i}` : `exam_${i}`,
    confidence_reported: 4,
    ...(kind === 'study_review' ? {} : { test: { score: a * 10, out_of: 10, actual_retention: a }, smeared }),
  };
}

/** Two topics: one improving, one lapsing (incl. a smeared exam). */
export function fixtureStore(): Store {
  const topics = [
    { id: 'topic_a', evs: [ev(0, 'study_review', 0), ev(3, 'test_pass', 0.85), ev(9, 'test_pass', 0.92)] },
    { id: 'topic_b', evs: [ev(1, 'study_review', 0), ev(5, 'test_fail', 0.30), ev(8, 'test_fail', 0.20, true)] },
  ];
  const course: Course = {
    schema_version: '3.1.0', course_id: 'course_1', title: 'C',
    created_at: '2026-07-01T00:00:00Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: topics.map((t) => ({
      topic_id: t.id, title: t.id, status: 'practising', conf: 4, strength: 1, k_factor: 8.4,
      cards: 0, last_reviewed: t.evs.at(-1)!.date, mastered_at: null, drift_history: [],
      review_history: t.evs, error_log: [],
    })) }],
  };
  const s = emptyStore(); s.courses.push(course); return s;
}
```

- [ ] **Step 2: Write the harness with failing unit tests**

```ts
// tests/eval/harness.test.ts
import { describe, it, expect } from 'vitest';
import { scoreStore, engineModel, constantModel } from './harness';
import { fixtureStore } from './fixture';

describe('scoreStore', () => {
  it('scores only test events, excludes smeared as targets, keeps them in history', () => {
    const s = fixtureStore();
    const scored = scoreStore(s, engineModel);
    // topic_a: 2 tests; topic_b: 1 non-smeared test (second test is smeared) → 3 targets
    expect(scored.n).toBe(3);
    expect(Number.isFinite(scored.logLoss)).toBe(true); // clamp prevents -Inf
    expect(scored.mae).toBeGreaterThanOrEqual(0);
  });
  it('constant model predicts the mean actual_retention', () => {
    const s = fixtureStore();
    const scored = scoreStore(s, constantModel(s));
    expect(Number.isFinite(scored.mae)).toBe(true);
  });

  it('skips a test with no prior events (first-event exam) instead of scoring R=1', () => {
    const s = fixtureStore();
    const firstEventExam = {
      event_id: 'event_first', date: '2026-06-01T09:00:00Z', kind: 'test_fail' as const,
      source: 'exam' as const, source_id: 'exam_first', confidence_reported: 3,
      test: { score: 1, out_of: 10, actual_retention: 0.1 },
    };
    // Prepend as the topic's very first event.
    s.courses[0].sections[0].topics[0].review_history.unshift(firstEventExam);
    const scored = scoreStore(s, engineModel);
    expect(scored.skipped).toBe(1);
    expect(scored.n).toBe(3); // unchanged — the first-event exam is not scored
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/eval/harness.test.ts`
Expected: FAIL — `./harness` missing.

- [ ] **Step 4: Implement the harness**

```ts
// tests/eval/harness.ts
import { replayEvents } from '@/engine/replay';
import { predictRetention, MS_PER_DAY } from '@/engine/retention';
import { CONFIG } from '@/config/constants';
import { allTopics, type ReviewEvent, type Store, type Topic } from '@/domain/types';

const EPS = 1e-6;
const clamp = (r: number) => Math.min(1 - EPS, Math.max(EPS, r));
const isTest = (e: ReviewEvent) => e.kind === 'test_pass' || e.kind === 'test_fail';

export interface Scored { mae: number; logLoss: number; bernoulli: number; n: number; skipped: number; }

/** Predict R for a topic from prior events only, at time `at`. */
export interface Model { name: string; predict: (topic: Topic, prior: ReviewEvent[], at: Date) => number; }

export const engineModel: Model = {
  name: 'engine',
  predict: (topic, prior, at) => predictRetention(replayEvents(topic, prior), at) ?? 1,
};

/** Rough (uncalibrated) FSRS: R = (1 + F·t/S)^-1; S grows on success, drops on lapse. */
export const fsrsModel: Model = {
  name: 'fsrs-rough',
  predict: (_topic, prior, at) => {
    const F = 19 / 81;
    let S = 0; let last: Date | null = null; let started = false;
    for (const e of prior) {
      const d = new Date(e.date);
      if (!started) { S = 1; started = true; last = d; continue; }
      const t = last ? (d.getTime() - last.getTime()) / MS_PER_DAY : 0;
      const r = S > 0 ? 1 / (1 + (F * t) / S) : 0;
      if (e.kind === 'test_fail') S = Math.max(0.1, S * 0.3);
      else S = S * (1 + Math.E * (0.9 - r)); // reward remembering something nearly-forgotten
      last = d;
    }
    if (!started || !last) return 1;
    const t = (at.getTime() - last.getTime()) / MS_PER_DAY;
    return S > 0 ? 1 / (1 + (F * t) / S) : 0;
  },
};

export function constantModel(store: Store): Model {
  const vals: number[] = [];
  for (const { topic } of allTopics(store))
    for (const e of topic.review_history)
      if (isTest(e) && !e.smeared && e.test) vals.push(e.test.actual_retention);
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.5;
  return { name: 'constant', predict: () => mean };
}

export function scoreStore(store: Store, model: Model): Scored {
  let mae = 0, logLoss = 0, bernoulli = 0, n = 0, skipped = 0;
  for (const { topic } of allTopics(store)) {
    const events = [...topic.review_history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const prior: ReviewEvent[] = [];
    for (const e of events) {
      if (isTest(e) && !e.smeared && e.test) {
        if (prior.length === 0) {
          // No prior evidence — a first-event exam. Scoring a fabricated R=1
          // here would hand every model a guaranteed large error. Skip, count it.
          skipped += 1;
        } else {
          const a = e.test.actual_retention;
          const r = clamp(model.predict(topic, prior, new Date(e.date)));
          mae += Math.abs(r - a);
          logLoss += -(a * Math.log(r) + (1 - a) * Math.log(1 - r));
          const o = a >= CONFIG.TEST_PASS_MARK ? 1 : 0;
          bernoulli += -(o * Math.log(r) + (1 - o) * Math.log(1 - r));
          n += 1;
        }
      }
      prior.push(e); // smeared / skipped events still stay in history
    }
  }
  return n === 0 ? { mae: 0, logLoss: 0, bernoulli: 0, n: 0, skipped }
    : { mae: mae / n, logLoss: logLoss / n, bernoulli: bernoulli / n, n, skipped };
}
```

- [ ] **Step 5: Run unit tests to green**

Run: `npx vitest run tests/eval/harness.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the runner (skipped without a real store)**

```ts
// tests/eval/harness.eval.ts
import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { scoreStore, engineModel, fsrsModel, constantModel } from './harness';
import type { Store } from '@/domain/types';

const path = process.env.EVAL_STORE;

describe.skipIf(!path)('retention model eval (set EVAL_STORE to an exported bundle)', () => {
  it('prints the model comparison table', () => {
    const raw = JSON.parse(readFileSync(path!, 'utf8'));
    const store: Store = raw.store ?? raw;
    const models = [engineModel, fsrsModel, constantModel(store)];
    // eslint-disable-next-line no-console
    console.log('\nmodel            n     skip  MAE      logLoss  bernoulli');
    for (const m of models) {
      const s = scoreStore(store, m);
      // eslint-disable-next-line no-console
      console.log(
        `${m.name.padEnd(15)} ${String(s.n).padEnd(5)} ${String(s.skipped).padEnd(5)} ${s.mae.toFixed(4)}  ${s.logLoss.toFixed(4)}  ${s.bernoulli.toFixed(4)}`,
      );
    }
  });
});
```

- [ ] **Step 7: Create the accreting results doc and record the baseline row**

The results doc is created **now**, not at Task 11, so each checkpoint's engine row is git-anchored to the commit that produced it rather than carried across subagent handoffs in a scratch note.

Run (PowerShell; bash form: `EVAL_STORE=... npx vitest ...`):
```powershell
# Export a real store from Settings → save as bundle.json, then:
$env:EVAL_STORE = 'C:\path\to\bundle.json'; npx vitest run tests/eval/harness.eval.ts
```
Expected: prints the table. Create `docs/superpowers/specs/2026-08-09-retention-eval-results.md`:

```markdown
# Retention Model Eval — Results (2026-08-09)

Store: <bundle name / N topics / M scored test events / K skipped (first-event exams)>.
Smeared events excluded as targets. Decision rule: with fewer than ~50 scored events (`n`),
the table cannot separate these models — record "insufficient data, decision deferred."

| Model            | commit | n | skip | MAE | log-loss (soft) | Bernoulli |
|------------------|--------|---|------|-----|-----------------|-----------|
| baseline         | <sha>  |   |      |     |                 |           |
```

Fill the `baseline` row from the `engine` row of this run and put the current commit sha in `commit`.
If no real store exists yet, point `EVAL_STORE` at a bundle written from `fixtureStore()`, note `n = 3`
(smoke only), and mark every downstream decision provisional.

- [ ] **Step 8: Confirm the eval file is skipped in the normal suite**

Run: `npm test`
Expected: PASS; `harness.eval.ts` reports skipped (no `EVAL_STORE`).

- [ ] **Step 9: Commit**

```bash
git add tests/eval/ docs/superpowers/specs/2026-08-09-retention-eval-results.md
git commit -m "feat(eval): offline retention scorer + baseline row (harness skipped by default)"
```

---

## Task 5: New constants (Phase C)

**Files:**
- Modify: `src/config/constants.ts`
- Test: covered by Task 6's `penaltyFrom` tests (fold into that task's verification).

**Interfaces:**
- Produces: `CONFIG.S_EFF_MIN`, `LAPSE_RECOVERY`, `PENALTY_FLOOR`, `SMEAR_PENALTY_WEIGHT`, `TEST_GAIN_MIN`, `TEST_GAIN_AT_PASS_MARK`, `TEST_GAIN_MAX`.

- [ ] **Step 1: Add the constants**

In `src/config/constants.ts`, after `STRENGTH_GAIN`:

```ts
  /** Lapse penalty & effective stability (design 2026-08-09 §2.6). Harness-tuned. */
  S_EFF_MIN: 0.25,
  LAPSE_RECOVERY: 1.25,
  PENALTY_FLOOR: 0.4,
  /** Weight on a smeared exam's penalty deviation (1.0 = full penalty). Not
   *  harness-tunable — smeared events are excluded as scoring targets. */
  SMEAR_PENALTY_WEIGHT: 1.0,
  /** Continuous test strength-gain anchors (§2.4). Unchanged at the 0.80 mark. */
  TEST_GAIN_MIN: 0.15,
  TEST_GAIN_AT_PASS_MARK: 1.5,
  TEST_GAIN_MAX: 2.0,
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/config/constants.ts
git commit -m "feat(config): lapse-penalty and continuous-gain constants"
```

---

## Task 6: Lapse fold, `s_eff`, and `predictRetention` wiring (#1) + drift-order regression

**Files:**
- Create: `src/engine/stability.ts`
- Modify: `src/engine/retention.ts`
- Test: `tests/engine/stability.test.ts` *(new)*, add to `tests/engine/retention.test.ts` and `tests/engine/recalculate.test.ts`

**Interfaces:**
- Produces: `penaltyFrom(a: number): number`; `lapseFactor(events: readonly ReviewEvent[]): number`; `effectiveStrength(topic: Topic): number`.
- Consumes: `CONFIG` (Task 5), `ReviewEvent`/`Topic` types.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/stability.test.ts
import { describe, it, expect } from 'vitest';
import { penaltyFrom, lapseFactor, effectiveStrength } from '@/engine/stability';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

const failEv = (a: number, smeared = false): ReviewEvent => ({
  event_id: 'event_f', date: '2026-08-01T09:00:00Z', kind: 'test_fail', source: 'exam',
  source_id: 'exam_1', confidence_reported: 3, test: { score: a * 10, out_of: 10, actual_retention: a }, smeared,
});
const passEv = (): ReviewEvent => ({
  event_id: 'event_p', date: '2026-08-02T09:00:00Z', kind: 'test_pass', source: 'exam',
  source_id: 'exam_2', confidence_reported: 5, test: { score: 10, out_of: 10, actual_retention: 1 },
});

describe('penaltyFrom', () => {
  it('is 1.0 at the pass mark and PENALTY_FLOOR at 0, and monotonic', () => {
    expect(penaltyFrom(CONFIG.TEST_PASS_MARK)).toBeCloseTo(1, 6);
    expect(penaltyFrom(0)).toBeCloseTo(CONFIG.PENALTY_FLOOR, 6);
    expect(penaltyFrom(0.4)).toBeGreaterThan(penaltyFrom(0.2));
  });
});

describe('lapseFactor', () => {
  it('is 1 with no fails', () => expect(lapseFactor([passEv()])).toBe(1));
  it('a hard fail then one pass leaves P = FLOOR*RECOVERY < 1', () => {
    const P = lapseFactor([failEv(0), passEv()]);
    expect(P).toBeCloseTo(CONFIG.PENALTY_FLOOR * CONFIG.LAPSE_RECOVERY, 6);
    expect(P).toBeLessThan(1);
  });
  it('pins the recovery crossover: penaltyFrom(0.533)*RECOVERY ≈ 1 (§2.5)', () => {
    // Below this actual_retention a single pass cannot fully erase the fail;
    // above it, it can. Pinned so re-tuning PENALTY_FLOOR/LAPSE_RECOVERY shows up.
    expect(penaltyFrom(0.533) * CONFIG.LAPSE_RECOVERY).toBeCloseTo(1, 2);
  });
  it('smeared fail is weighted toward 1 (no-op at weight 1.0 = same as non-smeared)', () => {
    expect(lapseFactor([failEv(0.3, true)])).toBeCloseTo(lapseFactor([failEv(0.3, false)]), 6);
  });
});

describe('effectiveStrength', () => {
  const topic = (over: Partial<Topic>): Topic => ({
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 3, strength: 3, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-01T00:00:00Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...over,
  });
  it('floors at S_EFF_MIN for a fully-lapsed topic', () => {
    const t = topic({ strength: 0.3, review_history: [failEv(0), failEv(0)] });
    expect(effectiveStrength(t)).toBe(CONFIG.S_EFF_MIN);
  });
  it('equals raw strength when unlapsed', () => {
    expect(effectiveStrength(topic({ strength: 3, review_history: [passEv()] }))).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/engine/stability.test.ts`
Expected: FAIL — `@/engine/stability` missing.

- [ ] **Step 3: Implement `stability.ts`**

```ts
// src/engine/stability.ts
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

/**
 * The lapse fold (design 2026-08-09 §2.2–2.3). Derived, never stored. Kept in
 * its own module (CONFIG + types only) so retention can read it without the
 * retention → replay → recalculate → retention import cycle.
 */

/** Continuous fail penalty: 1.0 at the pass mark → PENALTY_FLOOR at 0. */
export function penaltyFrom(actualRetention: number): number {
  const floor = CONFIG.PENALTY_FLOOR;
  const p = floor + (1 - floor) * (actualRetention / CONFIG.TEST_PASS_MARK);
  return Math.min(1, Math.max(floor, p));
}

/** Multiplicative P over ordered events. Fails penalise (smeared → dampened);
 *  passes recover asymmetrically, capped at 1. */
export function lapseFactor(events: readonly ReviewEvent[]): number {
  let P = 1;
  for (const e of events) {
    if (e.kind === 'test_fail' && e.test) {
      let pen = penaltyFrom(e.test.actual_retention);
      if (e.smeared) pen = 1 - (1 - pen) * CONFIG.SMEAR_PENALTY_WEIGHT;
      P *= pen;
    } else if (e.kind === 'test_pass') {
      P = Math.min(1, P * CONFIG.LAPSE_RECOVERY);
    }
  }
  return P;
}

const memo = new WeakMap<ReviewEvent[], number>();

/** s_eff = max(S_EFF_MIN, strength · P). Memoised on the review_history array
 *  reference (a fresh array on every immutable topic update). */
export function effectiveStrength(topic: Topic): number {
  let P = memo.get(topic.review_history);
  if (P === undefined) {
    P = lapseFactor(topic.review_history);
    memo.set(topic.review_history, P);
  }
  return Math.max(CONFIG.S_EFF_MIN, topic.strength * P);
}
```

- [ ] **Step 4: Run stability tests to green**

Run: `npx vitest run tests/engine/stability.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `predictRetention` onto `s_eff` — failing test first**

```ts
// add to tests/engine/retention.test.ts
import { effectiveStrength } from '@/engine/stability';

it('retention uses effective strength, so a fail shortens the curve', () => {
  const failEv = {
    event_id: 'event_f', date: '2026-08-05T09:00:00Z', kind: 'test_fail' as const, source: 'exam' as const,
    source_id: 'exam_1', confidence_reported: 3, test: { score: 1, out_of: 10, actual_retention: 0.1 },
  };
  const reviewed = new Date('2026-08-05T09:00:00Z');
  const now = new Date('2026-08-08T09:00:00Z');
  const lapsed = topic({ strength: 3, last_reviewed: reviewed.toISOString(), review_history: [failEv] });
  const solid = topic({ strength: 3, last_reviewed: reviewed.toISOString(), review_history: [] });
  expect(predictRetention(lapsed, now)!).toBeLessThan(predictRetention(solid, now)!);
});
```

Run: `npx vitest run tests/engine/retention.test.ts -t "effective strength"`
Expected: FAIL (both equal — retention still reads raw strength).

- [ ] **Step 6: Use `effectiveStrength` in `predictRetention`**

In `src/engine/retention.ts`, import `effectiveStrength` from `./stability` and replace the strength usages:

```ts
  const s = effectiveStrength(topic);
  if (s <= 0) return 0;

  const t = elapsedDays(reviewed, now);
  if (t <= 0) return 1;

  return Math.exp(-t / (topic.k_factor * s));
```

(Delete the earlier `if (topic.strength <= 0) return 0;` line — `s` replaces it.)

- [ ] **Step 7: Run to green**

Run: `npx vitest run tests/engine/retention.test.ts`
Expected: PASS.

- [ ] **Step 8: Pin the drift-order invariant (regression test)**

```ts
// add to tests/engine/recalculate.test.ts
import { predictRetention } from '@/engine/retention';

it('drift is scored against the curve BEFORE the event lands (excludes its own penalty)', () => {
  const before = baseTopic({ strength: 3, review_history: [], drift_history: [] });
  const rBefore = predictRetention(before, new Date('2026-08-08T09:00:00Z'))!;
  const after = applyEvent(before, testEvent({ smeared: false, test: { score: 3, out_of: 10, actual_retention: 0.3 } }));
  const pushed = after.drift_history.at(-1)!;
  expect(pushed).toBeCloseTo(0.3 - rBefore, 6); // NOT 0.3 - R(after the fail)
});
```

Run: `npx vitest run tests/engine/recalculate.test.ts -t "before the event lands"`
Expected: PASS (guards a future refactor to `next`).

- [ ] **Step 9: Run full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 10: Commit the engine change**

```bash
git add src/engine/stability.ts src/engine/retention.ts tests/engine/stability.test.ts tests/engine/retention.test.ts tests/engine/recalculate.test.ts
git commit -m "feat(retention): lapse-penalised effective stability (#1)"
```

- [ ] **Step 11: Append the `#1` row to the results doc**

Re-run the harness against your bundle (Task 4 Step 7 command). Append the `engine` row to `docs/superpowers/specs/2026-08-09-retention-eval-results.md` as `#1 (penalty)` with this commit's sha, then commit:

```bash
git add docs/superpowers/specs/2026-08-09-retention-eval-results.md
git commit -m "docs(eval): record #1 (penalty) row"
```

(If no real bundle: skip the harness run, leave the `#1` row blank, and note it deferred.)

---

## Task 7: `projectedDue` reads `s_eff`

**Files:**
- Modify: `src/engine/retention.ts`
- Test: add to `tests/engine/retention.test.ts`

**Interfaces:**
- Consumes: `effectiveStrength` (Task 6).

- [ ] **Step 1: Failing test**

```ts
// add to tests/engine/retention.test.ts
import { projectedDue } from '@/engine/retention';

it('projectedDue moves earlier after a fail (uses s_eff, not raw strength)', () => {
  const reviewed = '2026-08-05T09:00:00Z';
  const failEv = {
    event_id: 'event_f', date: reviewed, kind: 'test_fail' as const, source: 'exam' as const,
    source_id: 'exam_1', confidence_reported: 3, test: { score: 1, out_of: 10, actual_retention: 0.1 },
  };
  const now = new Date('2026-08-05T10:00:00Z');
  const lapsed = topic({ strength: 3, last_reviewed: reviewed, review_history: [failEv] });
  const solid = topic({ strength: 3, last_reviewed: reviewed, review_history: [] });
  expect(projectedDue(lapsed, now)!.date.getTime()).toBeLessThan(projectedDue(solid, now)!.date.getTime());
});
```

Run: `npx vitest run tests/engine/retention.test.ts -t "projectedDue moves earlier"`
Expected: FAIL (equal — still raw strength).

- [ ] **Step 2: Implement**

In `projectedDue`, replace the guard + `tDue`:

```ts
  const s = effectiveStrength(topic);
  if (s <= 0) return null;
  // ...
  const tDue = -topic.k_factor * s * Math.log(CONFIG.DUE_THRESHOLD);
```

- [ ] **Step 3: Green + suite**

Run: `npx vitest run tests/engine/retention.test.ts && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/retention.ts tests/engine/retention.test.ts
git commit -m "feat(retention): projectedDue uses effective stability so fails resurface"
```

---

## Task 8: `retentionSeries` onto forward replay (retire the subtraction path)

**Files:**
- Modify: `src/engine/history.ts`
- Test: `tests/engine/history.test.ts` *(new)*

**Interfaces:**
- Consumes: `topicStateAsOf` (Task 3), `predictRetention`.
- Removes: `topicAsOf`, `replayStrength`, `incrementOf` (local, now dead).

- [ ] **Step 1: Failing test — the pre-fail point is identical with and without the future fail**

This is the property that actually matters. Comparing two days of one series conflates the penalty with recency (the later day is closer to its review and has higher raw strength); comparing the *same* pre-fail day across two histories isolates leakage cleanly.

```ts
// tests/engine/history.test.ts
import { describe, it, expect } from 'vitest';
import { retentionSeries } from '@/engine/history';
import type { Course, ReviewEvent } from '@/domain/types';

const study: ReviewEvent = {
  event_id: 'event_s', date: '2026-08-01T09:00:00Z', kind: 'study_review',
  source: 'session', source_id: 'session_1', confidence_reported: 4,
};
const lateFail: ReviewEvent = {
  event_id: 'event_f', date: '2026-08-09T09:00:00Z', kind: 'test_fail', source: 'exam',
  source_id: 'exam_1', confidence_reported: 3, test: { score: 1, out_of: 10, actual_retention: 0.1 },
};

function course(history: ReviewEvent[]): Course {
  return {
    schema_version: '3.1.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00Z',
    source: 'manual', sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: 'topic_a', title: 'T', status: 'practising', conf: 4, strength: 2, k_factor: 8.4,
      cards: 0, last_reviewed: history.at(-1)!.date, mastered_at: null, drift_history: [],
      review_history: history, error_log: [],
    }] }],
  };
}

it('the Aug 3 point is identical whether or not an Aug 9 fail exists (no future leakage)', () => {
  const now = new Date('2026-08-10T09:00:00Z');
  const withoutFail = retentionSeries(course([study]), 10, now);
  const withFail = retentionSeries(course([study, lateFail]), 10, now);
  const aug3 = (s: typeof withFail) => s.find((p) => p.date.toISOString().startsWith('2026-08-03'))!.value;
  expect(aug3(withFail)).toBe(aug3(withoutFail));
});
```

Run: `npx vitest run tests/engine/history.test.ts`
Expected: FAIL — current `topicAsOf` keeps the full history, so the Aug 3 point in `withFail` carries the Aug 9 fail's penalty retroactively and differs from `withoutFail`.

- [ ] **Step 2: Rewrite the series to forward replay; delete the subtraction path**

In `src/engine/history.ts`, remove `topicAsOf`, `replayStrength`, `incrementOf`, and the `CONFIG` import if now unused. Replace the loop body in `retentionSeries`:

```ts
import { topicStateAsOf } from './replay';
// ...
for (const { topic } of refs) {
  const past = topicStateAsOf(topic, date);
  if (past.last_reviewed === null) continue; // no events by this date
  const r = predictRetention(past, date);
  if (r !== null) values.push(r);
}
```

(`activitySeries` is unchanged.)

- [ ] **Step 3: Green + suite + typecheck**

Run: `npx vitest run tests/engine/history.test.ts && npm test && npm run typecheck`
Expected: PASS (typecheck confirms no dangling references to the deleted helpers).

- [ ] **Step 4: Commit**

```bash
git add src/engine/history.ts tests/engine/history.test.ts
git commit -m "refactor(history): retentionSeries via forward replay, no future leakage"
```

---

## Task 9: Continuous test strength-gain (#7)

**Files:**
- Modify: `src/engine/recalculate.ts` (`strengthIncrement`, `applyEvent` call site)
- Test: add to `tests/engine/recalculate.test.ts`; update `tests/engine/worked-example.test.ts` and any strength assertions in `tests/engine/engine.test.ts`

**Interfaces:**
- Produces: `strengthIncrement(event: ReviewEvent): number` (signature change from `(kind, confidence)`).

- [ ] **Step 1: Failing tests**

```ts
// add to tests/engine/recalculate.test.ts
import { strengthIncrement } from '@/engine/recalculate';
import { CONFIG } from '@/config/constants';

const test = (a: number): ReviewEvent => ({
  event_id: 'event_t', date: '2026-08-08T09:00:00Z', kind: a >= CONFIG.TEST_PASS_MARK ? 'test_pass' : 'test_fail',
  source: 'exam', source_id: 'exam_1', confidence_reported: 4,
  test: { score: a * 10, out_of: 10, actual_retention: a },
});

describe('continuous test gain', () => {
  it('is unchanged at the 0.80 mark', () =>
    expect(strengthIncrement(test(0.8))).toBeCloseTo(CONFIG.TEST_GAIN_AT_PASS_MARK, 6));
  it('is TEST_GAIN_MIN at 0 and TEST_GAIN_MAX at 1', () => {
    expect(strengthIncrement(test(0))).toBeCloseTo(CONFIG.TEST_GAIN_MIN, 6);
    expect(strengthIncrement(test(1))).toBeCloseTo(CONFIG.TEST_GAIN_MAX, 6);
  });
  it('is monotonic across the mark', () =>
    expect(strengthIncrement(test(0.85))).toBeGreaterThan(strengthIncrement(test(0.75))));
  it('study_review is unchanged (confidence buckets)', () =>
    expect(strengthIncrement({ ...test(0), kind: 'study_review', test: undefined })).toBe(CONFIG.STRENGTH_GAIN.CONF_HIGH));
});
```

Run: `npx vitest run tests/engine/recalculate.test.ts -t "continuous test gain"`
Expected: FAIL — `strengthIncrement` still takes `(kind, confidence)`.

- [ ] **Step 2: Implement the new signature**

In `src/engine/recalculate.ts`:

```ts
export function strengthIncrement(event: ReviewEvent): number {
  const g = CONFIG.STRENGTH_GAIN;
  if (event.kind === 'study_review') {
    const c = event.confidence_reported;
    if (c <= 2) return g.CONF_LOW;
    if (c === 3) return g.CONF_MID;
    return g.CONF_HIGH;
  }
  // test_pass / test_fail — continuous in actual_retention, anchored at the mark.
  const a = event.test!.actual_retention;
  const mark = CONFIG.TEST_PASS_MARK;
  return a <= mark
    ? CONFIG.TEST_GAIN_MIN + (CONFIG.TEST_GAIN_AT_PASS_MARK - CONFIG.TEST_GAIN_MIN) * (a / mark)
    : CONFIG.TEST_GAIN_AT_PASS_MARK +
        (CONFIG.TEST_GAIN_MAX - CONFIG.TEST_GAIN_AT_PASS_MARK) * ((a - mark) / (1 - mark));
}
```

Update the call site (`applyEvent`, ~line 86):

```ts
  next.strength = topic.strength + strengthIncrement(event);
```

Drop the now-unused `Confidence` import if it is no longer referenced.

- [ ] **Step 3: Green (unit)**

Run: `npx vitest run tests/engine/recalculate.test.ts`
Expected: PASS.

- [ ] **Step 4: Update fixtures that asserted the old flat 1.5 / 0.15**

Run: `npm test`
For each failing strength/health assertion in `tests/engine/worked-example.test.ts` and `tests/engine/engine.test.ts`, recompute the expected value with the formula above. Example: a test at 11/20 → `a = 0.55 ≤ 0.80` → gain `= 0.15 + (1.5 − 0.15)·(0.55/0.80) = 1.078` (was `1.5` for a pass or `0.15` for a fail). Update expected strengths (and any health values that depend on them) to the recomputed numbers — do not weaken the assertions.

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit the engine change**

```bash
git add src/engine/recalculate.ts tests/engine/recalculate.test.ts tests/engine/worked-example.test.ts tests/engine/engine.test.ts
git commit -m "feat(engine): continuous test strength-gain, anchored at the pass mark (#7)"
```

- [ ] **Step 7: Append the `#1+continuous` row to the results doc**

Re-run the harness against your bundle. Append the `engine` row as `#1 + continuous` with this commit's sha, then commit:

```bash
git add docs/superpowers/specs/2026-08-09-retention-eval-results.md
git commit -m "docs(eval): record #1+continuous row"
```

(If no real bundle: leave the row blank, note deferred.)

---

## Task 10: Badge-firing-rate guard (harness is blind to it)

**Files:**
- Test: `tests/engine/badges-firing.test.ts` *(new)*

**Interfaces:**
- Consumes: `badges` (`src/engine/metrics.ts`), `applyEvent`.

- [ ] **Step 1: Write the characterization test**

```ts
// tests/engine/badges-firing.test.ts
import { describe, it, expect } from 'vitest';
import { badges } from '@/engine/metrics';
import { applyEvent } from '@/engine/recalculate';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

function build(events: ReviewEvent[]): Topic {
  let t: Topic = {
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 4, strength: 0, k_factor: CONFIG.DECAY_K,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [],
  };
  for (const e of events) t = applyEvent(t, e, new Date(e.date));
  return t;
}
const study = (i: number, c: 1|2|3|4|5): ReviewEvent => ({
  event_id: `event_s${i}`, date: `2026-08-0${i + 1}T09:00:00Z`, kind: 'study_review',
  source: 'session', source_id: `session_${i}`, confidence_reported: c,
});
const pass = (i: number, a: number): ReviewEvent => ({
  event_id: `event_p${i}`, date: `2026-08-0${i + 1}T09:00:00Z`, kind: 'test_pass',
  source: 'exam', source_id: `exam_${i}`, confidence_reported: 4,
  test: { score: a * 10, out_of: 10, actual_retention: a },
});

describe('badge firing under continuous gain (documents the intended rates)', () => {
  it('a near-miss pass no longer reads as slow growth', () => {
    // 3 confident studies + one 82% pass → velocity high enough to clear SLOW_V
    const t = build([study(0, 4), study(1, 4), study(2, 4), pass(3, 0.82)]);
    const ids = badges(t).map((b) => b.id);
    expect(ids).not.toContain('slow_growth');
    expect(ids).toContain('ready_to_test');
  });
});
```

- [ ] **Step 2: Run — it should PASS on the post-#7 engine**

Run: `npx vitest run tests/engine/badges-firing.test.ts`
Expected: PASS. If it fails, the continuous-gain change moved a threshold unexpectedly — investigate before proceeding (this is the guard's whole purpose). Adjust the fixture only if the behavior is intended and documented.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/badges-firing.test.ts
git commit -m "test(engine): pin badge firing under continuous gain"
```

---

## Task 11: FSRS/constant rows + model decision (Phase D)

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-retention-eval-results.md` (created in Task 4; `baseline`/`#1`/`#1+continuous` rows already appended in Tasks 4/6/9)

**Interfaces:**
- Consumes: the three `engine` rows already committed to the doc, plus `fsrs-rough` and `constant` from a HEAD run.

- [ ] **Step 1: Run the harness at HEAD for the FSRS + constant rows**

Run:
```powershell
$env:EVAL_STORE = 'C:\path\to\bundle.json'; npx vitest run tests/eval/harness.eval.ts
```
Expected: prints the table. The `engine` row here equals the `#1+continuous` row already in the doc; `fsrs-rough` and `constant` are git-state-independent, so read them from this run. Note the `skip` count — a high skip fraction means much of the store is first-event exams and the effective evidence is smaller than the topic count suggests.

- [ ] **Step 2: Append the FSRS + constant rows and write the decision**

Append to `docs/superpowers/specs/2026-08-09-retention-eval-results.md` so the completed table reads:

```markdown
| Model            | commit | n | skip | MAE | log-loss (soft) | Bernoulli |
|------------------|--------|---|------|-----|-----------------|-----------|
| constant (mean)  | <sha>  |   |      |     |       —         |     —     |
| baseline         | <sha>  |   |      |     |                 |           |
| #1 (penalty)     | <sha>  |   |      |     |                 |           |
| #1 + continuous  | <sha>  |   |      |     |                 |           |
| fsrs-rough       | <sha>  |   |      |     |                 |           |

**Decision:** <#1 / #1+continuous / pursue FSRS / DEFERRED>.

- **Data-sufficiency gate (apply first):** if `n < ~50` scored events, record
  **"insufficient data — decision deferred"** and stop. The synthetic fixture yields `n = 3`;
  that is a smoke test for the scorer, not evidence about the model. Do **not** rationalise a pick.
- **If n is sufficient:** did #1(+continuous) close most of the gap from `baseline` to `fsrs-rough`
  on MAE/log-loss? If yes, ship it; file FSRS as a follow-up only if the residual gap is material.
  `fsrs-rough` is uncalibrated — a floor on what a tuned FSRS could reach, not a verdict.

**Tuning notes (only with sufficient real data):** adjustments to `penaltyFrom` shape / `TEST_GAIN_*`
/ `LAPSE_RECOVERY` / `PENALTY_FLOOR` / `S_EFF_MIN` suggested by the numbers. **Never tune any constant
against the fixture** — that is fitting to invented data. (`SMEAR_PENALTY_WEIGHT` is not tunable here at all.)
```

If a larger evaluation is needed before real exams accumulate, a synthetic *generative* store (a learner model with known ground truth, sampled from a **non-exponential** curve — FSRS-ish or a mixture — so the test isn't "an exponential model recovers exponential data") is a follow-up, not part of this plan.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-09-retention-eval-results.md
git commit -m "docs(eval): FSRS/constant rows and model decision"
```

---

## Self-Review

**Spec coverage:**
- §1 lapse penalty / `s_eff` → Tasks 5, 6 (fold, `effectiveStrength`, `predictRetention`).
- §2.2 smeared included in fold (weighted, not skipped) + fan-out `fanout` stamped → Task 6 (`lapseFactor`), Task 2 (ingestion stamp), Task 3 (backfill).
- §2.4 continuous gain, anchored at mark → Task 9.
- §2.5 recovery invariant on `P` + sharp crossover pin (`a≈0.533`); `s_eff` overshoot gated on maturity → Task 6 tests (hard-fail `P`, crossover pin, `effectiveStrength` floor).
- §3 plug-ins: `predictRetention` (T6), `projectedDue` (T7), `history.ts` consolidation (T8), drift-order regression (T6 Step 8), `topicVelocity` untouched (no task modifies it). ✔
- §3.2 shared forward-k → Task 3 `replayEvents`, reused by migration + harness.
- §4 #6 live rule + recompute on load & import + unresolved→smeared + resolution counts → Tasks 2, 3.
- §5 fractional `t` → Task 1.
- §6 harness: soft + Bernoulli, `[ε,1−ε]` clamp, constant baseline, empty-prior skip, smeared excluded-as-target/kept-in-history → Task 4.
- §7 sequencing (day-nit+#6 → baseline → #1+#7) → Task order 1-3, 4, 5-9. ✔
- §8 tests: drift-order (T6), penaltyFrom endpoints (T6), crossover pin (T6), `s_eff` floor (T6), P-invariant at hard fail (T6), maturity-gated overshoot (T6), badge-firing (T10), migration idempotent + on-import + **preserves legitimate tuning** (T3), harness prior-only + clamp + skip (T4). ✔

**Placeholder scan:** No TBD/TODO; every code step has real code. The two "update existing fixtures" steps (Task 1 Step 6, Task 9 Step 4) give the exact formula and a worked conversion rather than "fix the tests."

**Type consistency:** `replayEvents(topic, events)`, `effectiveStrength(topic)`, `lapseFactor(events)`, `penaltyFrom(a)`, `strengthIncrement(event)`, `examTopicSmeared(exam, topicId)`, `recomputeLapseContamination(store): RecomputeCounts`, `scoreStore(store, model): Scored{…,skipped}`, `Model.predict(topic, prior, at)` — names and signatures match across their producing and consuming tasks. Constant is `SMEAR_PENALTY_WEIGHT` (not `_DAMPING`) everywhere.

**Blind-spot guards added (review round 2):** migration `PRESERVES legitimate tuning` test + `unresolved` count (distinguishes purge from wipe); Task 8 tests the pre-fail point is *identical* with/without the future fail (isolates leakage from recency); Task 2 drift assertion is `toBe(+1)`; harness skips empty-prior targets.

**Note on `#1`-alone vs `#1+continuous`:** both are captured as git checkpoints (harness re-run + results-doc row appended at Tasks 6 and 9), not runtime flags — no model-selection code ships in the app. The results doc accretes per checkpoint rather than being assembled from a scratch note.
