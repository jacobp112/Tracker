# Adaptive Recommendation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement Phase 1 task-by-task. Phases 2+ are **gated on the decisions in Part D** and get their own plans once those are resolved.

**Goal:** Replace the rigid, status-based prerequisite cascade with distance-aware bounded gating and continuous Multi-Attribute Utility (MAUT) arbitration, per `docs/workflow.md`, without a blind rewrite and without inventing data the product does not collect.

**Architecture:** Keep the derive-don't-store discipline (spec §3, already the codebase norm). Introduce a real graph-distance layer, a bounded direct-only hard gate, a soft-gating attenuation factor, and a MAUT scorer that supersedes the priority cascade. Adopt the spec incrementally, each phase independently shippable, with the research-grade subsystems (BKT, IRT/CAT cold-start, 1000-learner simulation) explicitly gated on decisions and new data pipelines.

**Tech Stack:** TypeScript, Vitest, React 18, local-first (`localStorage`). No new runtime deps anticipated for Phases 1–3.

**Spec authority:** `docs/workflow.md` (§55 workflow is binding: read → trace → compare → report → **resolve with the user** → implement → test). This plan executes the "read/trace/compare/report" stages and stages the "resolve/implement" work behind a decision gate.

## Global Constraints

- Everything derived live; nothing in the list at spec §3 becomes stored mutable state (matches current `recommend()` / `retention.ts`).
- Every tunable is a named constant in `src/config/constants.ts` (existing repo rule; the file self-validates weight sums — extend that guard to any new weight table).
- MAUT weights must sum to 1 after normalization, be non-negative before normalization, and be deterministic for identical input (spec §47, §54.6).
- Utility components clamped to their declared range `[0,1]` (spec §47, §54.5).
- Graph must stay acyclic; shortest-path distance must be a real value, never a `direct/transitive` boolean (spec §4.1, §35.2, §47).
- Baseline branch for all work: `fix/engine-workflow-remediation` (the V1–V6 remediation commits `fc10a42`, `aae790c`). The working tree already contains substantial uncommitted learning-system WIP; this plan treats that tree as the baseline.

---

## Part A — Current execution path (traced)

`recommend(store, now)` in `src/engine/recommend.ts` is the single decision authority. It:

1. Runs six guards → candidate `Recommendation[]`: `errorGuards`, `prerequisiteGuards`, `reviewGuards`, `retrieveGuards`, `assessGuards`, `learnGuards`.
2. Dedupes by `target` keeping the highest static priority band (`rankKey = PRIORITY_RANK*10 + WHEN_RANK`).
3. Enriches with `evidenceConfidence` (`evidence-confidence.ts`) and `actionValue` (`action-value.ts`: feasibility vs. `TimeBudget`, `downstreamValue`).
4. Sorts: priority band → feasibility → **action cascade** (`remediate>prerequisite>review>retrieve>assess>learn`) → downstream value → **alphabetical title**.

Supporting math already present and **spec-aligned**:

- `retention.ts`: `R(t)=e^{-t/(k·s)}` — identical form to spec §3/§15. `s = effectiveStrength` (lapse-penalised). Due threshold `0.70`.
- `prerequisites.ts` `upstreamPrerequisites()`: **BFS shortest-path `depth` is already computed and preserved** for every ancestor. This already satisfies spec §4.1/§35.2/§47 *better than the spec's own reference implementation* (which hard-codes `distance = isDirect ? 1 : 2`). This is an asset to build on, not replace.
- `course.ts` `dueQueue()`: section-spreading interleave — a partial `Dom(n)` anti-monopolisation using `section_id`.
- `action-value.ts`: feasibility + downstream reach — precursors to `u_feas` and `u_found`.
- `adaptive.ts` (untracked WIP): `selectAdaptiveTest()` — an evidence-tier heuristic test selector. **Not** IRT/2PL/Fisher/Urnings; it selects by capability gaps, not ability θ.

## Part B — Discrepancy report (spec ⇄ current impl)

| # | Spec requirement | Current implementation | Severity |
|---|---|---|---|
| B1 | Hard-block only **direct** prereqs (`d=1`); transitive ancestry soft-attenuated `α(d)=γ^{d-1}` (§6–9, §52) | `prerequisiteInstability` hard-flags ancestors by **status** (`learning`/`not_started`→`unconsolidated_status`) with an ad-hoc `isBlocking`, not distance-attenuated | **High** — this is the deadlock class the spec targets |
| B2 | Continuous MAUT `U=Σ w·u` replaces static bands + action hierarchy (§13, §51) | Static `PRIORITY_RANK` bands + fixed `ACTION_RANK` cascade | **High** |
| B3 | Real shortest-path distance everywhere attenuation is used (§35.2, §47) | Available upstream (`depth`), **but** `downstreamDependents` returns `Topic[]` with **no distance**; `action-value` counts reach without distance | Medium |
| B4 | Dynamic MAUT weights by context: exam<7d, hiatus>14d, session<15min (§19–22) | None (no session-time or hiatus signal in the ranker) | Medium |
| B5 | Priority aging `U_aged=U+α_age(1−e^{−φΔt_queue})` (§24) | None; no `queueEntryTimestamps` | Medium |
| B6 | Domain interleaving `U·β^f` over last K (§25) | Section-spread reorder in `dueQueue` only; no multiplicative suppression, no `domainId` | Medium |
| B7 | Memory urgency `u_mem` vs `R_target=0.90`, with decay-velocity term (§15) | Binary `isDue` vs `0.70`; no velocity term | Medium |
| B8 | Explanation trace with sub-utilities/weights/aging/interleave (§33, §49) | `DecisionTrace` exists but carries stage + budget only | Low |
| B9 | Cold-start CAT/IRT/Fisher/Urnings, 4-tier fallback (§27–32) | Heuristic `selectAdaptiveTest`; no θ/IRT | **High (scope)** |
| B10 | BKT mastery `L_t` with slip/guess, partial-credit policy (§10) | No mastery probability; `strength`/`health`/`R`/`status`/capability instead | **High (scope)** |
| B11 | Validation harness: 1000 synthetic learners, Gini, starvation rate, throughput (§40–46) | None | **High (scope)** |
| B12 | Reference-impl uses `τ_crit`=0.50 but prose says 0.70 (§35.1); distance flag (§35.2) | N/A (reference only) — must pick the production value | Decision |

## Part C — Data-model gap analysis (honest feasibility)

The spec's `KnowledgeNode` (§33) assumes fields the `Topic` model (`types.ts:200–227`) does **not** have. For each, the options are: **derive** from existing signals, **ingest** as new authored data, or **descope**.

| Spec field | In model? | Bridge |
|---|---|---|
| `masteryProbability` `L∈[0,1]` | No | **Decision D1** — derive from `health/100`, `predictRetention`, or a composite; OR adopt BKT (needs per-item responses we don't have) |
| `retrievability`, `memoryStability` | Yes (derived `R`, `effectiveStrength`) | Reuse directly |
| `directPrerequisites` | Yes (`prerequisites?`) | Reuse; distinguish direct (`d=1`) from transitive via existing BFS |
| `transitiveAncestors` + real distance | Partial (`upstreamPrerequisites` depth) | Reuse upstream; **add distance to downstream** (B3) |
| `downstreamReach` | Yes (`downstreamDependents`) | Add distance |
| `misconceptionProfile: number[]` | **No** (but signatures exist) | **D2 resolved** — reuse `calculateSignatureSimilarity` (Jaccard token/bigram, `errors.ts:135`) as `S_err`; no embedding pipeline |
| `syllabusWeight` | **No** | **Decision D3** — default `1`, or ingest from course JSON (prompt change) |
| `nextExamTimestamp` (per node) | Indirect (`store.exams`, `assessment_refs` link topics + dates) | Derive per topic from linked exams |
| `estimatedDurationMinutes` (per node) | No (only per-**action** `EST_MINUTES`) | Reuse action estimate, or **Decision D4** ingest per-topic |
| `cognitiveLoad`, `fatigueAdjustedCapacity` | **No** | **Decision D5** — descope `u_feas` load term, or model fatigue from session timer |
| `domainId` | **No** (course/section only) | **Decision D6** — map domain→`course_id` or `section_id` |
| `sessionTimeRemainingMinutes` | Partial (`useStudyTimer`, `SessionRecord.duration`) | Wire from the live timer at call time |
| IRT `difficulty β_q`, `discrimination γ_q`, per-question responses | **No** | **D7 resolved** — no item bank. Cold-start ability = existing `TopicCapabilityProfile` + `test_pass`/`test_fail` rates; full IRT/CAT deferred |

**Honest assessment (metric honesty):** Phases 1–4 (gating + MAUT + aging + interleaving + dynamic weights + trace) are feasible against current or lightly-extended data and directly address the reported failure mode. The cold-start **IRT/CAT/Urnings** stack (B9/D7) and **BKT** (B10/D1-alt) require a per-item response model this product does not have and arguably should not build for a local-first GCSE tracker; the **1000-learner validation harness** (B11) is a substantial standalone testing project. I recommend treating those three as separate, explicitly-scoped efforts — not folded silently into this change.

## Part D — Decisions required before implementing (the gate)

Per spec §1/§35/§54 and your own preference that semantic calls are yours, these must be resolved. My recommendation is first; the spec reference is cited.

- **D1 — Mastery `L(v_i)` source (§10, §16, §35.1).** *Rec:* derive `L = health(topic)/100` (already a validated 0–100 composite), **not** BKT. Adopting BKT means a per-question response model we don't collect.
- **D2 — Misconception similarity `S_err` (§8.3, §11, §54.4). RESOLVED per user adjustment #1.** Do **not** introduce vector embeddings/cosine. Reuse the existing deterministic **`calculateSignatureSimilarity(a, b)`** in `src/engine/errors.ts:135` (normalized token + bigram Jaccard) as `S_err`, comparing the target's recent-error signatures against the ancestor's known error-pattern signatures. Already unit-tested, subject-agnostic, no new deps.
- **D3 — `τ_crit` (§6, §35.1): 0.70 (prose) vs 0.50 (reference).** *Rec:* **0.70**, matching the existing `DUE_THRESHOLD` and the prose; flag that this is stricter than the reference code.
- **D4 — Direct-gate semantics.** Hard block a candidate when a **direct** prereq has `L < τ_crit`? *Rec:* yes, but only block the *directly*-dependent target, never transitive descendants (spec §6, §53).
- **D5 — `u_feas` load term (§18, §54.7): descope cognitive load, and exclude vs. down-weight oversized tasks?** *Rec:* down-weight (keep Gaussian), drop the load term until fatigue is modelled.
- **D6 — `domainId` (§25): `course_id` or `section_id`?** *Rec:* `section_id` (finer-grained interleave; matches current `dueQueue` behaviour). Reconsider if courses are the real "subjects."
- **D7 — Cold-start IRT/CAT + BKT + 1000-learner harness (§27–46): in scope now? RESOLVED per user adjustment #4.** Do **not** build a calibrated 2PL item-parameter database. Keep cold-start ability estimation **lightweight**, driven by the existing **`TopicCapabilityProfile`** (`performance.ts` `topicCapability`) and `test_pass`/`test_fail` rates, feeding `mastery` (D1). A full IRT/CAT/Urnings stack remains a separately-scoped future effort, not a blocker.
- **D8 — Does MAUT *replace* the action-type cascade entirely, or arbitrate *within* it? RESOLVED per user adjustment #3.** Replace the priority-band/cascade **sort** with `U_final`, but (a) keep the six **guards** as candidate generators, and (b) **every MAUT candidate retains a dominant action type** derived from which utility drove its score, mapped to a `SessionIntent` (`session.ts` `intentConfig`) so `buildSessionPlan`/`startSessionPrompt` keep emitting accurate tutor objectives. Mapping rule: `u_mem` dominant → `review`/retention; `u_found` dominant **with active error patterns** → `prerequisite`/`remediate`; `u_vel` dominant on a `not_started` topic → `learn`/new_content; unresolved-error guard → `remediate`. See **Part H — Action-intent preservation**.
- **D9 — CRITICAL, ties to your reported bug.** The spec's MAUT does **not** encode authored curriculum order; `u_vel`/`u_found` won't order "Number before Algebra" in a prereq-less course (all tie). Choose the curriculum-order mechanism: **(a)** add a small curriculum-order term/tiebreak from `Section.order`+topic index; **(b)** backfill sequential prerequisites at ingestion (section N depends on N−1); **(c)** rely on authors writing prerequisites. *Rec:* **(a)** — cheapest, deterministic, fixes the symptom without mutating stored data, and composes with MAUT. This is the piece that actually resolves what you reported.

- **D10 — Soft-gating aggregation bound (§11, §54.4). RESOLVED per user adjustment #2.** The raw product `∏[1−(1−L)α(d)S_err]` over-penalises dense DAGs with many weakly-related ancestors. Bound it two ways: **(a)** include only the **top-3 ancestors by causal relevance `α(d)·S_err`** in the product; **(b)** apply a floor `G_soft = max(SOFT_GATE_FLOOR, product)` with `SOFT_GATE_FLOOR = 0.10`. Both become named constants (`RECO.SOFT_GATE_TOP_K = 3`, `RECO.SOFT_GATE_FLOOR = 0.10`). Consumed in **Phase 2**.

**Nothing in Phase 1 below depends on D2/D5/D7/D10. Phase 1 needs D1, D3, D8, D9 (all resolved, with the recommendations above).**

## Part E — Phased decomposition (each phase independently shippable)

| Phase | Deliverable | Feasible now? | Gated on |
|---|---|---|---|
| **1** | Graph-distance layer + bounded direct-only gating + curriculum-order-aware ordering (fixes the reported bug) | **Yes** | D1, D3, D8, D9 |
| **2** | Soft-gating factor `G_soft` (`S_err`=Jaccard, top-3 + 0.10 floor per D10); replace status-cascade blocking | Yes | D2, D4, D10 |
| **3** | MAUT scorer (`u_mem/u_found/u_vel/u_feas`) + dynamic weights + trace, replacing the band/cascade sort | Yes | D5, D6, D8 |
| **4** | Priority aging + domain interleaving (`β^f`) + anti-starvation invariants | Yes | D6 |
| **5** | BKT / knowledge-tracing mastery (only if D1 chooses BKT) | Data-blocked | D1, new event granularity |
| **6** | Cold-start CAT/IRT/Fisher/Urnings + 1000-learner validation harness | Research-scale | D7, item-bank pipeline |

Phases 2–4 each get their own `docs/superpowers/plans/` file once D-decisions land. **This document specifies Phase 1 in full.**

---

## Phase 1 — Distance layer + bounded gating + curriculum-order ordering

Assumes **D1=health/100, D3=0.70, D8=guards-stay/ranking-changes-later, D9=(a) curriculum-order term**. Phase 1 is deliberately scoped to *stop the deadlock-class transitive locks in the learn/eligibility path* and *fix the ordering symptom*, without yet swapping the whole ranker (that's Phase 3).

### File Structure

- Create `src/engine/graph.ts` — pure graph utilities: `shortestPathDistance`, `downstreamWithDistance`, `curriculumIndex`. One responsibility: graph geometry over the topic DAG.
- Create `src/config/constants.ts` additions — `RECO` sub-table (`TAU_CRIT`, `GAMMA_DEPTH`).
- Modify `src/engine/planning.ts` — `curriculumPosition` eligibility uses **direct-only** hard blocking; ordering uses curriculum order.
- Modify `src/engine/prerequisites.ts` — expose a `mastery(topic)` helper (D1) and a `directPrerequisiteBlock` check; stop treating transitive status as a hard block in the eligibility path.
- Tests alongside each.

### Global interfaces introduced (Phase 1)

```typescript
// src/engine/graph.ts
export function shortestPathDistance(fromId: string, toId: string, store: Store): number | null;
export function downstreamWithDistance(topicId: string, store: Store): Array<{ topic: Topic; distance: number }>;
export function curriculumIndex(store: Store): Map<string, number>; // topic_id -> global authored order
```

---

### Task 1: `mastery()` helper (D1)

**Files:**
- Modify: `src/engine/prerequisites.ts`
- Test: `tests/engine/mastery.test.ts`

**Interfaces:**
- Produces: `export function mastery(topic: Topic, now?: Date): number` — `health/100` in `[0,1]` for **any** status.

**Refinement (user watch-item #2):** `health()` is "Computable for any topic" (`metrics.ts:72`); `shouldShowHealth` is only a *presentation* rule (`practising`/`mastered`). Gating on `shouldShowHealth` would falsely zero a `learning` topic that has a passed test, hard-blocking its dependent. So `mastery` reads `health(topic, now)/100` directly and grants credit for demonstrated accuracy regardless of status badge. (`health ∈ [0,100]` by construction — sub-scores are each `[0,100]` and weights sum to 1 — so the clamp is just a safety net.)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { mastery } from '@/engine/prerequisites';
import type { ReviewEvent, Topic } from '@/domain/types';

const NOW = new Date('2026-08-15T00:00:00Z');
function topic(o: Partial<Topic> = {}): Topic {
  return { topic_id: 't', title: 't', status: 'practising', conf: 4, strength: 3, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-14T00:00:00Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...o };
}
const pass: ReviewEvent = { event_id: 'e', date: '2026-08-14T00:00:00Z', kind: 'test_pass',
  source: 'exam', source_id: 'x', confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 } };

describe('mastery (L = health/100, any status)', () => {
  it('is within [0,1]', () => {
    const m = mastery(topic(), NOW);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(1);
  });
  it('grants credit to a LEARNING topic with a passed test (not falsely 0)', () => {
    const learned = topic({ status: 'learning', review_history: [pass] });
    expect(mastery(learned, NOW)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/engine/mastery.test.ts` → FAIL ("mastery is not exported").

- [ ] **Step 3: Implement**

```typescript
// prerequisites.ts — health is already imported for prerequisiteInstability
export function mastery(topic: Topic, now: Date = new Date()): number {
  return Math.min(1, Math.max(0, health(topic, now) / 100));
}
```

- [ ] **Step 4: Run to verify it passes** — same command → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(engine): derive mastery L from health (D1)"`

---

### Task 2: `shortestPathDistance` on the prerequisite DAG

**Files:**
- Create: `src/engine/graph.ts`
- Test: `tests/engine/graph-distance.test.ts`

**Interfaces:**
- Produces: `shortestPathDistance(fromId, toId, store): number | null` — directed BFS along `prerequisites` edges (ancestor→descendant), `null` if unreachable, `0` if `fromId===toId`.

- [ ] **Step 1: Write the failing test** (covers spec §48 graph tests: direct, depth-2/3/4, unreachable)

```typescript
import { describe, it, expect } from 'vitest';
import { shortestPathDistance } from '@/engine/graph';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function t(id: string, prerequisites: string[] = []): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites };
}
// chain A -> B -> C -> D -> E (A prerequisite of B, ...)
function chain(): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics: [
      t('A'), t('B', ['A']), t('C', ['B']), t('D', ['C']), t('E', ['D']) ]}] };
  return { ...emptyStore(), courses: [c] };
}

describe('shortestPathDistance (ancestor -> descendant)', () => {
  const s = chain();
  it('direct prerequisite is distance 1', () => expect(shortestPathDistance('A', 'B', s)).toBe(1));
  it('depth-2 ancestor', () => expect(shortestPathDistance('A', 'C', s)).toBe(2));
  it('depth-4 ancestor', () => expect(shortestPathDistance('A', 'E', s)).toBe(4));
  it('same node is 0', () => expect(shortestPathDistance('A', 'A', s)).toBe(0));
  it('unreachable is null', () => expect(shortestPathDistance('E', 'A', s)).toBeNull());
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (module missing).

- [ ] **Step 3: Implement**

```typescript
// src/engine/graph.ts
import { allTopics, type Store, type Topic } from '@/domain/types';

/** Directed BFS along prerequisite edges: edge (p -> t) exists when p ∈ t.prerequisites.
 *  Distance from an ANCESTOR `fromId` down to descendant `toId`. */
export function shortestPathDistance(fromId: string, toId: string, store: Store): number | null {
  if (fromId === toId) return 0;
  // children map: ancestorId -> [descendantIds] (reverse of the stored prerequisite edges)
  const children = new Map<string, string[]>();
  for (const { topic } of allTopics(store)) {
    for (const pid of topic.prerequisites ?? []) {
      (children.get(pid) ?? children.set(pid, []).get(pid)!).push(topic.topic_id);
    }
  }
  const seen = new Set<string>([fromId]);
  let frontier = [fromId];
  let dist = 0;
  while (frontier.length > 0) {
    dist++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of children.get(id) ?? []) {
        if (child === toId) return dist;
        if (!seen.has(child)) { seen.add(child); next.push(child); }
      }
    }
    frontier = next;
  }
  return null;
}
```

- [ ] **Step 4: Run to verify it passes** — PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(engine): real shortest-path distance on prereq DAG (B3, §35.2)"`

---

### Task 3: `downstreamWithDistance` (distance-tagged reach)

**Files:**
- Modify: `src/engine/graph.ts`
- Test: `tests/engine/graph-distance.test.ts` (add cases)

**Interfaces:**
- Produces: `downstreamWithDistance(topicId, store): Array<{ topic: Topic; distance: number }>` — each descendant once at its shortest distance.

- [ ] **Step 1: Write the failing test**

```typescript
import { downstreamWithDistance } from '@/engine/graph';
// using chain() from Task 2's file
it('reports each descendant at its shortest distance', () => {
  const out = downstreamWithDistance('A', chain());
  const byId = new Map(out.map(x => [x.topic.topic_id, x.distance]));
  expect(byId.get('B')).toBe(1);
  expect(byId.get('C')).toBe(2);
  expect(byId.get('E')).toBe(4);
  expect(byId.has('A')).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

```typescript
// graph.ts — append
export function downstreamWithDistance(topicId: string, store: Store): Array<{ topic: Topic; distance: number }> {
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const children = new Map<string, string[]>();
  for (const { topic } of allTopics(store)) {
    for (const pid of topic.prerequisites ?? []) {
      (children.get(pid) ?? children.set(pid, []).get(pid)!).push(topic.topic_id);
    }
  }
  const seen = new Set<string>([topicId]);
  const out: Array<{ topic: Topic; distance: number }> = [];
  let frontier = [topicId];
  let dist = 0;
  while (frontier.length > 0) {
    dist++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of children.get(id) ?? []) {
        if (!seen.has(child)) {
          seen.add(child); next.push(child);
          const t = byId.get(child); if (t) out.push({ topic: t, distance: dist });
        }
      }
    }
    frontier = next;
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** — PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(engine): distance-tagged downstream reach"`

---

### Task 4: `curriculumIndex` (authored order, D9a)

**Files:**
- Modify: `src/engine/graph.ts`
- Test: `tests/engine/curriculum-index.test.ts`

**Interfaces:**
- Produces: `curriculumIndex(store): Map<string, number>` — **within-course** ordering key: `section.order` major, topic array position minor, as an ascending integer that **resets per course**.

**Refinement (user watch-item #1):** a single global `counter++` across `store.courses` gives Course 1 indices `0..N` and Course 2 `N+1..M`, so Course 1 systematically wins every cross-course tiebreak. Resetting the counter per course makes the key **course-relative** (each course starts at 0), removing the bias. Formal *balanced* cross-course interleaving (round-robin when keys tie across courses) is deferred to Phase 4's domain-interleaving, which is the spec's designated mechanism for that; this keeps the key composable with it.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { curriculumIndex } from '@/engine/graph';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function t(id: string): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
}
function course(id: string, topicIds: [string, string]): Course {
  return { schema_version: '4.0.0', course_id: id, title: id,
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated', sections: [
      { section_id: `${id}_number`, title: 'Number', order: 0, topics: [t(topicIds[0])] },
      { section_id: `${id}_algebra`, title: 'Algebra', order: 1, topics: [t(topicIds[1])] } ] };
}

describe('curriculumIndex', () => {
  it('orders by section.order then topic position within a course', () => {
    const s: Store = { ...emptyStore(), courses: [course('c1', ['n1', 'a1'])] };
    const idx = curriculumIndex(s);
    expect(idx.get('n1')!).toBeLessThan(idx.get('a1')!);
  });
  it('is course-relative: the first topic of each course shares the same index (no Course-1 bias)', () => {
    const s: Store = { ...emptyStore(), courses: [course('c1', ['n1', 'a1']), course('c2', ['n2', 'a2'])] };
    const idx = curriculumIndex(s);
    expect(idx.get('n1')).toBe(idx.get('n2')); // both are their course's first topic
    expect(idx.get('a1')).toBe(idx.get('a2'));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (not exported).

- [ ] **Step 3: Implement**

```typescript
// graph.ts — append
export function curriculumIndex(store: Store): Map<string, number> {
  const idx = new Map<string, number>();
  for (const course of store.courses) {
    let within = 0; // reset per course → course-relative key (watch-item #1)
    const sections = [...course.sections].sort((a, b) => a.order - b.order);
    for (const section of sections) {
      for (const topic of section.topics) idx.set(topic.topic_id, within++);
    }
  }
  return idx;
}
```

- [ ] **Step 4: Run to verify it passes** — PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(engine): curriculum ordering index from section.order (D9a)"`

---

### Task 5: Bounded direct-only eligibility + curriculum ordering in `curriculumPosition`

**Files:**
- Modify: `src/engine/planning.ts:75-137` (`curriculumPosition`)
- Test: `tests/engine/curriculum-order-fix.test.ts` (this is the reproduction from the debugging session, now a permanent regression test — spec §48 "Regression Tests")

**Interfaces:**
- Consumes: `curriculumIndex` (Task 4), `mastery` (Task 1), `shortestPathDistance` (Task 2).
- Changes eligibility so **only a direct (`d=1`) prerequisite with `mastery < TAU_CRIT`** hard-blocks; transitive ancestry no longer blocks eligibility. Orders eligible topics by **curriculum index** (not alphabetical).

- [ ] **Step 1: Add constants**

```typescript
// constants.ts — inside CONFIG
RECO: {
  /** Direct-prerequisite hard-gate threshold (spec §6; D3 = prose value, stricter than reference 0.50). */
  TAU_CRIT: 0.70,
  /** Transitive attenuation base γ (spec §7). Consumed in Phase 2. */
  GAMMA_DEPTH: 0.50,
  /** Soft-gating aggregation bound (D10 / §54.4). Consumed in Phase 2. */
  SOFT_GATE_TOP_K: 3,     // only the top-K ancestors by α(d)·S_err enter the product
  SOFT_GATE_FLOOR: 0.10,  // G_soft = max(FLOOR, product)
},
```

- [ ] **Step 2: Write the failing regression test**

```typescript
import { describe, it, expect } from 'vitest';
import { curriculumPosition } from '@/engine/planning';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function t(id: string, title: string, prerequisites: string[] = []): Topic {
  return { topic_id: id, title, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites };
}
function gcse(prereqs: boolean): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'GCSE Maths',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated', sections: [
      { section_id: 'number', title: 'Number', order: 0, topics: [
        t('integers', 'Integers'), t('fractions', 'Fractions') ] },
      { section_id: 'algebra', title: 'Algebra', order: 1, topics: [
        t('algebra_basics', 'Algebra Basics', prereqs ? ['integers'] : []) ] } ] };
  return { ...emptyStore(), courses: [c] };
}

describe('REGRESSION — learn-next respects curriculum order (was: alphabetical)', () => {
  it('with no prerequisites, Number precedes Algebra (not alphabetical)', () => {
    const order = curriculumPosition(gcse(false)).suggestedOrder;
    expect(order.indexOf('integers')).toBeLessThan(order.indexOf('algebra_basics'));
  });
  it('a direct unmastered prerequisite still blocks its dependent', () => {
    const pos = curriculumPosition(gcse(true));
    expect(pos.suggestedOrder).not.toContain('algebra_basics'); // integers not mastered → blocked
    expect(pos.blockedTopics.map(b => b.topicId)).toContain('algebra_basics');
  });
});
```

- [ ] **Step 3: Run to verify it fails** — FAIL (current sort is alphabetical → `algebra_basics` first).

- [ ] **Step 4: Implement** — replace the hard-blocker detection and the sort in `curriculumPosition`:

```typescript
// planning.ts — imports
import { curriculumIndex, shortestPathDistance } from './graph';
import { mastery } from './prerequisites';
import { CONFIG } from '@/config/constants';

// inside curriculumPosition, replace the hardBlockers computation:
const cIndex = curriculumIndex(store);
// ... for each unstarted topic:
const directBlockers = (topic.prerequisites ?? [])
  .map((pid) => allTopics(store).find(({ topic: p }) => p.topic_id === pid)?.topic)
  .filter((p): p is Topic => !!p)
  // direct (d=1) and below competency → hard block (spec §6, D4)
  .filter((p) => (shortestPathDistance(p.topic_id, topic.topic_id, store) === 1) && mastery(p, now) < CONFIG.RECO.TAU_CRIT);

if (directBlockers.length === 0) {
  // eligible — record downstreamValue/depth as before
} else {
  blockedTopics.push({ topicId: topic.topic_id, title: topic.title,
    blockingPrerequisites: directBlockers.map((p) => p.topic_id),
    blockingGaps: ['unconsolidated_status'] });
}

// replace the eligible sort tail (was alphabetical) with curriculum order:
const sortedEligible = [...eligibleTopics].sort((a, b) => {
  if (b.downstreamValue !== a.downstreamValue) return b.downstreamValue - a.downstreamValue;
  if (a.depth !== b.depth) return a.depth - b.depth;
  return (cIndex.get(a.topicId) ?? 0) - (cIndex.get(b.topicId) ?? 0); // D9a
});
```

- [ ] **Step 5: Run to verify it passes** — PASS. Then run the full engine suite: `npx vitest run tests/engine` → confirm no regressions (expect prior curriculum/recommend tests still green; update any that asserted alphabetical order, documenting the change).

- [ ] **Step 6: Commit** — `git commit -am "fix(engine): bounded direct-only gating + curriculum-order learn ranking (§6, D9a)"`

---

### Task 6: Final `recommend()` learn-band tiebreak uses curriculum order

**Files:**
- Modify: `src/engine/recommend.ts:302-322` (final sort)
- Test: `tests/engine/recommend-learn-order.test.ts`

**Interfaces:**
- Consumes: `curriculumIndex`.
- Replaces the final **alphabetical** tiebreak (`localeCompare`) with curriculum order, so two same-band candidates order by syllabus, not title.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { recommend } from '@/engine/recommend';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

function t(id: string, title: string): Topic {
  return { topic_id: id, title, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
}
function store(): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'GCSE Maths',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated', sections: [
      { section_id: 'number', title: 'Number', order: 0, topics: [t('n1', 'Integers')] },
      { section_id: 'algebra', title: 'Algebra', order: 1, topics: [t('a1', 'Algebra Basics')] } ] };
  return { ...emptyStore(), courses: [c] };
}

describe('recommend — learn band ordered by syllabus, not title', () => {
  it('recommends the Number topic before the (alphabetically-earlier) Algebra topic', () => {
    const learn = recommend(store()).filter(r => r.action === 'learn').map(r => r.target.id);
    expect(learn.indexOf('n1')).toBeLessThan(learn.indexOf('a1'));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (alphabetical → `a1` first).

- [ ] **Step 3: Implement** — in `recommend.ts`, build `const cIndex = curriculumIndex(store);` once, and replace the final `return a.target.title.localeCompare(b.target.title);` with:

```typescript
const ai = cIndex.get(a.target.id); const bi = cIndex.get(b.target.id);
if (ai !== undefined && bi !== undefined && ai !== bi) return ai - bi;
return a.target.title.localeCompare(b.target.title); // stable fallback for non-topic targets
```

- [ ] **Step 4: Run to verify it passes** — PASS; then `npx vitest run` (full suite).

- [ ] **Step 5: Commit** — `git commit -am "fix(engine): syllabus-order tiebreak in recommend ranking (D9a)"`

---

### Phase 1 exit criteria

- The reported symptom is gone: prereq-less GCSE Maths recommends **Number** before **Algebra** (Tasks 5–6 regression tests).
- Transitive ancestry no longer hard-locks eligibility; only direct `d=1` prereqs below `τ_crit` block (Task 5).
- Real shortest-path distance is available for Phase 2/3 (`graph.ts`).
- Full suite green; `tsc -b --noEmit` clean; `npm run build` clean.

---

## Part F — Test & validation strategy (all phases)

- **Unit/regression (Phases 1–4):** the spec's §48 checklists map onto Vitest specs — graph distance (Task 2–3), gating (Phase 2), MAUT weights/normalization/determinism (Phase 3), aging cap + domain recovery (Phase 4). Every deadlock we fix gets a permanent regression test (spec §48 "Regression Tests"; Task 5 is the first).
- **Invariants (spec §47):** encode as property tests — weights sum to 1, utilities in `[0,1]`, `G_soft ∈ (0,1]`, aging bounded, interleave never permanently excludes a domain.
- **Validation harness (spec §40–46, Phase 6):** honestly a **separate project**. The Gini/starvation/throughput/`E_diag` metrics require the 1000-synthetic-learner simulator and (for `E_diag`) the IRT stack. Recommend a dedicated spec; do not gate Phases 1–4 on it.

## Part G — Risks & recommendations (metric honesty)

- **R1 — Spec ≠ your goal (D9).** MAUT alone does not fix "Number before Algebra." Phase 1's curriculum-order term is the real fix; the rest of the spec improves *arbitration quality*, not this specific symptom. Flagged per §1/§55.
- **R2 — Data the product doesn't have.** BKT (D1-alt), misconception vectors (D2), IRT item bank (D7) require response granularity and authored parameters the paste-JSON pipeline never collects. Building them is a large effort of debatable value for a local-first single-user tracker. I recommend deriving `L` from `health` and descoping IRT/BKT unless you want to change the ingestion contract.
- **R3 — Moving baseline.** The working tree carries large uncommitted learning-system WIP (e.g. `adaptive.ts`, a 182-line-changed `recommend.ts`). Each phase must re-run the full suite; Phase boundaries = commits so review stays tractable.
- **R4 — Over-fitting to the reference class.** The reference `RecommendationEngine` (§34) has known bugs the spec itself flags (§35). We implement from the *mathematical* spec + these decisions, not from the reference code.

## Part H — Action-intent preservation (user adjustment #3)

MAUT changes *ranking*, but the downstream tutor pipeline (`session.ts` `intentConfig`/`startSessionPrompt`, `plan.ts` `buildSessionPlan`) is driven by a discrete **`SessionIntent`** and pedagogical objective, not a raw score. Continuous arbitration must therefore **carry**, not erase, a dominant action type.

**Design rule (Phase 3):** every scored candidate records `dominantUtility` (the `argmax` of its weighted sub-utilities) and a derived `action`/`SessionIntent`, resolved deterministically:

| Dominant signal | `action` | `SessionIntent` |
|---|---|---|
| unresolved error pattern on target (guard) | `remediate` | `remediate` |
| `u_found` dominant **and** target has active error patterns | `prerequisite` | `remediate` |
| `u_found` dominant, no active errors | `prerequisite` | `adaptive` |
| `u_mem` dominant | `review` | `retention` |
| `u_vel` dominant on `not_started` | `learn` | `new_content` |
| `u_vel` dominant on started, unverified | `retrieve` | `adaptive` |

**Invariant to test:** for every recommendation surfaced to the UI, `intentConfig[rec.intent]` resolves and `startSessionPrompt` produces a non-empty objective (regression against silent intent loss). This keeps the MAUT score as the *ordering* signal while the *action semantics* remain explicit and explainable (spec §49 traces already expose sub-utilities, so `dominantUtility` is free to compute).

---

## Execution handoff

Phase 1 is fully specified above and depends only on decisions **D1, D3, D8, D9** (all with recommendations). Phases 2–6 are gated on the remaining decisions and will each get their own plan document once resolved.
