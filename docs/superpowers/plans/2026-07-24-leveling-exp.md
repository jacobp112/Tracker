# Level-up UI & EXP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface progress as three orthogonal, fully-derived numbers — an evidence-ratcheted per-topic level (with a level-up toast), an EXP "retrievable knowledge" figure with a 7-day trend, and a monotonic "work logged" counter — without storing any progress value.

**Architecture:** All progress is derived live from the append-only store, consistent with the app's "derive, never store" spine. EXP = `Σ retention over started topics`; its trend is reconstructed by forward-replaying history per day (most-recent point short-circuited to live state). Topic level is a high-water mark over replayed history, so it ratchets on evidence and never falls with decay. Level-ups are detected at commit time from the old→new store diff.

**Tech Stack:** TypeScript (strict), React 18, Vite, Vitest + Testing Library (jsdom), CSS design tokens. Path alias `@/` → `src/`.

## Global Constraints

- **No stored progress.** Every number here is derived on read; nothing is written to the Store. (Document 1 §2.3)
- **No inline magic numbers.** Any constant lives in `CONFIG` (`src/config/constants.ts`). (Document 2 §0)
- **Pure engine functions.** `src/engine/*` functions take state + injectable `now`, return values, and never mutate inputs or touch storage.
- **`predictRetention` returns `number | null`** — `null` for never-reviewed / not-started. Callers must handle null, never coerce to 0.
- **Storage names are snake_case** (`review_history`, `last_reviewed`, `mastered_at`, `topic_id`).
- **Tests live under `tests/`** mirroring `src/` (e.g. `tests/engine/progress.test.ts`), using `import { describe, expect, it } from 'vitest'`.
- **Commands:** `npm test -- <path>` runs one file; `npm run typecheck` is strict, no-emit.

---

## File Structure

- **Create** `src/engine/replay.ts` — reconstruct a topic's event-sourced state as-of a past date (shared by EXP trend and the level watermark).
- **Create** `src/engine/progress.ts` — `retrievable`, `expTrend`, `workLogged` (EXP + work-logged aggregations).
- **Modify** `src/engine/leveling.ts` — add `topicLevelHighWater` and `levelUps`.
- **Modify** `src/config/constants.ts` — add `PROGRESS` block.
- **Modify** `src/components/Sparkline.tsx` — make the goal line optional and the unit configurable so it can render an EXP ratio trend.
- **Modify** `src/hooks/useStore.ts` — `commitValue` computes level-ups and passes them to an optional callback.
- **Modify** `src/routes/LogSession.tsx`, `src/routes/AddExam.tsx` — fire level-up toasts.
- **Modify** `src/routes/Overview.tsx` — EXP header (number + trend sparkline) and a "Work logged" prop.
- **Modify** `src/routes/TopicDetail.tsx` — show the high-water level adjacent to retention.
- **Create** tests alongside each: `tests/engine/replay.test.ts`, `tests/engine/progress.test.ts`, and extend `tests/engine/leveling.test.ts`.

---

## Task 1: `CONFIG.PROGRESS` constants

**Files:**
- Modify: `src/config/constants.ts` (insert a `PROGRESS` block inside the `CONFIG` object, after the `LEVEL` block ends at line 107 `},`)

**Interfaces:**
- Produces: `CONFIG.PROGRESS.TREND_DAYS: number`, `CONFIG.PROGRESS.SESSION_MINUTES: number`

- [ ] **Step 1: Add the constants**

In `src/config/constants.ts`, immediately after the `LEVEL: { … },` block closes (line 107) and before the final `} as const;`, add:

```ts
  /** Progress surfacing (engine/progress.ts) — all derived, never stored. */
  PROGRESS: {
    /** Days of history shown in the Overview EXP trend sparkline. */
    TREND_DAYS: 7,
    /**
     * Nominal minutes per study session — the honest volume proxy. Session
     * duration is decomposed away on ingestion, so "hours" is a count × this,
     * exact in the count and approximate in the hours (mirrors weeklyVolume).
     */
    SESSION_MINUTES: 30,
  },
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/config/constants.ts
git commit -m "feat(config): PROGRESS constants for EXP trend and work-logged"
```

---

## Task 2: `topicStateAsOf` — replay a topic to a past date

Reconstructs the event-sourced fields (`strength`, `k_factor`, `last_reviewed`, `conf`, `status`) exactly by folding `applyEvent` over the history prefix from a known genesis (`k_factor = DECAY_K`, `strength = 0`, `status = not_started`). Used by both the EXP trend and the level watermark.

**Files:**
- Create: `src/engine/replay.ts`
- Test: `tests/engine/replay.test.ts`

**Interfaces:**
- Consumes: `applyEvent` (`src/engine/recalculate.ts`), `CONFIG.DECAY_K`, `Topic` (`src/domain/types.ts`)
- Produces: `topicStateAsOf(topic: Topic, asOf: Date): Topic` — a new Topic whose event-sourced fields reflect only events with `date ≤ asOf`. `cards`/`error_log`/`mastered_at` are NOT reconstructed here (callers that need them handle them); `review_history` on the result holds only the events ≤ asOf.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/replay.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { topicStateAsOf } from '@/engine/replay';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

function review(id: string, date: string, conf: 1 | 2 | 3 | 4 | 5): ReviewEvent {
  return {
    event_id: id, date, kind: 'study_review',
    source: 'session', source_id: `s_${id}`, confidence_reported: conf,
  };
}

/** A topic whose CURRENT state is the product of two study reviews. */
function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 't1', title: 'T', status: 'learning',
    conf: 4, strength: 0, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: null, mastered_at: null, drift_history: [],
    review_history: [
      review('e1', '2026-06-01T10:00:00Z', 3),
      review('e2', '2026-06-10T10:00:00Z', 5),
    ],
    error_log: [],
    ...over,
  };
}

describe('topicStateAsOf', () => {
  it('is not_started before the first event', () => {
    const s = topicStateAsOf(topic(), new Date('2026-05-01T00:00:00Z'));
    expect(s.status).toBe('not_started');
    expect(s.strength).toBe(0);
    expect(s.last_reviewed).toBeNull();
  });

  it('reflects only the first event mid-history', () => {
    const s = topicStateAsOf(topic(), new Date('2026-06-05T00:00:00Z'));
    expect(s.review_history).toHaveLength(1);
    expect(s.last_reviewed).toBe('2026-06-01T10:00:00Z');
    // seeded 1.0 on first promotion, then +CONF_MID for the conf-3 review
    expect(s.strength).toBeCloseTo(CONFIG.SEED_STRENGTH + CONFIG.STRENGTH_GAIN.CONF_MID, 5);
  });

  it('at/after the last event equals a full forward replay', () => {
    const s = topicStateAsOf(topic(), new Date('2026-06-30T00:00:00Z'));
    expect(s.review_history).toHaveLength(2);
    // seed + CONF_MID (conf 3) + CONF_HIGH (conf 5)
    expect(s.strength).toBeCloseTo(
      CONFIG.SEED_STRENGTH + CONFIG.STRENGTH_GAIN.CONF_MID + CONFIG.STRENGTH_GAIN.CONF_HIGH,
      5,
    );
    expect(s.conf).toBe(5);
    expect(s.last_reviewed).toBe('2026-06-10T10:00:00Z');
  });

  it('does not mutate the input topic', () => {
    const t = topic();
    const before = JSON.stringify(t);
    topicStateAsOf(t, new Date('2026-06-05T00:00:00Z'));
    expect(JSON.stringify(t)).toBe(before);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/engine/replay.test.ts`
Expected: FAIL — "Failed to resolve import '@/engine/replay'".

- [ ] **Step 3: Implement**

Create `src/engine/replay.ts`:

```ts
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';
import { applyEvent } from './recalculate';

/**
 * Reconstruct a topic's event-sourced state as-of a past date by forward-replay
 * from a known genesis. Strength is additive and kFactor self-tunes over the
 * event set, so we replay forward (never subtract) — provably exact for topics
 * created in-app, where genesis kFactor is DECAY_K.
 *
 * Only the event-sourced fields are reconstructed (strength, k_factor,
 * last_reviewed, conf, status, review_history). Flashcards and the error log are
 * not event-derived; callers needing them for health reconstruct them
 * separately. Nothing here is stored (Document 1 §2.3).
 */
export function topicStateAsOf(topic: Topic, asOf: Date): Topic {
  const genesis: Topic = {
    ...topic,
    status: 'not_started',
    strength: 0,
    k_factor: CONFIG.DECAY_K,
    conf: 1,
    last_reviewed: null,
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
  };

  const events = topic.review_history
    .filter((e) => new Date(e.date).getTime() <= asOf.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let state = genesis;
  for (const e of events) {
    state = applyEvent(state, e, new Date(e.date));
  }
  return state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/replay.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck
git add src/engine/replay.ts tests/engine/replay.test.ts
git commit -m "feat(engine): topicStateAsOf — replay a topic to a past date"
```

---

## Task 3: `retrievable` — live EXP

**Files:**
- Create: `src/engine/progress.ts`
- Test: `tests/engine/progress.test.ts`

**Interfaces:**
- Consumes: `allTopics` (`src/domain/types.ts`), `predictRetention` (`src/engine/retention.ts`)
- Produces: `interface Retrievable { exp: number; ceiling: number }`; `retrievable(store: Store, now?: Date): Retrievable`. `exp = Σ min(1, predictRetention(topic, now))` over topics with `status !== 'not_started'`; `ceiling` = count of those topics.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { retrievable } from '@/engine/progress';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

const NOW = new Date('2026-07-20T12:00:00Z');

function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 't', title: 'T', status: 'practising',
    conf: 4, strength: 3, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: NOW.toISOString(), mastered_at: null,
    drift_history: [], review_history: [], error_log: [],
    ...over,
  };
}

function storeOf(topics: Topic[]): Store {
  const course: Course = {
    schema_version: '2.0.0', course_id: 'c', title: 'C',
    created_at: '2026-07-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }],
  };
  return { ...emptyStore(), courses: [course] };
}

describe('retrievable — live EXP', () => {
  it('is zero on an empty store', () => {
    expect(retrievable(emptyStore(), NOW)).toEqual({ exp: 0, ceiling: 0 });
  });

  it('excludes not_started topics from both exp and ceiling', () => {
    const store = storeOf([topic({ topic_id: 'a' }), topic({ topic_id: 'b', status: 'not_started' })]);
    const { ceiling } = retrievable(store, NOW);
    expect(ceiling).toBe(1);
  });

  it('a topic reviewed today contributes ~1 (retention pinned to 1 at t=0)', () => {
    const { exp, ceiling } = retrievable(storeOf([topic()]), NOW);
    expect(ceiling).toBe(1);
    expect(exp).toBeCloseTo(1, 5);
  });

  it('exp never exceeds ceiling, and falls as time passes with no new events', () => {
    const store = storeOf([topic(), topic({ topic_id: 't2' })]);
    const today = retrievable(store, NOW);
    const laterDate = new Date(NOW.getTime() + 30 * 86_400_000);
    const later = retrievable(store, laterDate);
    expect(today.exp).toBeLessThanOrEqual(today.ceiling);
    expect(later.exp).toBeLessThan(today.exp); // decay
    expect(later.ceiling).toBe(today.ceiling); // ceiling unchanged
  });

  it('clamps a backdated (future last_reviewed) topic to <= ceiling', () => {
    // last_reviewed in the future relative to now → retention would be 1, not >1
    const future = topic({ last_reviewed: new Date(NOW.getTime() + 5 * 86_400_000).toISOString() });
    const { exp, ceiling } = retrievable(storeOf([future]), NOW);
    expect(exp).toBeLessThanOrEqual(ceiling);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/engine/progress.test.ts`
Expected: FAIL — "Failed to resolve import '@/engine/progress'".

- [ ] **Step 3: Implement**

Create `src/engine/progress.ts`:

```ts
import { allTopics, type Store } from '@/domain/types';
import { predictRetention } from './retention';

/**
 * Progress aggregations — all derived live, none stored (Document 1 §2.3).
 *
 * EXP answers "what can I retrieve today?": the sum, over every started topic,
 * of the fraction you could retrieve right now. That fraction IS retention, so
 * EXP is `Σ retention`. It is deliberately not weighted by strength — strength
 * is unbounded and grows on every review, which would let activity inflate the
 * number and let one drilled topic dominate. Strength is still rewarded, but
 * temporally: a strong topic decays slower, so it holds its retention longer —
 * visible in the trend, not as a bigger number today.
 */

export interface Retrievable {
  /** Σ retention over started topics. */
  exp: number;
  /** Count of started topics — the knowable ceiling EXP is rendered against. */
  ceiling: number;
}

export function retrievable(store: Store, now: Date = new Date()): Retrievable {
  let exp = 0;
  let ceiling = 0;
  for (const { topic } of allTopics(store)) {
    if (topic.status === 'not_started') continue;
    ceiling += 1;
    const r = predictRetention(topic, now);
    if (r !== null) exp += Math.min(1, r); // clamp guards clock skew / backdating
  }
  return { exp, ceiling };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/progress.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck
git add src/engine/progress.ts tests/engine/progress.test.ts
git commit -m "feat(engine): retrievable — live EXP as sum of retention"
```

---

## Task 4: `expTrend` — 7-day trend by forward-replay

**Files:**
- Modify: `src/engine/progress.ts`
- Test: `tests/engine/progress.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `retrievable` (Task 3), `topicStateAsOf` (Task 2), `predictRetention`, `allTopics`, `CONFIG.PROGRESS.TREND_DAYS`, `MS_PER_DAY` (`src/engine/retention.ts`)
- Produces: `interface TrendPoint { date: Date; exp: number; ceiling: number; ratio: number }`; `expTrend(store: Store, now?: Date, days?: number): TrendPoint[]` — `days` points oldest→newest, the last one short-circuited to live `retrievable`. `ratio = ceiling === 0 ? 0 : exp / ceiling`.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/progress.test.ts` (append; reuse `topic`/`storeOf`/`NOW` from above):

```ts
import { expTrend } from '@/engine/progress';
import { retrievable as retr } from '@/engine/progress';
import type { ReviewEvent } from '@/domain/types';

function studied(id: string, date: string): ReviewEvent {
  return {
    event_id: id, date, kind: 'study_review',
    source: 'session', source_id: `s_${id}`, confidence_reported: 4,
  };
}

describe('expTrend — 7-day trend', () => {
  it('returns one point per day, oldest first', () => {
    const store = storeOf([topic({ review_history: [studied('e', NOW.toISOString())] })]);
    const pts = expTrend(store, NOW);
    expect(pts).toHaveLength(CONFIG.PROGRESS.TREND_DAYS);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].date.getTime()).toBeGreaterThan(pts[i - 1].date.getTime());
    }
  });

  it('most-recent point equals live retrievable (short-circuit)', () => {
    const store = storeOf([
      topic({ topic_id: 'a', review_history: [studied('e1', NOW.toISOString())] }),
      topic({ topic_id: 'b', k_factor: 12, review_history: [studied('e2', NOW.toISOString())] }),
    ]);
    const live = retr(store, NOW);
    const last = expTrend(store, NOW).at(-1)!;
    expect(last.exp).toBeCloseTo(live.exp, 10);
    expect(last.ceiling).toBe(live.ceiling);
  });

  it('past points reconstruct a lower ceiling before a topic started', () => {
    // Topic's only event is 3 days ago → earliest points predate it → ceiling 0 there.
    const threeAgo = new Date(NOW.getTime() - 3 * 86_400_000).toISOString();
    const store = storeOf([topic({ status: 'practising', last_reviewed: threeAgo,
      review_history: [studied('e', threeAgo)] })]);
    const pts = expTrend(store, NOW);
    expect(pts[0].ceiling).toBe(0); // 6 days ago: not started yet
    expect(pts.at(-1)!.ceiling).toBe(1); // today: started
  });

  it('ratio is exp/ceiling, and 0 when ceiling is 0', () => {
    const pts = expTrend(storeOf([]), NOW);
    expect(pts.every((p) => p.ratio === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/engine/progress.test.ts`
Expected: FAIL — `expTrend` is not exported.

- [ ] **Step 3: Implement**

Append to `src/engine/progress.ts`:

```ts
import { CONFIG } from '@/config/constants';
import { allTopics } from '@/domain/types';
import { MS_PER_DAY, predictRetention } from './retention';
import { topicStateAsOf } from './replay';

export interface TrendPoint {
  date: Date;
  exp: number;
  ceiling: number;
  /** exp / ceiling — the value the sparkline plots (comparable across time). */
  ratio: number;
}

/**
 * EXP over the last `days` days. Past points are reconstructed by forward-replay
 * (never by subtracting increments — kFactor self-tunes over the event set and
 * is not reversible). The most-recent point is short-circuited to live
 * `retrievable`, which makes it exact even for imported topics whose genesis
 * kFactor differs from DECAY_K.
 */
export function expTrend(
  store: Store,
  now: Date = new Date(),
  days: number = CONFIG.PROGRESS.TREND_DAYS,
): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * MS_PER_DAY);

    if (i === 0) {
      const { exp, ceiling } = retrievable(store, now); // live, exact
      out.push({ date: d, exp, ceiling, ratio: ceiling === 0 ? 0 : exp / ceiling });
      continue;
    }

    let exp = 0;
    let ceiling = 0;
    for (const { topic } of allTopics(store)) {
      const started = topic.review_history.some((e) => new Date(e.date).getTime() <= d.getTime());
      if (!started) continue;
      ceiling += 1;
      const asOf = topicStateAsOf(topic, d);
      const r = predictRetention(asOf, d);
      if (r !== null) exp += Math.min(1, r);
    }
    out.push({ date: d, exp, ceiling, ratio: ceiling === 0 ? 0 : exp / ceiling });
  }
  return out;
}
```

Note: merge the two `import { CONFIG }`/`allTopics` lines with any already at the top of the file so there is a single import per module (strict lint). The final top-of-file imports should be:

```ts
import { CONFIG } from '@/config/constants';
import { allTopics, type Store } from '@/domain/types';
import { MS_PER_DAY, predictRetention } from './retention';
import { topicStateAsOf } from './replay';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/progress.test.ts`
Expected: PASS (9 tests total in the file).

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck
git add src/engine/progress.ts tests/engine/progress.test.ts
git commit -m "feat(engine): expTrend — 7-day EXP trend by forward-replay"
```

---

## Task 5: `workLogged` — monotonic effort counter

**Files:**
- Modify: `src/engine/progress.ts`
- Test: `tests/engine/progress.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `allTopics`, `CONFIG.PROGRESS.SESSION_MINUTES`, `Store`
- Produces: `interface WorkLogged { sessions: number; hours: number; papers: number }`; `workLogged(store: Store): WorkLogged`. `sessions` = distinct `source_id` of `source === 'session'` review events; `papers` = `store.exams.length`; `hours` = `round(sessions × SESSION_MINUTES / 60, 1)`.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/progress.test.ts`:

```ts
import { workLogged } from '@/engine/progress';
import type { Exam } from '@/domain/types';

describe('workLogged — monotonic effort', () => {
  it('counts distinct study sessions, not events', () => {
    // Two events sharing one source_id = one session.
    const t = topic({ review_history: [
      { event_id: 'a', date: NOW.toISOString(), kind: 'study_review', source: 'session',
        source_id: 'sess_1', confidence_reported: 4 },
      { event_id: 'b', date: NOW.toISOString(), kind: 'study_review', source: 'session',
        source_id: 'sess_1', confidence_reported: 5 },
    ] });
    expect(workLogged(storeOf([t])).sessions).toBe(1);
  });

  it('counts exams as papers and derives hours from sessions', () => {
    const t = topic({ review_history: [
      { event_id: 'a', date: NOW.toISOString(), kind: 'study_review', source: 'session',
        source_id: 'sess_1', confidence_reported: 4 },
    ] });
    const store = storeOf([t]);
    const exam: Exam = { schema_version: '2.0.0', exam_id: 'ex1', title: 'Mock',
      date: NOW.toISOString(), linked_topic_ids: [], score: 8, max_score: 10 };
    store.exams = [exam];
    const w = workLogged(store);
    expect(w.papers).toBe(1);
    expect(w.hours).toBeCloseTo(CONFIG.PROGRESS.SESSION_MINUTES / 60, 5);
  });

  it('ignores non-session provenance (manual_review) in the session count', () => {
    const t = topic({ review_history: [
      { event_id: 'm', date: NOW.toISOString(), kind: 'study_review', source: 'manual_review',
        source_id: 'man_1', confidence_reported: 4 },
    ] });
    expect(workLogged(storeOf([t])).sessions).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/engine/progress.test.ts`
Expected: FAIL — `workLogged` is not exported.

- [ ] **Step 3: Implement**

Append to `src/engine/progress.ts`:

```ts
export interface WorkLogged {
  sessions: number;
  hours: number;
  papers: number;
}

/**
 * "What have I put in." Derived from append-only history, so it is monotonic by
 * construction — it never falls, which is exactly what EXP can't promise. Hours
 * are a count × nominal duration (duration is decomposed away on ingestion):
 * exact in the count, honest as a proxy in the hours.
 */
export function workLogged(store: Store): WorkLogged {
  const sessionIds = new Set<string>();
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'session') sessionIds.add(e.source_id);
    }
  }
  const sessions = sessionIds.size;
  const hours = Math.round((sessions * CONFIG.PROGRESS.SESSION_MINUTES) / 60 * 10) / 10;
  return { sessions, hours, papers: store.exams.length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/progress.test.ts`
Expected: PASS (all in file).

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck
git add src/engine/progress.ts tests/engine/progress.test.ts
git commit -m "feat(engine): workLogged — monotonic effort counter"
```

---

## Task 6: `topicLevelHighWater` — the evidence ratchet

The surfaced level is the max of `topicLevel` over every boundary in `{ event dates } ∪ { mastered_at }` (plus the live level), evaluated on state reconstructed as-of that boundary. This makes the ratchet a real property: retention decay lowers current `topicLevel`, but never the watermark.

At each boundary we reconstruct: event-sourced fields via `topicStateAsOf`; active errors by date-filtering `error_log`; mastery status via `mastered_at`. Flashcards (`cards`) are not event-sourced and are held at their current value — the one approximation, bounded by the smallest health weight (`W_CARD = 0.1`).

**Files:**
- Modify: `src/engine/leveling.ts`
- Test: `tests/engine/leveling.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `topicStateAsOf` (Task 2), `topicLevel` (existing, `src/engine/leveling.ts`), `Topic`
- Produces: `topicLevelHighWater(topic: Topic, now?: Date): number`

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/leveling.test.ts` (reuse its existing `topic`, `passEvent`, `NOW`):

```ts
import { topicLevelHighWater } from '@/engine/leveling';

describe('topicLevelHighWater — the ratchet', () => {
  it('keeps the peak level after retention decays (never falls with time)', () => {
    // A validated, mastered topic reviewed at NOW: current level is MAX_LEVEL.
    const fresh = topic();
    const peak = topicLevelHighWater(fresh, NOW);
    expect(peak).toBe(MAX_LEVEL);

    // 120 days later with no new events: current topicLevel has dropped...
    const later = new Date(NOW.getTime() + 120 * 86_400_000);
    expect(topicLevel(fresh, later)).toBeLessThan(MAX_LEVEL);
    // ...but the watermark holds.
    expect(topicLevelHighWater(fresh, later)).toBe(MAX_LEVEL);
  });

  it('never drops below the current live level', () => {
    const t = topic({ status: 'practising' });
    expect(topicLevelHighWater(t, NOW)).toBeGreaterThanOrEqual(topicLevel(t, NOW));
  });

  it('reaches level 5 for a topic mastered in the past even if never re-tested since', () => {
    // mastered_at precedes the (only) validating event's decay; the mastery gate
    // must be reconstructed from mastered_at, not from replayed history.
    const masteredLongAgo = topic({
      mastered_at: '2026-02-01T00:00:00Z',
      last_reviewed: '2026-02-01T00:00:00Z',
      review_history: [{ ...passEvent(), date: '2026-02-01T00:00:00Z' }],
    });
    expect(topicLevelHighWater(masteredLongAgo, NOW)).toBe(MAX_LEVEL);
  });

  it('does not fabricate a level for an unvalidated topic', () => {
    const untested = topic({ status: 'practising', mastered_at: null, review_history: [] });
    expect(topicLevelHighWater(untested, NOW)).toBeLessThanOrEqual(CONFIG.LEVEL.UNVALIDATED_CAP);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/engine/leveling.test.ts`
Expected: FAIL — `topicLevelHighWater` is not exported.

- [ ] **Step 3: Implement**

Add to `src/engine/leveling.ts` (after `topicLevel`, before `overallLevel`), and add the import at the top:

```ts
import { topicStateAsOf } from './replay';
```

```ts
/**
 * The ratchet: the highest level this topic has ever legitimately reached.
 *
 * `topicLevel` reads health, which includes retention, so a mastered-then-decayed
 * topic's current level falls. The watermark evaluates `topicLevel` at every
 * boundary where the level could have peaked — each event date (health peaks
 * right after an event, since retention only decays between them) plus
 * `mastered_at` (the status flip that unlocks level 5 need not fall on an event
 * date) — and takes the max. Derived, unstored, and non-decreasing over time.
 *
 * Event-sourced fields are reconstructed exactly via `topicStateAsOf`; active
 * errors are date-filtered from the log; mastery status comes from `mastered_at`.
 * Flashcard count is not event-sourced and is held at its current value — the
 * lone approximation, bounded by W_CARD (the smallest health weight).
 */
export function topicLevelHighWater(topic: Topic, now: Date = new Date()): number {
  const boundaries: Date[] = topic.review_history.map((e) => new Date(e.date));
  if (topic.mastered_at) boundaries.push(new Date(topic.mastered_at));

  let max = topicLevel(topic, now); // live level covers status not present in history

  for (const d of boundaries) {
    if (d.getTime() > now.getTime()) continue;

    const base = topicStateAsOf(topic, d);
    const activeErrors = topic.error_log.filter(
      (e) =>
        new Date(e.date).getTime() <= d.getTime() &&
        (!e.resolved || e.resolved_date === null || new Date(e.resolved_date).getTime() > d.getTime()),
    );
    const mastered = topic.mastered_at !== null && new Date(topic.mastered_at).getTime() <= d.getTime();

    const snapshot: Topic = {
      ...base,
      cards: topic.cards,
      error_log: activeErrors,
      status: mastered ? 'mastered' : base.status,
    };

    const lvl = topicLevel(snapshot, d);
    if (lvl > max) max = lvl;
  }

  return max;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/leveling.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck
git add src/engine/leveling.ts tests/engine/leveling.test.ts
git commit -m "feat(engine): topicLevelHighWater — evidence-ratcheted level"
```

---

## Task 7: `levelUps` — commit-diff detection

**Files:**
- Modify: `src/engine/leveling.ts`
- Test: `tests/engine/leveling.test.ts` (add a `describe` block)

**Interfaces:**
- Consumes: `topicLevelHighWater` (Task 6), `allTopics`, `applyEvent` (for the test), `Store`, `Topic`
- Produces: `interface LevelUp { topic: Topic; from: number; to: number }`; `levelUps(oldStore: Store, newStore: Store, now?: Date): LevelUp[]`. Considers only topics whose `review_history.length` changed between the two stores; returns those whose watermark rose. Never negative by construction.

- [ ] **Step 1: Write the failing test**

Add to `tests/engine/leveling.test.ts`:

```ts
import { levelUps } from '@/engine/leveling';
import { applyEvent } from '@/engine/recalculate';

describe('levelUps — commit diff', () => {
  it('reports a topic whose watermark rose from a validating event', () => {
    // Before: practising, no test → capped at UNVALIDATED_CAP.
    const before = topic({ status: 'practising', mastered_at: null, review_history: [] });
    // After: same topic gains a passing test → validated, uncapped.
    const after = { ...before, review_history: [], strength: before.strength };
    const validated = applyEvent(after, passEvent(), NOW);

    const oldStore = storeOf([before]);
    const newStore = storeOf([validated]);
    const ups = levelUps(oldStore, newStore, NOW);
    expect(ups).toHaveLength(1);
    expect(ups[0].to).toBeGreaterThan(ups[0].from);
    expect(ups[0].topic.topic_id).toBe('topic_x');
  });

  it('ignores topics whose history did not change this commit', () => {
    const t = topic();
    expect(levelUps(storeOf([t]), storeOf([t]), NOW)).toEqual([]);
  });

  it('never returns a negative delta (watermark cannot fall)', () => {
    const before = topic();
    const after = applyEvent(topic(), passEvent(), NOW);
    for (const up of levelUps(storeOf([before]), storeOf([after]), NOW)) {
      expect(up.to).toBeGreaterThan(up.from);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test -- tests/engine/leveling.test.ts`
Expected: FAIL — `levelUps` is not exported.

- [ ] **Step 3: Implement**

Add to `src/engine/leveling.ts` (and extend the top import to include `allTopics`):

```ts
import { allTopics, type Store, type Topic } from '@/domain/types';
```

```ts
export interface LevelUp {
  topic: Topic;
  from: number;
  to: number;
}

/**
 * Level-ups introduced by a single commit. A watermark is a max over past
 * states, so only a topic that received an event this commit can level up —
 * we restrict to topics whose review_history length changed, which makes
 * "level-ups are evidence-only" structural rather than emergent (and avoids a
 * full-corpus scan). Deltas are non-negative by construction.
 */
export function levelUps(oldStore: Store, newStore: Store, now: Date = new Date()): LevelUp[] {
  const oldById = new Map(allTopics(oldStore).map(({ topic }) => [topic.topic_id, topic]));
  const out: LevelUp[] = [];

  for (const { topic } of allTopics(newStore)) {
    const prev = oldById.get(topic.topic_id);
    if (!prev) continue; // brand-new topics start not_started → level 0
    if (prev.review_history.length === topic.review_history.length) continue; // untouched

    const to = topicLevelHighWater(topic, now);
    const from = topicLevelHighWater(prev, now);
    if (to > from) out.push({ topic, from, to });
  }

  return out;
}
```

Note: the existing `leveling.ts` import line is `import { allTopics, type Store, type Topic } from '@/domain/types';` already present at line 2 — verify and do not duplicate it; only add symbols that are missing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/engine/leveling.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck & commit**

```bash
npm run typecheck
git add src/engine/leveling.ts tests/engine/leveling.test.ts
git commit -m "feat(engine): levelUps — commit-diff, evidence-only level-up detection"
```

---

## Task 8: Generalize `Sparkline` for a unitless ratio trend

The `Sparkline` is retention-specific: it requires a `goal` and renders a "Goal N%" label and a dashed goal line, and hardcodes `%` in readouts and the aria-label. Make the goal optional and the unit configurable so it can render the EXP ratio without a goal line. Retention callers keep their exact current behaviour (goal + `%`).

**Files:**
- Modify: `src/components/Sparkline.tsx`
- Test: (covered by the existing app-smoke and a11y suites; add a focused render assertion isn't required — the change is backward-compatible by default)

**Interfaces:**
- Consumes: (unchanged)
- Produces: `Sparkline` gains optional props `goal?: number` (was required), `unit?: string` (default `'%'`). When `goal` is `undefined`, no goal line and no "Goal" label render; the aria-label omits the goal clause.

- [ ] **Step 1: Make `goal` optional and add `unit`**

In `src/components/Sparkline.tsx`, change the prop types (around line 101–116):

```ts
export function Sparkline({
  data,
  goal,
  idPrefix,
  label = 'Average retention',
  locale,
  unit = '%',
}: {
  data: readonly SparkPoint[];
  goal?: number;
  idPrefix?: string;
  label?: string;
  locale?: string;
  /** Value unit rendered in readouts and the label. Defaults to '%'. */
  unit?: string;
}) {
```

- [ ] **Step 2: Guard the goal-driven geometry and text**

Replace uses of `goal` that assume it is a number:

In the `useMemo` domain calc (lines ~148–149), guard the goal clamps:

```ts
    if (goal !== undefined) {
      lo = Math.min(lo, goal);
      hi = Math.max(hi, goal);
    }
```

and the returned `goalY`:

```ts
    return { pts: p, line: l, fill: f, goalY: goal === undefined ? null : y(goal) };
```

Update the destructure `const { pts, line, fill, goalY } = useMemo(...)` — `goalY` is now `number | null`.

Update `formatValue` usages that append `%`: change `describe` (line 231) and the readout markup (line 348) and the empty-state label and the aria-label to use `unit`:

```ts
  const describe = (p: Pt) => `${formatValue(p.v)}${unit} on ${dateFmt.format(p.date)}`;
```

Empty state (lines 222–229) — only show the goal label when a goal exists:

```ts
  if (data.length === 0) {
    return (
      <div className="hero-chart hero-chart--empty" ref={wrapRef}>
        {goal !== undefined && <span className="goal-label">Goal {goal}{unit}</span>}
        <p className="spark-empty">No readings yet. Data appears after the first sync.</p>
      </div>
    );
  }
```

Main render — the goal label (line 235) and the goal `<line>` (lines 267–275):

```ts
      {goal !== undefined && <span className="goal-label">Goal {goal}{unit}</span>}
```

```ts
        {goalY !== null && (
          <line
            x1={PAD_X}
            x2={w - PAD_X}
            y1={goalY}
            y2={goalY}
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        )}
```

aria-label (lines 252–254) — drop the goal clause when absent:

```ts
        aria-label={`${label} over the last ${data.length} days, currently ${formatValue(
          end?.v ?? 0,
        )}${unit}.${goal !== undefined ? ` Goal ${goal}${unit}.` : ''} Use the arrow keys to read individual days.`}
```

Readout markup (line 348):

```ts
          <span className="ro-val">{formatValue(active.v)}{unit}</span>
```

- [ ] **Step 3: Verify retention callers are unaffected**

Run: `npm test -- tests/integration/app-smoke.test.tsx tests/a11y/accessibility.test.tsx`
Expected: PASS (existing behaviour preserved — retention callers pass `goal`, default `unit='%'`).

- [ ] **Step 4: Typecheck & commit**

```bash
npm run typecheck
git add src/components/Sparkline.tsx
git commit -m "refactor(ui): Sparkline goal optional + configurable unit"
```

---

## Task 9: Overview — EXP header + trend + work logged

**Files:**
- Modify: `src/routes/Overview.tsx`
- Test: (covered by `tests/integration/app-smoke.test.tsx`; add a targeted assertion in Step 3)

**Interfaces:**
- Consumes: `retrievable`, `expTrend`, `workLogged` (progress.ts), `Sparkline` + `SparkPoint`, `Prop`
- Produces: (UI only)

- [ ] **Step 1: Wire the derivations**

In `src/routes/Overview.tsx`, add imports:

```ts
import { retrievable, expTrend, workLogged } from '@/engine/progress';
import { Sparkline, type SparkPoint } from '@/components/Sparkline';
```

Inside `Overview`, after the existing `const volume = weeklyVolume(store, now);` line, add:

```ts
  const exp = retrievable(store, now);
  const work = workLogged(store);
  const trend = useMemo<SparkPoint[]>(
    () => expTrend(store, now).map((p) => ({ value: Math.round(p.ratio * 100), date: p.date })),
    [store, now],
  );
```

- [ ] **Step 2: Render the EXP block and the work-logged prop**

Add EXP as a card in the `hero-row` (after the due-card `Card` closes, before the `hero-row` `</div>` at line 236 — or as a new `.section` below the `hero-row`; place it directly under `hero-row` as its own section):

Immediately after the `hero-row` closing `</div>` (line 236), insert:

```tsx
      {exp.ceiling > 0 && (
        <div className="section reveal" style={{ ['--i' as string]: 3 }}>
          <Card>
            <div className="eyebrow-row">
              <Eyebrow>Retrievable now</Eyebrow>
              <Hint
                label="About retrievable now"
                text="How much you could recall across every started topic right now — the sum of each topic's current retention. It falls when you don't study and recovers when you review; that's the point."
              />
            </div>
            <div className="hero-value mono-num">
              {exp.exp.toFixed(1)} <span className="hero-value-sub">/ {exp.ceiling} topics</span>
            </div>
            <Sparkline
              data={trend}
              label="Retrievable knowledge"
              idPrefix="exp-trend"
            />
          </Card>
        </div>
      )}
```

Adjust the `--i` reveal indices of the subsequent blocks so the stagger stays sequential: the `PropsRow` becomes `4`, "Coming up" becomes `5`, "Recent activity" becomes `6` (increment each existing `['--i' …]: N` below the new block by 1).

Add a "Work logged" `Prop` to the existing `PropsRow` (lines 238–254) as a fourth column:

```tsx
        <Prop
          label="Work logged"
          value={work.sessions}
          caption={`${work.sessions === 1 ? 'session' : 'sessions'} · ${work.papers} ${work.papers === 1 ? 'paper' : 'papers'}`}
          hint="Everything you've put in — total study sessions and exam papers. Unlike retrievable-now, this only ever goes up."
        />
```

(`PropsRow` derives its column count from its children, so adding a fourth `Prop` is safe — see `PropsRow.tsx` header comment.)

- [ ] **Step 3: Add a smoke assertion**

In `tests/integration/app-smoke.test.tsx`, find the test that seeds a store with at least one started topic and renders the Overview, and add an assertion that the EXP label appears. If the smoke test uses an empty store, add a new `it` that seeds one practising topic and asserts:

```ts
expect(screen.getByText('Retrievable now')).toBeInTheDocument();
```

(Match the file's existing render/setup helpers rather than introducing new ones.)

- [ ] **Step 4: Run tests + typecheck**

Run: `npm test -- tests/integration/app-smoke.test.tsx`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Overview.tsx tests/integration/app-smoke.test.tsx
git commit -m "feat(ui): Overview EXP header, 7-day trend, and work-logged"
```

---

## Task 10: Level-up toast on commit

Thread level-ups through `commitValue` (which holds both old and new store) to an optional callback the study routes use to fire a celebratory toast.

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/routes/LogSession.tsx`, `src/routes/AddExam.tsx`
- Test: `tests/core/recalc-on-commit.test.ts` (add a level-up-through-commit assertion) — or `tests/core/commit.test.ts`; use whichever already constructs a store + calls the commit path. If neither drives `useStore`, add the assertion at the engine boundary in `tests/engine/leveling.test.ts` instead (already covered by Task 7) and keep this task's tests to a typecheck + manual smoke.

**Interfaces:**
- Consumes: `levelUps`, `LevelUp` (leveling.ts)
- Produces: `commitValue(schemaName, value, onLevelUps?: (ups: LevelUp[]) => void): string | null` — backward compatible (optional third param). On success it calls `onLevelUps?.(levelUps(store, next, new Date()))`.

- [ ] **Step 1: Extend `commitValue` in `useStore`**

In `src/hooks/useStore.ts`, add imports:

```ts
import { levelUps, type LevelUp } from '@/engine/leveling';
```

Change `commitValue` (lines 42–58) to accept and invoke the callback:

```ts
  const commitValue = useCallback(
    (schemaName: SchemaName, value: unknown, onLevelUps?: (ups: LevelUp[]) => void): string | null => {
      try {
        const next = commit(schemaName, value, store, mergeInto);
        saveStore(next); // throws before we adopt the draft
        setUndoSnapshot(store); // the pre-commit state, for the toast's Undo
        setStore(next);
        onLevelUps?.(levelUps(store, next, new Date()));
        return null;
      } catch (e) {
        if (e instanceof StorageError) return e.message;
        return e instanceof Error
          ? `That couldn't be saved: ${e.message}. Your existing data is unchanged.`
          : "That couldn't be saved. Your existing data is unchanged.";
      }
    },
    [store],
  );
```

- [ ] **Step 2: Fire the toast in `LogSession`**

In `src/routes/LogSession.tsx`, widen the `commitValue` prop type (line 26) and pass a level-up handler:

```ts
  commitValue: (
    schemaName: 'session',
    value: unknown,
    onLevelUps?: (ups: import('@/engine/leveling').LevelUp[]) => void,
  ) => string | null;
```

Change the `onCommit` body (lines 44–58) so the commit call passes a handler that toasts each level-up after the success toast:

```tsx
        onCommit={(value) => {
          const error = commitValue('session', value, (ups) => {
            for (const up of ups) {
              toast(`${up.topic.title} reached level ${up.to}`, 'success');
            }
          });
          if (error) {
            toast(error, 'error');
            return;
          }
          toast(COMMIT_VERB.session, 'success', {
            label: 'Undo',
            onClick: () => {
              const err = undoLast();
              toast(err ?? 'Undone.', err ? 'error' : 'info');
            },
          });
          onClose();
        }}
```

- [ ] **Step 3: Fire the toast in `AddExam`**

In `src/routes/AddExam.tsx`, widen the `commitValue` prop type (line 22) identically:

```ts
  commitValue: (
    schemaName: 'exam',
    value: unknown,
    onLevelUps?: (ups: import('@/engine/leveling').LevelUp[]) => void,
  ) => string | null;
```

Change the `onCommit` body (lines 51–65):

```tsx
            onCommit={(value) => {
              const error = commitValue('exam', value, (ups) => {
                for (const up of ups) {
                  toast(`${up.topic.title} reached level ${up.to}`, 'success');
                }
              });
              if (error) {
                toast(error, 'error');
                return;
              }
              toast(COMMIT_VERB.exam, 'success', {
                label: 'Undo',
                onClick: () => {
                  const err = undoLast();
                  toast(err ?? 'Undone.', err ? 'error' : 'info');
                },
              });
              navigate('/exams');
            }}
```

- [ ] **Step 4: Verify the wider signature type-checks against all callers**

Run: `npm run typecheck`
Expected: PASS. If any other caller of `commitValue` (e.g. `QuickAdd`, `AddCourse`, `AddFitness`, `AddJob`) declares a narrower prop type that now mismatches how `App` passes `commitValue`, widen that prop type the same way (optional third param) — the param is optional, so call sites that ignore it need no change.

- [ ] **Step 5: Run the commit suite**

Run: `npm test -- tests/core`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useStore.ts src/routes/LogSession.tsx src/routes/AddExam.tsx
git commit -m "feat(ux): level-up toast fired from the commit diff"
```

---

## Task 11: TopicDetail — level adjacent to retention

**Files:**
- Modify: `src/routes/TopicDetail.tsx`
- Test: `tests/routes/CourseDashboard.test.tsx` opens TopicDetail (or add a focused render in a new `tests/routes/TopicDetail.test.tsx`)

**Interfaces:**
- Consumes: `topicLevelHighWater` (leveling.ts)
- Produces: (UI only) — a "level" stat rendered first in the `.cluster roomy` stats row.

- [ ] **Step 1: Add the level stat**

In `src/routes/TopicDetail.tsx`, add the import:

```ts
import { topicLevelHighWater } from '@/engine/leveling';
```

Compute it alongside `ret`/`oci` (after line 84):

```ts
  const level = topicLevelHighWater(topic, now);
```

Insert a `Stat` as the FIRST child of the `<div className="cluster roomy">` (before the retention `Stat` at line 112), so it reads "Lv 5 · retention 34%" left-to-right:

```tsx
          <Stat
            value={`Lv ${level}`}
            label="level"
            hint="The highest level you've demonstrably reached here — it ratchets on evidence (a passed test, mastery) and never falls, even as retention decays. That's why a high level can sit beside a low retention: one says you got here, the other says it's fading."
          />
```

- [ ] **Step 2: Add a focused render test**

Create `tests/routes/TopicDetail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicDetail } from '@/routes/TopicDetail';
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';

const NOW = new Date('2026-07-20T12:00:00Z');

function masteredTopic(): Topic {
  return {
    topic_id: 't', title: 'Big-O', status: 'mastered',
    conf: 5, strength: 5, k_factor: CONFIG.DECAY_K, cards: 5,
    last_reviewed: NOW.toISOString(), mastered_at: '2026-07-01T00:00:00Z',
    drift_history: [],
    review_history: [{
      event_id: 'p', date: NOW.toISOString(), kind: 'test_pass',
      source: 'exam', source_id: 'x', confidence_reported: 5,
      test: { score: 10, out_of: 10, actual_retention: 1 },
    }],
    error_log: [],
  };
}

describe('TopicDetail — level stat', () => {
  it('shows the high-water level adjacent to retention', () => {
    render(
      <TopicDetail
        topic={masteredTopic()} sectionTitle="Complexity"
        onClose={() => {}} onResolveError={() => {}}
        onPromote={() => {}} onQuickReview={() => {}} now={NOW}
      />,
    );
    expect(screen.getByText(`Lv ${CONFIG.LEVEL.HEALTH_BANDS.length}`)).toBeInTheDocument();
    expect(screen.getByText('level')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test**

Run: `npm test -- tests/routes/TopicDetail.test.tsx`
Expected: PASS.

- [ ] **Step 4: Typecheck & commit**

```bash
npm run typecheck
git add src/routes/TopicDetail.tsx tests/routes/TopicDetail.test.tsx
git commit -m "feat(ui): TopicDetail shows high-water level beside retention"
```

---

## Task 12: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all tests PASS (existing ~300 + the new engine/route tests).

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: both succeed.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `npm run dev`, open the Overview with at least one started topic. Confirm: "Retrievable now — X.X / N topics" with a sparkline; a "Work logged" prop; log a session/exam that pushes a topic across a band and see the level-up toast; open that topic and see "Lv N" beside retention.

- [ ] **Step 4: Final commit (if any lint/format fixups were needed)**

```bash
git add -A
git commit -m "chore: leveling/EXP — full-suite green"
```

---

## Self-Review

**Spec coverage:**
- EXP = Σ retention over started topics, clamped, rendered against ceiling → Task 3 + Task 9. ✓
- Linear (not retention²) → Task 3 (no convex weighting). ✓
- 7-day trend by forward-replay, most-recent short-circuited to live, plots `exp/ceiling` → Task 2 + Task 4 + Task 9. ✓
- Work logged (sessions · hours · papers), monotonic → Task 5 + Task 9. ✓
- Topic level = high-water mark, evidence-ratcheted, never capped to retention, mastery via `mastered_at` boundary → Task 6. ✓
- Level-ups detected at commit time, restricted to commit-touched topics, non-negative → Task 7 + Task 10. ✓
- TopicDetail: level adjacent to retention, "two true statements" → Task 11. ✓
- Overview header EXP + work logged, no global level → Task 9. ✓
- No stored progress; constants in CONFIG → Task 1, and all engine functions derive live. ✓
- Invariants 1–6 encoded as tests → decay/ceiling (Task 3), most-recent-is-live (Task 4), ratchet holds (Task 6), evidence-only + non-negative (Task 7), work-logged monotonic (Task 5), clamp (Task 3). ✓

**Out-of-scope confirmed absent:** no global level, no "level-ups this week" roll-up, no retention² badge, no stored value. ✓

**Type consistency:** `Retrievable`, `TrendPoint`, `WorkLogged`, `LevelUp` are defined once (Tasks 3/4/5/7) and consumed with the same shapes in Tasks 9/10/11. `topicStateAsOf(topic, asOf)`, `topicLevelHighWater(topic, now?)`, `levelUps(old, new, now?)`, `expTrend(store, now?, days?)`, `retrievable(store, now?)`, `workLogged(store)` signatures match across producer and consumer tasks. `commitValue`'s optional third param is the same `(ups: LevelUp[]) => void` in useStore and both routes. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every test step shows the assertions. ✓
