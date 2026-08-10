# Performance Metrics — Phase 4: Prerequisites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `Topic.prerequisites` field (added in Phase 1, accepted by the schema in Phase 2) into a diagnostic: given an underperforming topic, surface the health/retention of its upstream dependency chain so the root cause can be sought upstream — without ever overwriting mastery or any stored state.

**Architecture:** One new pure module `src/engine/prerequisites.ts`. A cycle-safe transitive walk (`upstreamPrerequisites`) resolves a topic's ancestor chain via the store; a diagnostic layer (`prerequisiteInstability`) reads each ancestor's existing Knowledge Health and retention and flags the unstable ones. Read-only: it consumes `health`/`predictRetention`/`shouldShowHealth` but writes nothing and feeds no existing metric.

**Tech Stack:** TypeScript 5.6 (strict), Vitest 2.1.4.

## Global Constraints

- **INVARIANT — diagnostic-only, never mutates (design §6, §E).** `prerequisiteInstability` returns evidence. It MUST NOT write to any topic or the store, and specifically must never overwrite `status`/`mastered_at` or any stored state based on prerequisite inference. Named test asserts the input topic and store are byte-for-byte unchanged after the call.
- **INVARIANT — cycle-safe graph traversal.** The prerequisite graph is assumed a DAG, but a cycle (A→B→A, or a topic listing itself) MUST NOT hang or infinite-loop. The walk carries a `seen` set seeded with the root; each topic is visited at most once, at its shallowest depth. Named test: a cyclic graph terminates and visits each ancestor once.
- **Graceful resolution.** A prerequisite `topic_id` that does not resolve to a topic in the store is skipped silently (no throw) — authoring may reference a not-yet-added topic. Named test covers an unresolvable id.
- **Read-only / no new coupling (design §A).** `prerequisites.ts` reads `health`/`shouldShowHealth` (metrics.ts), `predictRetention` (retention.ts), `allTopics` (types.ts), and `CONFIG`. It must not import any store-writing path and must not be imported by retention/health/leveling — it is a leaf diagnostic.
- **Missing/undefined data → honest nulls.** A prerequisite whose health isn't surfaced (`shouldShowHealth` false) reports `health: null`; a never-reviewed prerequisite reports `retention: null`. Never a false 0.
- **All thresholds are named `CONFIG.PERFORMANCE` constants.** No inline magic numbers.
- **Baseline is NOT fully green.** 18 pre-existing UI failures in `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. Verify against `npm run typecheck` + `tests/engine tests/domain tests/core` (green); treat `npm test` as "same 3 files failing, nothing new."
- **Naming:** subject-agnostic.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/config/constants.ts` | Tunables. | Modify: add `PERFORMANCE.PREREQ_UNSTABLE_HEALTH` (Task 2). |
| `src/engine/prerequisites.ts` | Prerequisite graph traversal + instability diagnostic, pure over `(Topic, Store)`. | Create (Tasks 1–2). |
| `tests/engine/upstream-prerequisites.test.ts` | The cycle-safe transitive walk. | Create (Task 1). |
| `tests/engine/prerequisite-instability.test.ts` | The diagnostic layer + the no-mutation invariant. | Create (Task 2). |

Existing files untouched beyond `constants.ts`.

---

## SEMANTIC KNOB — your call before/at review

`isPrerequisiteUnstable` (Task 2) proposes: a prerequisite is **unstable** when it is (a) `not_started` or `learning` (upstream not consolidated), OR (b) surfaced health `< PREREQ_UNSTABLE_HEALTH` (proposed **45** — the second health band), OR (c) retention `< DUE_THRESHOLD` (decayed, i.e. due). These are proposals; the status set and the 45 threshold are semantic choices you own — adjust at review. The rest of the design does not depend on the exact values.

---

## Task 1: `upstreamPrerequisites` — cycle-safe transitive walk

Resolve a topic's full ancestor chain (direct + transitive), shallowest depth wins, cycle-safe, unresolvable ids skipped.

**Files:**
- Create: `src/engine/prerequisites.ts`
- Test: `tests/engine/upstream-prerequisites.test.ts`

**Interfaces:**
- Consumes: `Topic`, `Store`, `allTopics` (`@/domain/types`).
- Produces:
  - `interface UpstreamTopic { topic: Topic; depth: number; }`
  - `upstreamPrerequisites(root: Topic, store: Store): UpstreamTopic[]` — ancestors in BFS order, each once, `depth` = 1 for direct prerequisites, 2 for their prerequisites, etc.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/upstream-prerequisites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { upstreamPrerequisites } from '@/engine/prerequisites';
import { emptyStore, type Store, type Topic } from '@/domain/types';

function topic(id: string, prerequisites?: string[]): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [],
    ...(prerequisites ? { prerequisites } : {}),
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

const ids = (r: { topic: Topic; depth: number }[]) => r.map((u) => [u.topic.topic_id, u.depth]);

describe('upstreamPrerequisites', () => {
  it('returns direct prerequisites at depth 1', () => {
    const c = topic('topic_c', ['topic_a', 'topic_b']);
    const store = storeOf(c, topic('topic_a'), topic('topic_b'));
    expect(ids(upstreamPrerequisites(c, store)).sort()).toEqual([['topic_a', 1], ['topic_b', 1]]);
  });

  it('walks transitively: A→B→C gives B at depth 1 and A at depth 2', () => {
    const c = topic('topic_c', ['topic_b']);
    const b = topic('topic_b', ['topic_a']);
    const store = storeOf(c, b, topic('topic_a'));
    expect(ids(upstreamPrerequisites(c, store))).toEqual([['topic_b', 1], ['topic_a', 2]]);
  });

  it('is cycle-safe: a cyclic graph terminates and visits each ancestor once', () => {
    // topic_x → A; A → B; B → A  (A↔B cycle upstream of X)
    const x = topic('topic_x', ['topic_a']);
    const a = topic('topic_a', ['topic_b']);
    const b = topic('topic_b', ['topic_a']);
    const result = upstreamPrerequisites(x, storeOf(x, a, b));
    expect(ids(result)).toEqual([['topic_a', 1], ['topic_b', 2]]); // each once, no hang
  });

  it('skips an unresolvable prerequisite id silently', () => {
    const c = topic('topic_c', ['topic_a', 'topic_missing']);
    const store = storeOf(c, topic('topic_a'));
    expect(ids(upstreamPrerequisites(c, store))).toEqual([['topic_a', 1]]);
  });

  it('returns [] for a topic with no prerequisites', () => {
    const c = topic('topic_c');
    expect(upstreamPrerequisites(c, storeOf(c))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/engine/upstream-prerequisites.test.ts` → FAIL (module/export missing).

- [ ] **Step 3: Implement**

Create `src/engine/prerequisites.ts`:

```ts
import type { Store, Topic } from '@/domain/types';
import { allTopics } from '@/domain/types';

/**
 * Prerequisite-graph diagnostics — design 2026-08-10 §E. Pure and read-only:
 * these functions inspect the topic dependency graph to locate upstream
 * instability; they NEVER write to a topic or the store (design §6).
 */

export interface UpstreamTopic {
  topic: Topic;
  /** 1 = direct prerequisite, 2 = prerequisite-of-prerequisite, … (shallowest wins). */
  depth: number;
}

/**
 * The full ancestor chain of `root` in the prerequisite graph — direct and
 * transitive — in breadth-first order, each topic visited once at its shallowest
 * depth. Cycle-safe (a `seen` set seeded with the root; the graph is assumed a
 * DAG but a cycle cannot hang). Unresolvable prerequisite ids are skipped.
 */
export function upstreamPrerequisites(root: Topic, store: Store): UpstreamTopic[] {
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const seen = new Set<string>([root.topic_id]);
  const out: UpstreamTopic[] = [];

  let frontier: Array<{ id: string; depth: number }> = [];
  for (const id of root.prerequisites ?? []) {
    if (!seen.has(id)) { seen.add(id); frontier.push({ id, depth: 1 }); }
  }

  while (frontier.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of frontier) {
      const t = byId.get(id);
      if (!t) continue; // unresolvable id — skip (already marked seen, won't revisit)
      out.push({ topic: t, depth });
      for (const pid of t.prerequisites ?? []) {
        if (!seen.has(pid)) { seen.add(pid); next.push({ id: pid, depth: depth + 1 }); }
      }
    }
    frontier = next;
  }

  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/engine/prerequisites.ts tests/engine/upstream-prerequisites.test.ts
git commit -m "feat(prerequisites): cycle-safe transitive upstream walk

upstreamPrerequisites resolves a topic's ancestor chain (direct +
transitive) in BFS order, each once at shallowest depth; cycle-safe via a
seen-set seeded with the root; unresolvable ids skipped. Pure, read-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `prerequisiteInstability` — the diagnostic layer

Layer each ancestor's existing Knowledge Health and retention onto the walk, flag the unstable ones, count them. Diagnostic-only.

**⚠ INVARIANT (Global Constraints #1):** this function MUST NOT mutate the topic or the store — no mastery overwrite, no status change. Named test asserts input topic + store unchanged after the call.

**Files:**
- Modify: `src/config/constants.ts` (add `PERFORMANCE.PREREQ_UNSTABLE_HEALTH`)
- Modify: `src/engine/prerequisites.ts` (append)
- Test: `tests/engine/prerequisite-instability.test.ts`

**Interfaces:**
- Consumes: `upstreamPrerequisites` (Task 1); `health`, `shouldShowHealth` (`@/engine/metrics`); `predictRetention` (`@/engine/retention`); `CONFIG.PERFORMANCE.PREREQ_UNSTABLE_HEALTH`, `CONFIG.DUE_THRESHOLD`; `Topic`, `Store`, `TopicStatus` (`@/domain/types`).
- Produces:
  - `interface PrerequisiteHealth { topic_id: string; title: string; depth: number; status: TopicStatus; health: number | null; retention: number | null; unstable: boolean; }`
  - `interface PrerequisiteReport { topic_id: string; upstream: PrerequisiteHealth[]; unstableCount: number; }`
  - `prerequisiteInstability(topic: Topic, store: Store, now?: Date): PrerequisiteReport`

- [ ] **Step 1: Add the config threshold**

In `src/config/constants.ts`, inside the `PERFORMANCE` block (alongside the `MIN_*` thresholds), add:

```ts
    /** A prerequisite with surfaced health below this is flagged unstable
     *  (design §E — the second health band; diagnostic only, tunable). */
    PREREQ_UNSTABLE_HEALTH: 45,
```

- [ ] **Step 2: Write the failing test**

Create `tests/engine/prerequisite-instability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { prerequisiteInstability } from '@/engine/prerequisites';
import { emptyStore, type Store, type Topic, type TopicStatus } from '@/domain/types';

function topic(id: string, over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'mastered', conf: 5, strength: 20,
    k_factor: 8.4, cards: 5, last_reviewed: '2026-08-10T00:00:00.000Z', mastered_at: '2026-08-05T00:00:00.000Z',
    drift_history: [], review_history: [], error_log: [], ...over,
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

const NOW = new Date('2026-08-10T12:00:00.000Z');
const find = (r: { upstream: { topic_id: string; unstable: boolean }[] }, id: string) =>
  r.upstream.find((u) => u.topic_id === id)!;

describe('prerequisiteInstability', () => {
  it('flags a not_started prerequisite as unstable (upstream not learned)', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, mastered_at: null, strength: 0 });
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').unstable).toBe(true);
  });

  it('flags a weak-health practising prerequisite as unstable', () => {
    // practising with 3 active errors + no cards drives health below 45.
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', {
      status: 'practising', conf: 1, cards: 0, last_reviewed: '2026-07-01T00:00:00.000Z', strength: 0.5,
      error_log: [1, 2, 3].map((n) => ({
        error_id: `error_${n}`, date: '2026-07-01T00:00:00.000Z', source: 'session' as const,
        source_id: 'session_1', error_type: 'conceptual' as const, description: 'x', resolved: false, resolved_date: null,
      })),
    });
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').health).not.toBeNull();
    expect(find(r, 'topic_a').unstable).toBe(true);
  });

  it('flags a decayed (due) prerequisite as unstable', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    // mastered but last reviewed long ago → retention below DUE_THRESHOLD.
    const a = topic('topic_a', { last_reviewed: '2026-01-01T00:00:00.000Z', strength: 1 });
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').retention).not.toBeNull();
    expect(find(r, 'topic_a').unstable).toBe(true);
  });

  it('does NOT flag a solid, recently-reviewed mastered prerequisite', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a'); // mastered, strong, reviewed today
    const r = prerequisiteInstability(c, storeOf(c, a), NOW);
    expect(find(r, 'topic_a').unstable).toBe(false);
    expect(r.unstableCount).toBe(0);
  });

  it('carries transitive depth and counts unstable ancestors', () => {
    const c = topic('topic_c', { prerequisites: ['topic_b'] });
    const b = topic('topic_b', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, mastered_at: null, strength: 0 });
    const r = prerequisiteInstability(c, storeOf(c, b, a), NOW);
    expect(find(r, 'topic_a').depth).toBe(2);
    expect(r.unstableCount).toBeGreaterThanOrEqual(1);
  });

  it('INVARIANT: does not mutate the topic or the store (diagnostic only)', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, mastered_at: null, strength: 0 });
    const store = storeOf(c, a);
    const before = JSON.stringify(store);
    const cBefore = JSON.stringify(c);
    prerequisiteInstability(c, store, NOW);
    expect(JSON.stringify(store)).toBe(before);
    expect(JSON.stringify(c)).toBe(cBefore);
  });
});
```

- [ ] **Step 3: Run to verify it fails** — `npx vitest run tests/engine/prerequisite-instability.test.ts` → FAIL (not exported).

- [ ] **Step 4: Implement**

Append to `src/engine/prerequisites.ts` (and add the imports at the top of the file):

```ts
// add to the imports at the top:
//   import { CONFIG } from '@/config/constants';
//   import type { Store, Topic, TopicStatus } from '@/domain/types';
//   import { health, shouldShowHealth } from './metrics';
//   import { predictRetention } from './retention';

export interface PrerequisiteHealth {
  topic_id: string;
  title: string;
  depth: number;
  status: TopicStatus;
  /** Knowledge Health, or null when not surfaced (not practising/mastered). */
  health: number | null;
  /** Predicted retention 0–1, or null when never reviewed. */
  retention: number | null;
  unstable: boolean;
}

export interface PrerequisiteReport {
  topic_id: string;
  upstream: PrerequisiteHealth[];
  unstableCount: number;
}

/** A prerequisite is unstable when upstream isn't consolidated (not_started /
 *  learning), or its surfaced health is weak, or it has decayed below the due
 *  threshold (design §E — proposed rule; thresholds are tunable). */
function isPrerequisiteUnstable(pre: Topic, h: number | null, r: number | null): boolean {
  if (pre.status === 'not_started' || pre.status === 'learning') return true;
  if (h !== null && h < CONFIG.PERFORMANCE.PREREQ_UNSTABLE_HEALTH) return true;
  if (r !== null && r < CONFIG.DUE_THRESHOLD) return true;
  return false;
}

/**
 * Diagnostic evidence for a topic's upstream dependency chain (design §6, §E).
 * For each ancestor, reports its Knowledge Health, retention, and an `unstable`
 * flag, so a repeatedly-failing downstream topic can point at unstable upstream
 * topics rather than assuming itself the root. READ-ONLY: never writes to a topic
 * or the store, never overwrites mastery.
 */
export function prerequisiteInstability(topic: Topic, store: Store, now: Date = new Date()): PrerequisiteReport {
  const upstream = upstreamPrerequisites(topic, store).map(({ topic: pre, depth }): PrerequisiteHealth => {
    const h = shouldShowHealth(pre) ? health(pre, now) : null;
    const r = predictRetention(pre, now);
    return {
      topic_id: pre.topic_id,
      title: pre.title,
      depth,
      status: pre.status,
      health: h,
      retention: r,
      unstable: isPrerequisiteUnstable(pre, h, r),
    };
  });
  return { topic_id: topic.topic_id, upstream, unstableCount: upstream.filter((u) => u.unstable).length };
}
```

- [ ] **Step 5: Run to verify it passes** — test PASS; `npm run typecheck` GREEN.

- [ ] **Step 6: Full verification**

Run: `npx vitest run tests/engine tests/domain tests/core`
Expected: PASS (all green including the two new files).

Run: `npm test`
Expected: same 3 pre-existing UI files failing, nothing new.

- [ ] **Step 7: Commit**

```bash
git add src/config/constants.ts src/engine/prerequisites.ts tests/engine/prerequisite-instability.test.ts
git commit -m "feat(prerequisites): upstream instability diagnostic

prerequisiteInstability reports each ancestor's Knowledge Health, retention,
and an unstable flag (upstream unconsolidated / weak health / decayed), with
a transitive depth and an unstable count. Diagnostic only — never writes to a
topic or the store, never overwrites mastery.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §6, §E — Phase 4 scope):**
- Topic dependency graph traversal (direct + transitive) → Task 1 `upstreamPrerequisites`. ✔
- Upstream instability diagnostic (inspect A/B when C fails) → Task 2 `prerequisiteInstability`. ✔
- Diagnostic evidence only, never overwrites mastery (§6) → Global Constraint + Task 2 no-mutation named test. ✔
- Cycle-safe DAG assumption → Task 1 cycle named test + `seen` set. ✔
- Reads existing health/retention, no new coupling → imports from metrics/retention only, read-only. ✔

**2. Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. ✔

**3. Type consistency:** `UpstreamTopic { topic, depth }` (Task 1) is consumed by Task 2's `.map(({ topic, depth }) => …)`. `PrerequisiteHealth`/`PrerequisiteReport` field names match between the interface, the implementation, and the tests (`topic_id`, `title`, `depth`, `status`, `health`, `retention`, `unstable`, `upstream`, `unstableCount`). `prerequisiteInstability(topic, store, now?)` signature matches the tests' calls. `PREREQ_UNSTABLE_HEALTH` is defined in Task 2 Step 1 and read in Step 4. ✔

**4. The two invariants:** cycle-safety (Task 1 named test: cyclic graph terminates, each once) and diagnostic-only/no-mutation (Task 2 named test: store + topic JSON unchanged after call). ✔

**5. Read-only:** `prerequisites.ts` imports `allTopics`/types, `CONFIG`, `health`/`shouldShowHealth`, `predictRetention` — all read-only; writes nothing; no store-writing import. ✔

**6. Semantic knob surfaced:** the `isPrerequisiteUnstable` rule (status set + `PREREQ_UNSTABLE_HEALTH = 45`) is flagged for the user's confirmation, not silently chosen.
