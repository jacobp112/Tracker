# Performance Metrics — Phase 6: Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove — rather than assert — the branch's load-bearing invariants: that the Performance layer is byte-for-byte read-side-only against the existing knowledge metrics, that historical (pre-assessment) data flows through untouched, that the brief's Learner A vs Learner B success criterion holds end-to-end, and that no subject-specific assumption leaked into the generic model.

**Architecture:** Tests only. No production code should change. Each task is a validation test that is expected to **pass on first run** — a failure is a genuine finding (a real leak or regression) to investigate and fix, not a red-to-green TDD step. If any task's test fails, stop and escalate the finding rather than weakening the test.

**Tech Stack:** TypeScript 5.6, Vitest 2.1.4, `node:fs` (for the naming sweep).

## Global Constraints

- **Tests-only phase.** Do not modify `src/` to make a test pass. If a validation test fails, the invariant is genuinely broken — report it; the fix is a separate, deliberate change, not a test weakening.
- **Byte-for-byte where claimed.** The read-side-only proof (Task 1) compares full serialized snapshots (`JSON.stringify` deep equality), not spot checks.
- **Honest thresholds.** The Learner A/B test (Task 3) asserts the *direction and coexistence* the brief specifies (A's raw accuracy higher AND B's Performance Health higher), using generous margins — it must not become brittle to a weight tweak.
- **Baseline is NOT fully green.** 18 pre-existing UI failures in `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. Verify against `npm run typecheck` + `tests/engine tests/domain tests/core` (green); treat `npm test` as "same 3 files failing, nothing new."
- **Naming:** subject-agnostic (Task 4 enforces this on the new modules).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `tests/engine/read-side-only.test.ts` | Stripping assessment/prerequisites leaves every existing metric identical. | Create (Task 1). |
| `tests/engine/historical-events.test.ts` | Pre-assessment data: knowledge metrics work; performance metrics degrade gracefully. | Create (Task 2). |
| `tests/engine/learner-ab.test.ts` | The brief's success criterion, asserted end-to-end. | Create (Task 3). |
| `tests/engine/generic-naming.test.ts` | No subject-specific vocabulary in the new modules' code. | Create (Task 4). |

No `src/` changes expected.

---

## Task 1: Read-side-only golden test (byte-for-byte)

Prove the assessment/prerequisites additions change **no** existing knowledge metric, by comparing a full derived-metrics snapshot of a rich store against the same store with every `assessment` block and `prerequisites` list stripped.

**Files:**
- Test: `tests/engine/read-side-only.test.ts`

**Interfaces:**
- Consumes: `allTopics` (`@/domain/types`); `predictRetention`, `projectedDue` (`@/engine/retention`); `health`, `overconfidenceIndex`, `badges`, `topicVelocity` (`@/engine/metrics`); `topicLevel`, `topicLevelHighWater`, `overallLevel` (`@/engine/leveling`); `globalHealth`, `overallMastery`, `studyStreak`, `weeklyVolume`, `globalDueQueue`, `allCourseRefs` (`@/engine/overview`); `courseHealth`, `weakTopics` (`@/engine/course`); `retrievable` (`@/engine/progress`).

- [ ] **Step 1: Write the test**

Create `tests/engine/read-side-only.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allTopics, type ReviewEvent, type Store, type Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';
import { predictRetention, projectedDue } from '@/engine/retention';
import { health, overconfidenceIndex, badges, topicVelocity } from '@/engine/metrics';
import { topicLevel, topicLevelHighWater, overallLevel } from '@/engine/leveling';
import { globalHealth, overallMastery, studyStreak, weeklyVolume, globalDueQueue, allCourseRefs } from '@/engine/overview';
import { courseHealth, weakTopics } from '@/engine/course';
import { retrievable } from '@/engine/progress';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const iso = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

let seq = 0;
function ev(over: Partial<ReviewEvent> & { day: number }): ReviewEvent {
  seq += 1;
  const { day, ...rest } = over;
  return {
    event_id: `event_${seq}`, date: iso(day), kind: 'study_review',
    source: 'session', source_id: `src_${seq}`, confidence_reported: 4, ...rest,
  } as ReviewEvent;
}

/** A store exercising retention, tests (OCI/level), errors, sessions (streak/volume),
 *  AND assessment blocks + prerequisites on top — the fields Phase 1–5 added. */
function richStore(): Store {
  const t1: Topic = {
    topic_id: 'topic_1', title: 'One', status: 'mastered', conf: 5, strength: 8,
    k_factor: 8.4, cards: 4, last_reviewed: iso(2), mastered_at: iso(20), drift_history: [0.1, -0.05],
    prerequisites: ['topic_2'],
    review_history: [
      ev({ day: 20, kind: 'test_pass', source: 'exam', test: { score: 9, out_of: 10, actual_retention: 0.9 },
        assessment: { difficulty: 4, novelty: 3, independence: 3, transfer_level: 3, performance_quality: 5, cold: true, predicted_success: 0.8, predicted_at: iso(21) } }),
      ev({ day: 10, kind: 'study_review', source: 'session', confidence_reported: 5,
        assessment: { difficulty: 3, independence: 2, performance_quality: 4 } }),
      ev({ day: 2, kind: 'test_fail', source: 'exam', confidence_reported: 3, test: { score: 5, out_of: 10, actual_retention: 0.5 },
        assessment: { difficulty: 5, novelty: 4, independence: 3 } }),
    ],
    error_log: [
      { error_id: 'error_1', date: iso(2), source: 'exam', source_id: 'src_x', error_type: 'conceptual', description: 'x', resolved: false, resolved_date: null },
    ],
  };
  const t2: Topic = {
    topic_id: 'topic_2', title: 'Two', status: 'practising', conf: 3, strength: 2,
    k_factor: 8.4, cards: 1, last_reviewed: iso(6), mastered_at: null, drift_history: [],
    review_history: [
      ev({ day: 6, kind: 'study_review', source: 'session', confidence_reported: 3 }),
    ],
    error_log: [],
  };
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C', created_at: iso(40), source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [t1, t2] }],
  });
  return s;
}

/** Deep-clone the store, then remove every added field (assessment on events,
 *  prerequisites on topics). The result is a "pre-Performance-layer" store. */
function stripAdditions(store: Store): Store {
  const clone: Store = structuredClone(store);
  for (const { topic } of allTopics(clone)) {
    delete (topic as { prerequisites?: unknown }).prerequisites;
    for (const e of topic.review_history) delete (e as { assessment?: unknown }).assessment;
  }
  return clone;
}

/** Serialize every existing knowledge/retention/level/aggregate metric. */
function knowledgeSnapshot(store: Store): string {
  const refs = allCourseRefs(store);
  return JSON.stringify({
    perTopic: allTopics(store).map(({ topic }) => ({
      id: topic.topic_id,
      retention: predictRetention(topic, NOW),
      due: projectedDue(topic, NOW)?.date.toISOString() ?? null,
      health: health(topic, NOW),
      oci: overconfidenceIndex(topic),
      velocity: topicVelocity(topic),
      level: topicLevel(topic, NOW),
      highWater: topicLevelHighWater(topic, NOW),
      badges: badges(topic).map((b) => b.id),
    })),
    global: {
      globalHealth: globalHealth(store, NOW),
      mastery: overallMastery(store),
      overallLevel: overallLevel(store, NOW),
      retrievable: retrievable(store, NOW),
      streak: studyStreak(store, NOW),
      volume: weeklyVolume(store, NOW),
      courseHealth: courseHealth(refs, NOW),
      weakTopics: weakTopics(refs, NOW).map((r) => r.topic.topic_id),
      dueQueue: globalDueQueue(store, 10, NOW).map((r) => r.topic.topic_id),
    },
  });
}

describe('read-side-only invariant (design §A)', () => {
  it('produces non-trivial knowledge metrics for the rich store (guards against a vacuous test)', () => {
    const snap = JSON.parse(knowledgeSnapshot(richStore()));
    expect(snap.perTopic[0].health).toBeGreaterThan(0);
    expect(snap.perTopic[0].retention).not.toBeNull();
  });

  it('assessment blocks and prerequisites change NO existing metric (byte-for-byte)', () => {
    const s = richStore();
    expect(knowledgeSnapshot(s)).toBe(knowledgeSnapshot(stripAdditions(s)));
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/engine/read-side-only.test.ts`
Expected: PASS (both tests). If the byte-for-byte test FAILS, an added field is leaking into a knowledge metric — STOP and report which metric differs (the diff points at the leak); do not weaken the snapshot.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/read-side-only.test.ts
git commit -m "test(validation): read-side-only invariant proven byte-for-byte

Stripping every assessment block and prerequisites list from a rich store
leaves every existing retention/health/OCI/level/EXP/mastery/course metric
identical (JSON snapshot equality). Proves the Performance layer is read-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Historical / missing-field graceful degradation

Prove that pre-assessment data (every event lacking an `assessment` block, no `prerequisites`) still drives the knowledge metrics AND degrades the performance metrics to honest nulls/empties without throwing.

**Files:**
- Test: `tests/engine/historical-events.test.ts`

**Interfaces:**
- Consumes: `allTopics`, `emptyStore` (`@/domain/types`); `health`, `predictRetention` (existing); `performanceSummary`, `allReviewEvents`, `unstablePrerequisites` (`@/engine/performance-view`); `performanceByDifficulty`, `performanceByNovelty` (`@/engine/performance`).

- [ ] **Step 1: Write the test**

Create `tests/engine/historical-events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyStore, type ReviewEvent, type Store, type Topic } from '@/domain/types';
import { health } from '@/engine/metrics';
import { predictRetention } from '@/engine/retention';
import { performanceByDifficulty, performanceByNovelty } from '@/engine/performance';
import { allReviewEvents, performanceSummary, unstablePrerequisites } from '@/engine/performance-view';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const iso = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

/** A pre-3.2.0 store: events with NO assessment block, topics with NO prerequisites. */
function historicalStore(): Store {
  const events: ReviewEvent[] = [
    { event_id: 'event_1', date: iso(5), kind: 'test_pass', source: 'exam', source_id: 'src_1',
      confidence_reported: 4, test: { score: 8, out_of: 10, actual_retention: 0.8 } },
    { event_id: 'event_2', date: iso(2), kind: 'study_review', source: 'session', source_id: 'src_2', confidence_reported: 4 },
  ];
  const topic: Topic = {
    topic_id: 'topic_1', title: 'One', status: 'practising', conf: 4, strength: 4,
    k_factor: 8.4, cards: 2, last_reviewed: iso(2), mastered_at: null, drift_history: [],
    review_history: events, error_log: [],
  };
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C', created_at: iso(30), source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [topic] }] });
  return s;
}

describe('historical (pre-assessment) data', () => {
  it('still drives the existing knowledge metrics', () => {
    const topic = historicalStore().courses[0]!.sections[0]!.topics[0]!;
    expect(predictRetention(topic, NOW)).not.toBeNull();
    expect(health(topic, NOW)).toBeGreaterThan(0);
  });

  it('degrades every performance metric to an honest null/empty (no throw)', () => {
    const store = historicalStore();
    const events = allReviewEvents(store);
    const summary = performanceSummary(events);
    expect(summary.performanceHealth).toBeNull();
    expect(summary.cold).toBeNull();
    expect(summary.independent).toBeNull();
    expect(summary.transfer).toBeNull();
    expect(summary.quality).toBeNull();
    expect(summary.novelTaskSuccess).toBeNull();
    expect(summary.calibration).toBeNull();
    expect(performanceByDifficulty(events)).toEqual([]);
    expect(performanceByNovelty(events)).toEqual([]);
    expect(unstablePrerequisites(store, NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/engine/historical-events.test.ts`
Expected: PASS. A throw or a non-null performance metric here is a real degradation bug — STOP and report.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/historical-events.test.ts
git commit -m "test(validation): historical data drives knowledge, degrades performance

Pre-assessment events (no assessment block) still compute retention/health,
and every performance metric returns an honest null/empty without throwing.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Learner A vs Learner B success criterion (end-to-end)

The brief's north star, as one explicit test: Learner A (high accuracy, easy, familiar, assisted) has **higher raw accuracy** but **lower Performance Health**; Learner B (lower accuracy, hard, novel, independent, strong transfer) has **lower raw accuracy** but **higher Performance Health**. Both truths coexist.

**Files:**
- Test: `tests/engine/learner-ab.test.ts`

**Interfaces:**
- Consumes: `performanceHealth`, `observedSuccess`, `mean` (`@/engine/performance`); `makeEvent` (`../engine/assessment-fixtures`).

- [ ] **Step 1: Write the test**

Create `tests/engine/learner-ab.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { performanceHealth, observedSuccess, mean } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

/** Naive raw accuracy — the metric the OLD tracker would rank on. */
function rawAccuracy(events: ReturnType<typeof makeEvent>[]): number {
  return mean(events.map(observedSuccess).filter((x): x is number => x !== undefined))!;
}

// Learner A: 95% accuracy, easy (difficulty 1), familiar (novelty 0), ASSISTED
// (independence 1), low transfer, decent quality. 10 attempts.
const learnerA = Array.from({ length: 10 }, () =>
  makeEvent({ difficulty: 1, novelty: 0, independence: 1, transfer_level: 0, performance_quality: 3 },
    { test: { score: 19, out_of: 20 } }),
);

// Learner B: ~82% accuracy, HARD (4–5), NOVEL (3–4), INDEPENDENT (3), strong
// transfer (3), high quality (5). 10 attempts, a couple missed.
const learnerB = [
  ...Array.from({ length: 8 }, () =>
    makeEvent({ difficulty: 5, novelty: 4, independence: 3, transfer_level: 3, performance_quality: 5 },
      { test: { score: 9, out_of: 10 } })),
  ...Array.from({ length: 2 }, () =>
    makeEvent({ difficulty: 4, novelty: 3, independence: 3, transfer_level: 3, performance_quality: 4 },
      { test: { score: 5, out_of: 10 } })),
];

describe('Learner A vs Learner B — the brief success criterion', () => {
  it('A has the higher RAW accuracy (the old tracker would rank A above B)', () => {
    expect(rawAccuracy(learnerA)).toBeGreaterThan(rawAccuracy(learnerB));
    expect(rawAccuracy(learnerA)).toBeGreaterThan(0.9); // ~0.95
  });

  it('B has the higher PERFORMANCE HEALTH (the new layer recognises B is stronger)', () => {
    const a = performanceHealth(learnerA)!;
    const b = performanceHealth(learnerB)!;
    expect(b).toBeGreaterThan(a);
    expect(a).toBeLessThan(40);  // "solid but untested / assisted" reads modest
    expect(b).toBeGreaterThan(70); // beyond-routine, independent → strong
  });

  it('both truths coexist: A higher accuracy AND B higher performance health', () => {
    expect(rawAccuracy(learnerA)).toBeGreaterThan(rawAccuracy(learnerB));
    expect(performanceHealth(learnerB)!).toBeGreaterThan(performanceHealth(learnerA)!);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/engine/learner-ab.test.ts`
Expected: PASS. If A's Performance Health is not below B's, the anti-gaming design failed its own success criterion — STOP and report (this is the single most important behavioural claim of the branch). Note: Learner A has zero independent (`===3`) attempts, so its Performance Health rests only on transfer(0) and quality(0.6) — which is exactly why it reads low; confirm that is the computed reason, not a coincidence.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/learner-ab.test.ts
git commit -m "test(validation): Learner A vs B success criterion asserted end-to-end

A (95% acc, easy, familiar, assisted) ranks higher on raw accuracy but LOWER
on Performance Health; B (82% acc, hard, novel, independent) ranks lower on
raw accuracy but HIGHER on Performance Health. Both truths coexist — the
brief's north star, now one explicit test.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Generic-naming sweep

Prove no subject-specific vocabulary leaked into the new modules' **code** (comments, which legitimately say "NOT mathematics-specific", are excluded).

**Files:**
- Test: `tests/engine/generic-naming.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`.

- [ ] **Step 1: Write the test**

Create `tests/engine/generic-naming.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODULES = [
  'src/engine/performance.ts',
  'src/engine/performance-view.ts',
  'src/engine/prerequisites.ts',
  'src/routes/Performance.tsx',
];

// Whole-subject nouns that would signal a leaked assumption. NOT "difficulty"/
// "novelty"/"quality" (generic) — those are the whole point.
const FORBIDDEN = /\b(mathematics|mathematical|algebra|calculus|physics|chemistry|biology|geometry|arithmetic|trigonometry)\b/i;

/** Strip block and line comments so disclaimers like "NOT mathematics-specific"
 *  don't false-positive; we're checking code + string literals, not prose. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/tests[\\/]?$/, '');

describe('generic-naming — no subject-specific assumption in the new modules', () => {
  it.each(MODULES)('%s contains no subject-specific vocabulary in its code', (rel) => {
    const src = stripComments(readFileSync(root + rel, 'utf8'));
    const match = FORBIDDEN.exec(src);
    expect(match, match ? `found subject term "${match[0]}" in ${rel}` : '').toBeNull();
  });
});
```

Note on the path: `import.meta.url` for this test resolves under `tests/engine/`; the `root` derivation walks up to the repo root so `root + rel` reaches `src/…`. If the path resolution is environment-fragile, replace `root` with `process.cwd() + '/'` (Vitest runs from the repo root) — pick whichever resolves in this repo and keep it simple.

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/engine/generic-naming.test.ts`
Expected: PASS. A match means a real subject term is in code/strings — STOP and report the file + term (rename it generically; do not delete the test).

- [ ] **Step 3: Full verification + commit**

Run: `npm run typecheck`
Expected: GREEN.

Run: `npx vitest run tests/engine tests/domain tests/core`
Expected: PASS (all validation + existing).

Run: `npm test`
Expected: same 3 pre-existing UI files failing, nothing new.

```bash
git add tests/engine/generic-naming.test.ts
git commit -m "test(validation): generic-naming sweep of the Performance modules

Asserts no subject-specific vocabulary (mathematics/algebra/physics/…) appears
in the new modules' code (comments excluded), so the model stays subject-agnostic.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (brief Phase 6, items 21–25):**
- Unit tests for each derivation — covered across Phases 3–5; Phase 6 adds the cross-cutting ones. ✔
- Tests with missing fields → Task 2 (historical data). ✔
- Tests against historical events → Task 2. ✔
- Existing retention/mastery calculations unchanged → Task 1 (byte-for-byte). ✔
- No subject-specific assumptions leaked → Task 4. ✔
- Success criterion (Learner A vs B) → Task 3. ✔

**2. Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. Two notes (Task 2 import aliasing, Task 4 path resolution) flag environment-fragile spots with the concrete fallback rather than leaving them vague. ✔

**3. Type consistency:** all imported functions match the signatures confirmed from `metrics.ts`/`leveling.ts`/`retention.ts`/`overview.ts`/`course.ts`/`progress.ts`/`performance.ts`/`performance-view.ts`. `makeEvent` is the shared fixture. ✔

**4. Tests-only discipline:** no `src/` change is planned; every task's expected outcome is PASS, and a failure is explicitly an escalation (real finding), not a prompt to weaken the test. ✔

**5. Non-brittleness:** Task 3 uses generous margins (A < 40, B > 70, with ~26 vs ~85 computed) so a small weight tweak won't flip it; Task 1 guards against a vacuous pass with a non-triviality assertion first. ✔
