# Phase 2 — Distance-Attenuated Soft Gating (G_soft) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / test-driven-development. Every task is RED → GREEN → commit.

**Goal:** Add a bounded, distance-attenuated, evidence-driven soft-gating factor `G_soft(v_j) ∈ (0,1]` and stop transitive ancestry from producing hard prerequisite blocks, so a weak *remote* ancestor never deadlocks or preempts a learner's actual work (workflow.md §5–12, §52, §53).

**Architecture:** New pure module `src/engine/gating.ts` computes `G_soft` from the prerequisite graph, reusing Phase 1's distance layer (`upstreamPrerequisites` depth), `mastery` (D1), and the existing Jaccard `calculateSignatureSimilarity` as `S_err` (D2). `prerequisiteInstability`/`prerequisiteGuards` are refactored so only **direct** (`d=1`) competency failures — or a **causal high-severity error match** — hard-block; transitive instability is downgraded to a medium/this_week nudge. `G_soft` itself is unit-tested here; it is *consumed* by `u_found` in Phase 3.

## Global Constraints

- Derive-don't-store; pure functions; named constants in `constants.ts` (`RECO.*`).
- `G_soft ∈ [SOFT_GATE_FLOOR, 1]`, never 0 (workflow §11, §47, §54.4).
- Graph traversal cycle-safe (reuse `upstreamPrerequisites`, already `seen`-guarded).
- Baseline branch: `fix/engine-workflow-remediation`, after Phase 1 (`70743fe`).

## Resolved decisions

- **P2-D1 — `S_err` when un-evidenced = `0.0`** (`RECO.S_ERR_UNEVIDENCED`). Soft-gating is evidence-driven: an ancestor dampens a target only when both carry active error patterns whose signatures overlap (workflow §8, §53). No error data → `S_err=0` → the ancestor's factor is `1` (no-op). *(Flagged for veto.)*
- **P2-D2 — `S_err` aggregation = max** over pairs of (ancestor active pattern, target active pattern) via `calculateSignatureSimilarity`. Any error_type pair may match (a shared misconception is the signal); the function's own semantics handle overlap.
- **P2-D3 — Top-K = 3, floor = 0.10** (`RECO.SOFT_GATE_TOP_K`, `RECO.SOFT_GATE_FLOOR`, already defined in Phase 1).

## Mathematical formulation

For target `v_j` with ancestor set `A(v_j)` (each at shortest distance `d`):

- `α(d) = GAMMA_DEPTH^(d-1)` (0.5^(d-1))
- `L(v_i) = mastery(v_i)` (health/100)
- `S_err(v_i, v_j) = ` max signature similarity between `v_i`'s and `v_j`'s active error patterns, else `S_ERR_UNEVIDENCED`
- Causal impact `C(v_i) = (1 − L(v_i)) · α(d) · S_err(v_i, v_j)`
- `G_soft(v_j) = max(SOFT_GATE_FLOOR, ∏_{v_i ∈ topK(C)} [1 − C(v_i)])`, `topK` = the 3 highest-`C` ancestors.

---

### Task 1: `calculateSoftGating` module (`src/engine/gating.ts`)

**Files:**
- Create: `src/engine/gating.ts`
- Modify: `src/config/constants.ts` (add `RECO.S_ERR_UNEVIDENCED`)
- Test: `tests/engine/soft-gating.test.ts`

**Interfaces:**
- Produces:
```typescript
export interface AncestorCausalImpact {
  topicId: string; title: string;
  distance: number; mastery: number; attenuation: number;
  errorSimilarity: number; causalImpact: number;
}
export function calculateSoftGating(
  target: Topic, store: Store, now?: Date,
): { score: number; topBlockers: AncestorCausalImpact[] };
```
- Consumes: `upstreamPrerequisites` (`prerequisites.ts`), `mastery` (`prerequisites.ts`), `calculateSignatureSimilarity` + `patternStatus` (`errors.ts`), `CONFIG.RECO`.

- [ ] **Step 1: add the constant**

```typescript
// constants.ts — inside CONFIG.RECO
/** S_err when either topic has no active error patterns (workflow §54.4, P2-D1):
 *  0 = evidence-driven soft gating (an ancestor dampens only on real misconception
 *  overlap). Raise toward 1 to also attenuate on distance+mastery alone. */
S_ERR_UNEVIDENCED: 0,
```

- [ ] **Step 2: write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateSoftGating } from '@/engine/gating';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type ErrorPattern, type Store, type Topic } from '@/domain/types';

function t(id: string, prerequisites: string[] = [], o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites, ...o };
}
// active error pattern on `topicId` with a given signature
function pat(id: string, topicId: string, signature: string, severity: 'low'|'medium'|'high' = 'high'): ErrorPattern {
  return { pattern_id: id, signature, error_type: 'conceptual', topic_ids: [topicId],
    severity, occurrence_ids: [`occ_${id}`], first_seen: '2026-08-01T00:00:00Z', last_seen: '2026-08-10T00:00:00Z' };
}
function storeOf(topics: Topic[], patterns: ErrorPattern[] = []): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); s.error_patterns.push(...patterns); return s;
}
// chain A -> B -> C -> D -> E
function chain(patterns: ErrorPattern[] = []): Store {
  return storeOf([t('A'), t('B', ['A']), t('C', ['B']), t('D', ['C']), t('E', ['D'])], patterns);
}
const target = (s: Store, id: string) => s.courses[0]!.sections[0]!.topics.find((x) => x.topic_id === id)!;

describe('calculateSoftGating', () => {
  it('is 1.0 when there are no ancestors', () => {
    const s = storeOf([t('solo')]);
    expect(calculateSoftGating(target(s, 'solo'), s).score).toBe(1);
  });

  it('is 1.0 when ancestors carry no error evidence (S_err = 0)', () => {
    const s = chain(); // no patterns → S_err 0 everywhere
    expect(calculateSoftGating(target(s, 'E'), s).score).toBe(1);
  });

  it('a remote (d=4) ancestor with a STRONG matching misconception is only mildly dampened', () => {
    // A and E share an identical signature → S_err ≈ 1; A is unmastered (not_started).
    const s = chain([pat('pa', 'A', 'sign error carrying negative'), pat('pe', 'E', 'sign error carrying negative')]);
    const g = calculateSoftGating(target(s, 'E'), s).score;
    // α(4)=0.5^3=0.125, C=(1-L)·0.125·~1 ≈ 0.125 → score ≈ 0.875, bounded well above deadlock
    expect(g).toBeGreaterThan(0.80);
    expect(g).toBeLessThan(1);
  });

  it('a DIRECT (d=1) strong match dampens MORE than the same match at distance', () => {
    const remote = calculateSoftGating(
      target(chain([pat('pa', 'A', 'sign error carrying negative'), pat('pe', 'E', 'sign error carrying negative')]), 'E'),
      chain([pat('pa', 'A', 'sign error carrying negative'), pat('pe', 'E', 'sign error carrying negative')]),
    ).score;
    const ds = storeOf([t('P'), t('Q', ['P'])],
      [pat('pp', 'P', 'sign error carrying negative'), pat('pq', 'Q', 'sign error carrying negative')]);
    const direct = calculateSoftGating(target(ds, 'Q'), ds).score;
    expect(direct).toBeLessThan(remote);            // α(1)=1 > α(4)=0.125
    expect(direct).toBeGreaterThanOrEqual(CONFIG.RECO.SOFT_GATE_FLOOR);
  });

  it('caps a dense DAG to the top-3 contributors and never drops below the floor', () => {
    // NOTE: health-derived mastery floors ~0.45 for evidence-free topics, so the
    // top-3 product stays a little above FLOOR here; this asserts the CAP + bound.
    const roots = Array.from({ length: 10 }, (_, i) => t(`r${i}`));
    const leaf = t('leaf', roots.map((r) => r.topic_id));
    const patterns = [pat('pl', 'leaf', 'shared misconception token'),
      ...roots.map((r, i) => pat(`pr${i}`, r.topic_id, 'shared misconception token'))];
    const s = storeOf([...roots, leaf], patterns);
    const res = calculateSoftGating(target(s, 'leaf'), s);
    expect(res.topBlockers.length).toBe(3);
    expect(res.score).toBeGreaterThanOrEqual(CONFIG.RECO.SOFT_GATE_FLOOR);
    expect(res.score).toBeLessThan(1);
  });

  it('clamps to the floor for a genuinely near-zero-mastery direct ancestor', () => {
    // P: no retention, 3 active errors, a wildly miscalibrated fail → health ≈ 3 → L ≈ 0.03.
    const errs: ErrorLogEntry[] = ['e1', 'e2', 'e3'].map((id) => ({ error_id: id, date: '2026-06-01T00:00:00Z',
      source: 'session', source_id: 's', error_type: 'conceptual', description: 'd', resolved: false, resolved_date: null }));
    const weakP = t('P', [], { status: 'learning', conf: 1, strength: 1, last_reviewed: '2026-06-01T00:00:00Z',
      error_log: errs, review_history: [{ event_id: 'tf', date: '2026-06-01T00:00:00Z', kind: 'test_fail',
        source: 'exam', source_id: 'x', confidence_reported: 5, test: { score: 0, out_of: 10, actual_retention: 0 } }] });
    const q = t('Q', ['P'], { status: 'practising' });
    const s = storeOf([weakP, q], [pat('pp', 'P', 'sign error negative'), pat('pq', 'Q', 'sign error negative')]);
    expect(calculateSoftGating(target(s, 'Q'), s, NOW).score).toBe(CONFIG.RECO.SOFT_GATE_FLOOR);
  });
});
```

- [ ] **Step 3: run — expect FAIL** (`module missing`). `npx vitest run tests/engine/soft-gating.test.ts`

- [ ] **Step 4: implement**

```typescript
// src/engine/gating.ts
import { CONFIG } from '@/config/constants';
import { allTopics, type Store, type Topic } from '@/domain/types';
import { upstreamPrerequisites, mastery } from './prerequisites';
import { patternStatus, calculateSignatureSimilarity } from './errors';

export interface AncestorCausalImpact {
  topicId: string; title: string;
  distance: number; mastery: number; attenuation: number;
  errorSimilarity: number; causalImpact: number;
}

function activePatterns(topicId: string, store: Store, now: Date) {
  return store.error_patterns.filter(
    (p) => p.topic_ids.includes(topicId) && patternStatus(p, store, now).status !== 'verified_resolved',
  );
}

/** S_err: max signature similarity between the ancestor's and target's active
 *  error patterns; S_ERR_UNEVIDENCED when either side has none (P2-D1). */
function errorSimilarity(ancestorId: string, targetId: string, store: Store, now: Date): number {
  const anc = activePatterns(ancestorId, store, now);
  const tgt = activePatterns(targetId, store, now);
  if (anc.length === 0 || tgt.length === 0) return CONFIG.RECO.S_ERR_UNEVIDENCED;
  let max = 0;
  for (const a of anc) for (const t of tgt) max = Math.max(max, calculateSignatureSimilarity(a, t));
  return max;
}

/**
 * Distance-attenuated, bounded, evidence-driven soft-gating factor (workflow §11):
 *   G_soft = max(FLOOR, ∏_{topK} [1 − (1−L)·α(d)·S_err])
 * Only the top-K ancestors by causal impact contribute (§54.4), so a dense DAG
 * cannot compound into an unbounded penalty. Read-only; cycle-safe via
 * `upstreamPrerequisites`.
 */
export function calculateSoftGating(
  target: Topic, store: Store, now: Date = new Date(),
): { score: number; topBlockers: AncestorCausalImpact[] } {
  const ancestors = upstreamPrerequisites(target, store).map(({ topic: anc, depth }): AncestorCausalImpact => {
    const L = mastery(anc, now);
    const attenuation = Math.pow(CONFIG.RECO.GAMMA_DEPTH, depth - 1);
    const errorSim = errorSimilarity(anc.topic_id, target.topic_id, store, now);
    return {
      topicId: anc.topic_id, title: anc.title, distance: depth, mastery: L,
      attenuation, errorSimilarity: errorSim,
      causalImpact: (1 - L) * attenuation * errorSim,
    };
  });

  const topBlockers = ancestors
    .sort((a, b) => b.causalImpact - a.causalImpact)
    .slice(0, CONFIG.RECO.SOFT_GATE_TOP_K);

  const product = topBlockers.reduce((acc, a) => acc * (1 - a.causalImpact), 1);
  return { score: Math.max(CONFIG.RECO.SOFT_GATE_FLOOR, product), topBlockers };
}
```

- [ ] **Step 5: run — expect PASS.** Then `npx vitest run tests/engine` (no regressions).

- [ ] **Step 6: commit** — `feat(engine): distance-attenuated bounded soft-gating factor (workflow §11, P2-D1)`

---

### Task 2: bound transitive hard-blocking; downgrade transitive prereq priority

**Files:**
- Modify: `src/engine/prerequisites.ts` (`prerequisiteInstability` — cap `isBlocking` by depth)
- Modify: `src/engine/recommend.ts` (`prerequisiteGuards` — priority by depth)
- Test: `tests/engine/prerequisite-soft-gating.test.ts`

**Interfaces:**
- No signature changes. Behavior: `isBlocking` is true for a `d=1` failure as before, but for `d>1` only when the ancestor has an active **high-severity** error pattern that also tags the target (causal). `prerequisiteGuards` emits `high`/`within_48h` for a direct blocker, `medium`/`this_week` for a transitive causal one.

- [ ] **Step 1: write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { prerequisiteInstability } from '@/engine/prerequisites';
import { recommend } from '@/engine/recommend';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function t(id: string, prerequisites: string[] = [], o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], prerequisites, ...o };
}
function storeOf(topics: Topic[]): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); return s;
}
const NOW = new Date('2026-08-20T00:00:00.000Z');

describe('bounded transitive blocking (workflow §5–9)', () => {
  it('a weak REMOTE ancestor (d>1, status-only) does not hard-block the target', () => {
    // C depends on B depends on A; A is merely not_started (weak by status, no errors).
    const s = storeOf([t('A', [], { status: 'not_started', last_reviewed: null }),
      t('B', ['A'], { status: 'not_started', last_reviewed: null }),
      t('C', ['B'])]);
    const report = prerequisiteInstability(s.courses[0]!.sections[0]!.topics[2]!, s, NOW);
    // A is at depth 2 relative to C — it may be flagged unstable, but NOT blocking.
    const remote = report.upstream.find((u) => u.topic_id === 'A')!;
    expect(remote.isBlocking).toBe(false);
  });

  it('does not emit a HIGH-priority prerequisite recommendation for purely transitive weakness', () => {
    const s = storeOf([t('A', [], { status: 'not_started', last_reviewed: null }),
      t('B', ['A'], { status: 'not_started', last_reviewed: null }),
      t('C', ['B'])]);
    const recs = recommend(s, NOW);
    const highPrereq = recs.find((r) => r.action === 'prerequisite' && r.priority === 'high');
    expect(highPrereq).toBeUndefined();
  });
});
```

- [ ] **Step 2: run — expect FAIL** (current logic flags the remote ancestor blocking / emits high).

- [ ] **Step 3: implement** — in `prerequisiteInstability`, after the `isBlocking` branches compute, add the depth bound before the `return`:

```typescript
// Phase 2 (workflow §5–9): a TRANSITIVE ancestor (d>1) never hard-blocks on
// status/capability alone — only a matching high-severity error keeps it blocking.
if (depth > 1 && isBlocking) {
  isBlocking = preHasActiveErrors
    && activeErrors.some((p) => p.severity === 'high' && p.topic_ids.includes(topic.topic_id));
}
```

Then in `recommend.ts` `prerequisiteGuards`, set priority by the chosen blocker's depth:

```typescript
const isDirect = unstable.depth === 1;
out.push({
  action: 'prerequisite',
  target: { kind: 'topic', id: unstable.topic_id, title: unstable.title },
  evidence,
  priority: isDirect ? 'high' : 'medium',
  when: isDirect ? 'within_48h' : 'this_week',
  est_duration_minutes: EST_MINUTES.prerequisite,
  reason,
});
```

- [ ] **Step 4: run — expect PASS.** Then `npx vitest run tests/engine` and fix any spec that encoded the old transitive-hard-block semantics (update faithfully, with a comment noting the intentional §5–9 change — as in Phase 1).

- [ ] **Step 5: commit** — `fix(engine): bound transitive prerequisite blocking + downgrade its priority (workflow §5–9)`

---

### Task 3: integration & regression invariants

**Files:**
- Test: `tests/engine/prerequisite-soft-gating.test.ts` (extend)

**Interfaces:** none new — asserts system-level invariants.

- [ ] **Step 1: write the failing/【guard】 tests**

```typescript
import { calculateSoftGating } from '@/engine/gating';

describe('soft-gating invariants (workflow §47, §54.4)', () => {
  it('score stays within [FLOOR, 1] for a deep chain with mixed evidence', () => {
    const s = storeOf([t('A', [], { status: 'not_started', last_reviewed: null }),
      t('B', ['A']), t('C', ['B']), t('D', ['C']), t('E', ['D'])]);
    const g = calculateSoftGating(s.courses[0]!.sections[0]!.topics[4]!, s, NOW).score;
    expect(g).toBeGreaterThanOrEqual(CONFIG.RECO.SOFT_GATE_FLOOR);
    expect(g).toBeLessThanOrEqual(1);
  });

  it('allows downstream progress: a non-causal upstream failure leaves the target eligible', () => {
    // E's remote ancestor A is weak but shares NO error signature → E not blocked.
    const s = storeOf([t('A', [], { status: 'not_started', last_reviewed: null }),
      t('B', ['A']), t('C', ['B']), t('D', ['C']),
      t('E', ['D'], { status: 'not_started', last_reviewed: null })]);
    const pos = curriculumPosition(s, NOW); // from '@/engine/planning'
    expect(pos.blockedTopics.map((b) => b.topicId)).not.toContain('E');
  });
});
```

- [ ] **Step 2–4:** run → expect PASS given Tasks 1–2 (these are guard tests over already-implemented behavior; if any fails it reveals a real gap → return to Task 2). `npx vitest run` full suite must be green; `tsc -b --noEmit` clean; `npm run build` clean.

- [ ] **Step 5: commit** — `test(engine): soft-gating invariants + downstream-progress regression`

---

## Self-review checklist

- Spec coverage: §7 attenuation (Task 1 α), §8 causal (S_err), §11 product (Task 1), §54.4 bound (top-K+floor), §5–9 bounded blocking (Task 2), §53 no-deadlock (Task 3).
- No placeholders: all steps carry real code.
- Type consistency: `calculateSoftGating` / `AncestorCausalImpact` used identically across tasks; `RECO.S_ERR_UNEVIDENCED` matches constant.

## Not in scope (deferred)

- Wiring `G_soft` into `u_found` and the MAUT score → **Phase 3**.
- Aging / interleaving → **Phase 4**.
