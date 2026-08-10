# Performance Metrics — Phase 5a: Dashboard Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, testable data layer the Performance dashboard will render — store→event flattening and scoping, the two remaining headline metrics (Performance Quality, Novel-Task Success), a single `performanceSummary` bundle, a 7/30/lifetime trend windower, and a prerequisite-instability surfacer — so the eventual UI (Phase 5b) is a thin render of ready-made view-models.

**Architecture:** Two additions. (1) Two more metrics into the existing `src/engine/performance.ts` (same shape/guards as the others). (2) A new `src/engine/performance-view.ts` view-model module that flattens the store into `ReviewEvent[]` at global/course scope and composes the Phase 3/4 metrics into display-ready bundles, trends, and a prerequisite surfacer. All pure and read-only; no React, no UI, no change to existing metrics.

**Tech Stack:** TypeScript 5.6 (strict), Vitest 2.1.4.

## Global Constraints

- **Read-side-only (design §A).** Everything here reads the store and composes existing metrics. No writes; no feeding of `retention`/`health`/`level`/EXP/OCI. Existing metrics unchanged.
- **Honest degradation.** Every headline is `null` below its min-data guard (→ UI "—"); trends compute each window independently and a window with no qualifying data is `null`, never 0. No dimension is invented.
- **The two new metrics obey the same anti-gaming rules.** Novel-Task Success is over **independent (`isIndependent`, ===3)** attempts only, so novelty never lifts a number without independent success (§18). Performance Quality is a straight mean of the tutor's quality judgement (which already encodes correctness via rubric), min-data-guarded.
- **Composition, not reimplementation.** `performance-view.ts` calls the Task-3/4 functions (`performanceHealth`, `coldPerformance`, `independentPerformance`, `transferAbility`, `calibrationError`, `performanceByDifficulty/Novelty`, `prerequisiteInstability`); it must not re-derive any metric.
- **All thresholds are named `CONFIG.PERFORMANCE` constants.** No inline magic numbers.
- **Baseline is NOT fully green.** 18 pre-existing UI failures in `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. Verify against `npm run typecheck` + `tests/engine tests/domain tests/core` (green); treat `npm test` as "same 3 files failing, nothing new."
- **Naming:** subject-agnostic.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/config/constants.ts` | Tunables. | Modify: add `PERFORMANCE.{ MIN_QUALITY_N, MIN_NOVEL_N, NOVEL_THRESHOLD, TREND_SHORT_DAYS, TREND_LONG_DAYS }` (Task 1/3). |
| `src/engine/performance.ts` | Event-based metrics. | Modify: append `performanceQuality`, `novelTaskSuccess` (Task 1). |
| `src/engine/performance-view.ts` | Store→view-model composition for the dashboard, pure. | Create (Tasks 2–4). |
| `tests/engine/performance-quality-novelty.test.ts` | The two new metrics. | Create (Task 1). |
| `tests/engine/performance-summary.test.ts` | Flattening + the summary bundle. | Create (Task 2). |
| `tests/engine/performance-trend.test.ts` | The 7/30/lifetime windower. | Create (Task 3). |
| `tests/engine/unstable-prerequisites.test.ts` | The prerequisite surfacer. | Create (Task 4). |

Existing files untouched beyond `constants.ts` and the two appends to `performance.ts`.

---

## Task 1: Performance Quality + Novel-Task Success metrics

Two headline numbers the design's card row needs (§17), added to `performance.ts` for single-sourcing with the rest.

**Files:**
- Modify: `src/config/constants.ts` (add three thresholds to `PERFORMANCE`)
- Modify: `src/engine/performance.ts` (append)
- Test: `tests/engine/performance-quality-novelty.test.ts`

**Interfaces:**
- Consumes: `mean`, `observedSuccess`, `isIndependent` (existing); `CONFIG.TEST_PASS_MARK`, `CONFIG.PERFORMANCE.{ QUALITY_MAX, MIN_QUALITY_N, MIN_NOVEL_N, NOVEL_THRESHOLD }`.
- Produces:
  - `interface QualityScore { score: number; n: number; }` (score 0–100)
  - `performanceQuality(events: ReviewEvent[]): QualityScore | null`
  - `interface NovelTaskSuccess { rate: number; n: number; }` (rate 0–1)
  - `novelTaskSuccess(events: ReviewEvent[]): NovelTaskSuccess | null`

- [ ] **Step 1: Add the config thresholds**

In `src/config/constants.ts`, inside `PERFORMANCE` (near the other `MIN_*`), add:

```ts
    /** Min quality observations before Performance Quality shows a number. */
    MIN_QUALITY_N: 5,
    /** Min novel-task observations before Novel-Task Success shows a number. */
    MIN_NOVEL_N: 5,
    /** Novelty at/above this counts as a "novel task" (3 = genuinely unfamiliar). */
    NOVEL_THRESHOLD: 3,
```

- [ ] **Step 2: Write the failing test**

Create `tests/engine/performance-quality-novelty.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { performanceQuality, novelTaskSuccess } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('performanceQuality', () => {
  it('is null below MIN_QUALITY_N observations', () => {
    expect(performanceQuality([makeEvent({ performance_quality: 5 })])).toBeNull();
  });
  it('averages performance_quality onto 0–100 once enough data exists', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ performance_quality: 4 })); // 4/5 → 80
    const r = performanceQuality(events)!;
    expect(r.n).toBe(5);
    expect(r.score).toBeCloseTo(80);
  });
  it('ignores attempts with no performance_quality', () => {
    const events = [...Array.from({ length: 5 }, () => makeEvent({ performance_quality: 4 })), makeEvent({ difficulty: 2 })];
    expect(performanceQuality(events)!.n).toBe(5);
  });
});

describe('novelTaskSuccess', () => {
  it('counts only independent (===3) novel (novelty>=NOVEL_THRESHOLD) attempts', () => {
    const events = [
      // independent + novel + passing → counts
      ...Array.from({ length: 5 }, () => makeEvent({ independence: 3, novelty: 3 }, { test: { score: 9, out_of: 10 } })),
      // independence 2 (lightly assisted) novel → EXCLUDED
      makeEvent({ independence: 2, novelty: 4 }, { test: { score: 10, out_of: 10 } }),
      // independent but not novel → EXCLUDED
      makeEvent({ independence: 3, novelty: 1 }, { test: { score: 10, out_of: 10 } }),
    ];
    const r = novelTaskSuccess(events)!;
    expect(r.n).toBe(5);
    expect(r.rate).toBeCloseTo(1);
  });
  it('is null below MIN_NOVEL_N qualifying observations', () => {
    expect(novelTaskSuccess([makeEvent({ independence: 3, novelty: 4 }, { test: { score: 9, out_of: 10 } })])).toBeNull();
  });
  it('rate is the pass fraction (>= TEST_PASS_MARK)', () => {
    const events = [
      ...Array.from({ length: 3 }, () => makeEvent({ independence: 3, novelty: 3 }, { test: { score: 9, out_of: 10 } })), // pass
      ...Array.from({ length: 2 }, () => makeEvent({ independence: 3, novelty: 3 }, { test: { score: 5, out_of: 10 } })), // fail
    ];
    expect(novelTaskSuccess(events)!.rate).toBeCloseTo(0.6);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npx vitest run tests/engine/performance-quality-novelty.test.ts` → FAIL (not exported).

- [ ] **Step 4: Implement**

Append to `src/engine/performance.ts`:

```ts
export interface QualityScore {
  score: number; // 0–100
  n: number;
}

/** Mean tutor performance_quality → 0–100 over attempts that carry it. Null below
 *  MIN_QUALITY_N. Quality already encodes correctness via the tutor rubric, so
 *  this is a straight mean (design §17 headline). */
export function performanceQuality(events: ReviewEvent[]): QualityScore | null {
  const qs = events
    .map((e) => e.assessment?.performance_quality)
    .filter((x): x is number => x !== undefined);
  if (qs.length < P.MIN_QUALITY_N) return null;
  return { score: (mean(qs)! / P.QUALITY_MAX) * 100, n: qs.length };
}

export interface NovelTaskSuccess {
  rate: number; // 0–1
  n: number;
}

/** Pass-rate on novel tasks attempted INDEPENDENTLY (isIndependent AND novelty >=
 *  NOVEL_THRESHOLD) — novelty never lifts the number without independent success
 *  (§18). Null below MIN_NOVEL_N. */
export function novelTaskSuccess(events: ReviewEvent[]): NovelTaskSuccess | null {
  const outcomes = events
    .filter((e) => isIndependent(e) && (e.assessment?.novelty ?? -1) >= P.NOVEL_THRESHOLD)
    .map(observedSuccess)
    .filter((x): x is number => x !== undefined);
  if (outcomes.length < P.MIN_NOVEL_N) return null;
  return { rate: outcomes.filter((x) => x >= CONFIG.TEST_PASS_MARK).length / outcomes.length, n: outcomes.length };
}
```

- [ ] **Step 5: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 6: Commit**

```bash
git add src/config/constants.ts src/engine/performance.ts tests/engine/performance-quality-novelty.test.ts
git commit -m "feat(performance): Performance Quality + Novel-Task Success metrics

performanceQuality = mean tutor quality → 0–100 (min-data guarded).
novelTaskSuccess = pass-rate on independent (===3), novel (novelty>=3)
tasks only, so novelty can't lift the number without independent success.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Event flattening + `performanceSummary`

Flatten the store into `ReviewEvent[]` at global/course scope, and bundle every headline metric into one view-model.

**Files:**
- Create: `src/engine/performance-view.ts`
- Test: `tests/engine/performance-summary.test.ts`

**Interfaces:**
- Consumes: `Store`, `ReviewEvent`, `allTopics` (`@/domain/types`); `performanceHealth`, `coldPerformance`, `independentPerformance`, `transferAbility`, `calibrationError`, `performanceQuality`, `novelTaskSuccess` and their result types (`@/engine/performance`).
- Produces:
  - `allReviewEvents(store: Store): ReviewEvent[]`
  - `courseReviewEvents(store: Store, courseId: string): ReviewEvent[]`
  - `interface PerformanceSummary { performanceHealth: number | null; cold: ColdPerformance | null; independent: IndependentPerformance | null; transfer: TransferAbility | null; quality: QualityScore | null; novelTaskSuccess: NovelTaskSuccess | null; calibration: Calibration | null; }`
  - `performanceSummary(events: ReviewEvent[]): PerformanceSummary` — no `now` param: every bundled metric is event-array-pure (calibration reads `event.date`, not a clock).

- [ ] **Step 1: Write the failing test**

Create `tests/engine/performance-summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { allReviewEvents, courseReviewEvents, performanceSummary } from '@/engine/performance-view';
import { emptyStore, type Store, type Topic, type ReviewEvent } from '@/domain/types';
import { makeEvent } from './assessment-fixtures';

function topicWith(id: string, events: ReviewEvent[]): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: events, error_log: [],
  };
}

function storeOf(...topics: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  });
  return s;
}

describe('event flattening', () => {
  it('allReviewEvents flattens every topic’s history across courses', () => {
    const store = storeOf(topicWith('topic_a', [makeEvent({ difficulty: 1 })]), topicWith('topic_b', [makeEvent({ difficulty: 2 }), makeEvent({ difficulty: 3 })]));
    expect(allReviewEvents(store)).toHaveLength(3);
  });
  it('courseReviewEvents scopes to one course (empty for an unknown id)', () => {
    const store = storeOf(topicWith('topic_a', [makeEvent({ difficulty: 1 })]));
    expect(courseReviewEvents(store, 'course_1')).toHaveLength(1);
    expect(courseReviewEvents(store, 'course_missing')).toEqual([]);
  });
});

describe('performanceSummary', () => {
  it('bundles every headline; each is null when its data is insufficient', () => {
    const s = performanceSummary([makeEvent({ difficulty: 2 })]); // one bare attempt
    expect(s).toHaveProperty('performanceHealth');
    expect(s.cold).toBeNull();
    expect(s.transfer).toBeNull();
    expect(s.quality).toBeNull();
    expect(s.novelTaskSuccess).toBeNull();
    expect(s.calibration).toBeNull();
  });
  it('surfaces a computed metric when enough data exists', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    expect(performanceSummary(events).transfer!.score).toBeCloseTo(100);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (module/exports missing).

- [ ] **Step 3: Implement**

Create `src/engine/performance-view.ts`:

```ts
import type { ReviewEvent, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import {
  calibrationError,
  coldPerformance,
  independentPerformance,
  novelTaskSuccess,
  performanceHealth,
  performanceQuality,
  transferAbility,
  type Calibration,
  type ColdPerformance,
  type IndependentPerformance,
  type NovelTaskSuccess,
  type QualityScore,
  type TransferAbility,
} from './performance';

/**
 * Dashboard view-models — design 2026-08-10 §17. Pure store→display composition:
 * flatten the event log at a scope, then compose the Phase 3/4 metrics. No metric
 * is re-derived here; nothing is written (read-side-only, §A).
 */

/** Every review event across all courses/sections/topics. */
export function allReviewEvents(store: Store): ReviewEvent[] {
  return allTopics(store).flatMap(({ topic }) => topic.review_history);
}

/** Every review event within one course (empty if the id doesn't resolve). */
export function courseReviewEvents(store: Store, courseId: string): ReviewEvent[] {
  const course = store.courses.find((c) => c.course_id === courseId);
  if (!course) return [];
  return course.sections.flatMap((s) => s.topics.flatMap((t) => t.review_history));
}

export interface PerformanceSummary {
  performanceHealth: number | null;
  cold: ColdPerformance | null;
  independent: IndependentPerformance | null;
  transfer: TransferAbility | null;
  quality: QualityScore | null;
  novelTaskSuccess: NovelTaskSuccess | null;
  calibration: Calibration | null;
}

/** Bundle every Performance headline for a set of events. Each field carries its
 *  own metric's min-data guard (null → the UI shows "—"). No `now`: every bundled
 *  metric is event-array-pure (calibration reads event.date, not a clock). */
export function performanceSummary(events: ReviewEvent[]): PerformanceSummary {
  return {
    performanceHealth: performanceHealth(events),
    cold: coldPerformance(events),
    independent: independentPerformance(events),
    transfer: transferAbility(events),
    quality: performanceQuality(events),
    novelTaskSuccess: novelTaskSuccess(events),
    calibration: calibrationError(events),
  };
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance-view.ts tests/engine/performance-summary.test.ts
git commit -m "feat(performance-view): event flattening + performanceSummary bundle

allReviewEvents / courseReviewEvents flatten the store at a scope;
performanceSummary composes every headline metric, each carrying its own
min-data guard. Pure composition, no re-derivation.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `metricTrend` — 7/30/lifetime windows

A generic windower so any metric can be shown as a 7-day / 30-day / lifetime trend (design §13/§17).

**Files:**
- Modify: `src/config/constants.ts` (add `TREND_SHORT_DAYS`, `TREND_LONG_DAYS`)
- Modify: `src/engine/performance-view.ts` (append)
- Test: `tests/engine/performance-trend.test.ts`

**Interfaces:**
- Consumes: `ReviewEvent`; `CONFIG.PERFORMANCE.{ TREND_SHORT_DAYS, TREND_LONG_DAYS }`.
- Produces:
  - `windowEvents(events: ReviewEvent[], now: Date, days: number): ReviewEvent[]` (events with `date` within `[now − days, now]`)
  - `interface TrendWindows<T> { d7: T; d30: T; lifetime: T; }`
  - `metricTrend<T>(events: ReviewEvent[], now: Date, metric: (evs: ReviewEvent[]) => T): TrendWindows<T>`

- [ ] **Step 1: Add the config windows**

In `src/config/constants.ts` `PERFORMANCE`, add:

```ts
    /** Dashboard trend windows, in days (design §13). */
    TREND_SHORT_DAYS: 7,
    TREND_LONG_DAYS: 30,
```

- [ ] **Step 2: Write the failing test**

Create `tests/engine/performance-trend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { windowEvents, metricTrend } from '@/engine/performance-view';
import { makeEvent } from './assessment-fixtures';

const NOW = new Date('2026-08-30T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('windowEvents', () => {
  it('keeps only events within the last N days', () => {
    const events = [
      makeEvent({ difficulty: 1 }, { date: daysAgo(2) }),   // in 7 and 30
      makeEvent({ difficulty: 1 }, { date: daysAgo(20) }),  // in 30 only
      makeEvent({ difficulty: 1 }, { date: daysAgo(90) }),  // in neither
    ];
    expect(windowEvents(events, NOW, 7)).toHaveLength(1);
    expect(windowEvents(events, NOW, 30)).toHaveLength(2);
  });
});

describe('metricTrend', () => {
  it('applies the metric across 7d / 30d / lifetime windows', () => {
    const events = [
      makeEvent({ difficulty: 1 }, { date: daysAgo(2) }),
      makeEvent({ difficulty: 1 }, { date: daysAgo(20) }),
      makeEvent({ difficulty: 1 }, { date: daysAgo(90) }),
    ];
    const trend = metricTrend(events, NOW, (evs) => evs.length);
    expect(trend).toEqual({ d7: 1, d30: 2, lifetime: 3 });
  });
});
```

- [ ] **Step 3: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 4: Implement**

Append to `src/engine/performance-view.ts` (and add `import { CONFIG } from '@/config/constants';` at the top):

```ts
const MS_PER_DAY = 86_400_000;

/** Events whose date falls within the last `days` up to `now`. */
export function windowEvents(events: ReviewEvent[], now: Date, days: number): ReviewEvent[] {
  const cutoff = now.getTime() - days * MS_PER_DAY;
  return events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= cutoff && t <= now.getTime();
  });
}

export interface TrendWindows<T> {
  d7: T;
  d30: T;
  lifetime: T;
}

/** Apply a metric over the 7-day, 30-day, and lifetime event windows (design
 *  §13). Each window is computed independently, so an empty window yields
 *  whatever the metric returns for no data (typically null) — never a false 0. */
export function metricTrend<T>(
  events: ReviewEvent[],
  now: Date,
  metric: (evs: ReviewEvent[]) => T,
): TrendWindows<T> {
  return {
    d7: metric(windowEvents(events, now, CONFIG.PERFORMANCE.TREND_SHORT_DAYS)),
    d30: metric(windowEvents(events, now, CONFIG.PERFORMANCE.TREND_LONG_DAYS)),
    lifetime: metric(events),
  };
}
```

- [ ] **Step 5: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 6: Commit**

```bash
git add src/config/constants.ts src/engine/performance-view.ts tests/engine/performance-trend.test.ts
git commit -m "feat(performance-view): 7/30/lifetime metric trend windower

windowEvents filters events to a trailing day-window; metricTrend applies
any metric across 7d/30d/lifetime, each computed independently so an empty
window degrades to the metric's own null, never a false zero.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `unstablePrerequisites` — surface upstream instability

Across the store, find topics that are themselves struggling *and* have unstable upstream prerequisites — the "your errors here may be rooted upstream" diagnostic (design §6, §17).

**Files:**
- Modify: `src/engine/performance-view.ts` (append)
- Test: `tests/engine/unstable-prerequisites.test.ts`

**Interfaces:**
- Consumes: `Store`, `Topic`, `allTopics` (`@/domain/types`); `prerequisiteInstability`, `PrerequisiteReport` (`@/engine/prerequisites`); `activeErrorCount` (`@/engine/metrics`); `isDue` (`@/engine/retention`).
- Produces:
  - `interface UnstableUpstream { topic_id: string; title: string; report: PrerequisiteReport; }`
  - `unstablePrerequisites(store: Store, now?: Date): UnstableUpstream[]`

Qualifying rule: a topic is inspected when it declares prerequisites AND is itself struggling — `activeErrorCount(topic) > 0` OR `isDue(topic, now)`. It's included in the result only when its `prerequisiteInstability` report has `unstableCount > 0`.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/unstable-prerequisites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { unstablePrerequisites } from '@/engine/performance-view';
import { emptyStore, type Store, type Topic } from '@/domain/types';

function topic(id: string, over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-10T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [], ...over,
  };
}
function anError(id: string) {
  return { error_id: id, date: '2026-08-10T00:00:00.000Z', source: 'session' as const,
    source_id: 'session_1', error_type: 'conceptual' as const, description: 'x', resolved: false, resolved_date: null };
}
function storeOf(...topics: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }] });
  return s;
}
const NOW = new Date('2026-08-10T12:00:00.000Z');

describe('unstablePrerequisites', () => {
  it('surfaces a struggling topic whose upstream is unstable', () => {
    // C is struggling (active error) and depends on A which is not_started (unstable upstream).
    const c = topic('topic_c', { prerequisites: ['topic_a'], error_log: [anError('error_1')] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, strength: 0 });
    const out = unstablePrerequisites(storeOf(c, a), NOW);
    expect(out.map((u) => u.topic_id)).toContain('topic_c');
    expect(out.find((u) => u.topic_id === 'topic_c')!.report.unstableCount).toBeGreaterThanOrEqual(1);
  });

  it('does not surface a struggling topic whose upstream is solid', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'], error_log: [anError('error_1')] });
    const a = topic('topic_a', { status: 'mastered', conf: 5, strength: 20, cards: 5, mastered_at: '2026-08-05T00:00:00.000Z' });
    expect(unstablePrerequisites(storeOf(c, a), NOW)).toEqual([]);
  });

  it('does not surface a topic that is NOT struggling, even with weak upstream', () => {
    // C has no errors and is freshly reviewed (not due), so it isn't inspected.
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, strength: 0 });
    expect(unstablePrerequisites(storeOf(c, a), NOW)).toEqual([]);
  });

  it('ignores topics with no prerequisites', () => {
    const c = topic('topic_c', { error_log: [anError('error_1')] });
    expect(unstablePrerequisites(storeOf(c), NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

Append to `src/engine/performance-view.ts` (add imports: `import type { Topic } from '@/domain/types';` already covered via existing import — extend it; `import { prerequisiteInstability, type PrerequisiteReport } from './prerequisites';`, `import { activeErrorCount } from './metrics';`, `import { isDue } from './retention';`):

```ts
export interface UnstableUpstream {
  topic_id: string;
  title: string;
  report: PrerequisiteReport;
}

/**
 * Topics that are themselves struggling (active errors, or due) AND have unstable
 * upstream prerequisites — so a repeatedly-failing topic can point at its shaky
 * foundations (design §6, §17). Diagnostic only; reads, never writes.
 */
export function unstablePrerequisites(store: Store, now: Date = new Date()): UnstableUpstream[] {
  const out: UnstableUpstream[] = [];
  for (const { topic } of allTopics(store)) {
    if (!topic.prerequisites || topic.prerequisites.length === 0) continue;
    const struggling = activeErrorCount(topic) > 0 || isDue(topic, now);
    if (!struggling) continue;
    const report = prerequisiteInstability(topic, store, now);
    if (report.unstableCount > 0) {
      out.push({ topic_id: topic.topic_id, title: topic.title, report });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Full verification**

Run: `npx vitest run tests/engine tests/domain tests/core`
Expected: PASS (all green including the four new files).

Run: `npm test`
Expected: same 3 pre-existing UI files failing, nothing new.

- [ ] **Step 6: Commit**

```bash
git add src/engine/performance-view.ts tests/engine/unstable-prerequisites.test.ts
git commit -m "feat(performance-view): surface struggling topics with unstable upstream

unstablePrerequisites finds topics that are struggling (active errors or due)
AND have unstable prerequisites, so downstream errors can point upstream.
Diagnostic only, read-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (the data behind design §17 dashboard):**
- Headline metrics — Cold/Independent/Transfer/Performance-Health already exist (Phase 3); Performance Quality + Novel-Task Success → Task 1; bundled by `performanceSummary` → Task 2. ✔
- Diagnostic views — perf-by-difficulty/novelty and assisted-vs-independent already exist (Phase 3, consumed directly); prerequisite instability surfaced → Task 4. ✔
- Trends (7/30/lifetime, §13) → Task 3 `metricTrend`. ✔
- Scoping (global vs per-course) → Task 2 flattening helpers. ✔
- Everything null-guarded / read-only / composition-only → Global Constraints, verified per task. ✔

**2. Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. ✔

**3. Type consistency:** result types imported from `performance.ts` (`ColdPerformance`, `IndependentPerformance`, `TransferAbility`, `Calibration`, `QualityScore`, `NovelTaskSuccess`) are the exact names Phase 3/Task 1 export; `performanceSummary`/`metricTrend`/`unstablePrerequisites`/`windowEvents`/`allReviewEvents`/`courseReviewEvents` signatures match their tests. `CONFIG.PERFORMANCE` keys added in Tasks 1/3 are read where used. ✔

**4. Anti-gaming preserved:** Novel-Task Success gates on `isIndependent` (Task 1) — novelty can't lift it without independent success. ✔

**5. Out of scope (deliberately — Phase 5b):** no React, no route, no component. This plan is the pure data layer only; the UI that renders these view-models is a separate plan where the UI-baseline decision (build on the current committed base vs. the stashed redesign) is made.
