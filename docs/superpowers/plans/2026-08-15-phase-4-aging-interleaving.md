# Phase 4 — Priority Aging + Domain Interleaving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: test-driven-development. RED → GREEN → commit per task.

**Goal:** Add anti-starvation **priority aging** and **domain interleaving** on top of the Phase 3 MAUT score so eligible-but-never-picked items eventually rise and no single domain (section) monopolises the queue (workflow §24–26, §36–37, §52 Principle 3).

**Architecture:** Extend the ranking pipeline (§23) to `U → U_aged → U_final`. Two new pure functions in `src/engine/maut.ts`: `agingBoost` and `domainInterleaving`. `recommend()` composes them after `compositeUtility`, ranks by `U_final`, and records the aging + interleaving contributions in each rec's `maut` breakdown (§49). `domainId = section_id` (decision D6). Derive-don't-store: aging residence and domain history are derived from `store.sessions` + event history, never a stored queue.

**Tech stack:** TypeScript, Vitest. No new deps. Baseline: `fix/engine-workflow-remediation` after Phase 3 (`8f0e88f`).

## Global Constraints

- Derive-don't-store (§3): no stored queue/aging state. `Δt_queue` and domain history derive from `store.sessions` / event timestamps.
- Aging is **bounded** (§36, §54.8): max boost = `AGING_MAX_FRACTION · max(U)`; it mitigates starvation, it does **not** guarantee eventual selection.
- Interleaving is **bounded** (§37, §54.9): a domain is never permanently excluded; suppression saturates.
- All existing MAUT invariants hold; ranking stays deterministic for identical input.

## Pipeline (workflow §23)

```
compositeUtility  →  U
                     U_aged  = U + AGING_MAX_FRACTION·maxU·(1 − e^(−φ·Δt_queue))
                     U_final = U_aged · β^min(f, K)
rank by U_final (desc), tiebreak: curriculum order → ACTION_ORDER → title
```

- `Δt_queue(n)` — **days since the topic was last acted upon** (last `review_history` event date; for a never-touched topic, since the course `created_at`). A derive-don't-store proxy for queue residence: something eligible and untouched for long ages up.
- `maxU` — the maximum base `U` across the current candidate set (so aging can lift a starved item toward, but not past, the strongest).
- `f` — count of the last `K` studied topics (`store.sessions`, newest first) whose section == candidate's section (`domainId = section_id`). Capped at `K` so suppression saturates at `β^K` (never 0 → domain never permanently excluded).

## Constants to add (`CONFIG.RECO`)

```typescript
AGING_MAX_FRACTION: 0.25,   // α_age = 0.25·max(U) (§24)
AGING_ACCELERATION: 0.1,    // φ per DAY: Δt_queue≈14d → ~75% of max boost (tunable)
INTERLEAVE_BETA: 0.65,      // β (§25)
INTERLEAVE_WINDOW_K: 5,     // K (§25); reuse RECENT_HISTORY_SIZE semantics
```

## Decision required (flag per §1/§54)

- **P4-D1 — Interleaving vs. urgency (§37, §54.9).** Repeated `β^f` can suppress a domain heavily (`0.65^5 ≈ 0.12`), which could bury a genuinely urgent memory review in a recently-over-represented domain. Two mechanisms bound this; pick the policy:
  - **(a) Saturating cap only (recommended default):** cap `f` at `K` so suppression floors at `β^K` and a domain is never excluded; rely on aging + the item's own high `U` to resurface it. Simplest; matches §25 literally.
  - **(b) Cap + urgent exemption:** additionally exempt candidates whose `u_mem` exceeds a critical threshold (e.g. `R < CRITICAL_RETENTION`) from interleaving suppression, so urgent forgetting always surfaces (honours §37 "urgent review must override").
  - *Rec:* **(b)** — it directly satisfies the §37 invariant "urgent review must still override excessive interleaving suppression"; (a) alone leaves it to emergent behaviour. Cheap to add (`INTERLEAVE_EXEMPT_RETENTION` constant).

---

### Task 1: `agingBoost` (§24)

**Files:** Modify `src/engine/maut.ts`; add constants; Test `tests/engine/aging.test.ts`.

**Interfaces:**
```typescript
export function queueResidenceDays(topic: Topic, store: Store, now?: Date): number;
export function agingBoost(residenceDays: number, maxUtility: number): number;
```
Consumes: `MS_PER_DAY` (retention.ts), `CONFIG.RECO`.

- [ ] **Step 1 — failing test:**
  - `queueResidenceDays` = days since last `review_history` event; falls back to days since course `created_at` for a never-reviewed topic; `≥ 0`.
  - `agingBoost(0, maxU) === 0`; monotonic increasing in residence; bounded by `AGING_MAX_FRACTION·maxU` (i.e. `agingBoost(1e9, maxU) ≤ 0.25·maxU`, and `→` it as residence `→ ∞`).
  - `agingBoost(r, 0) === 0` (no boost when there is no utility scale).

- [ ] **Step 2 — RED** (`npx vitest run tests/engine/aging.test.ts`).

- [ ] **Step 3 — implement:**

```typescript
export function queueResidenceDays(topic: Topic, store: Store, now: Date = new Date()): number {
  const last = topic.review_history.at(-1)?.date;
  let ref: number;
  if (last) ref = new Date(last).getTime();
  else {
    // never acted upon → since its course was created (derive-don't-store).
    const course = store.courses.find((c) => c.sections.some((s) => s.topics.some((t) => t.topic_id === topic.topic_id)));
    ref = course ? new Date(course.created_at).getTime() : now.getTime();
  }
  return Math.max(0, (now.getTime() - ref) / MS_PER_DAY);
}

export function agingBoost(residenceDays: number, maxUtility: number): number {
  const max = CONFIG.RECO.AGING_MAX_FRACTION * maxUtility;
  return max * (1 - Math.exp(-CONFIG.RECO.AGING_ACCELERATION * residenceDays));
}
```

- [ ] **Step 4 — GREEN**, then `npx vitest run tests/engine`.
- [ ] **Step 5 — commit** `feat(engine): bounded priority aging (workflow §24)`

---

### Task 2: `domainInterleaving` (§25)

**Files:** Modify `src/engine/maut.ts`; Test `tests/engine/interleaving.test.ts`.

**Interfaces:**
```typescript
// section_id per topic (domainId = section_id, D6)
export function sectionOf(topicId: string, store: Store): string | undefined;
// count of the last K studied topics in `sectionId`
export function domainRecencyCount(sectionId: string, store: Store): number;
export function interleavingMultiplier(count: number): number;  // β^min(count, K)
```

- [ ] **Step 1 — failing test:**
  - `interleavingMultiplier(0) === 1`; `interleavingMultiplier(1) === 0.65`; `interleavingMultiplier(3) === 0.65^3`.
  - Saturates: `interleavingMultiplier(99) === 0.65^K` (never 0 → domain never permanently excluded, §37).
  - `domainRecencyCount` counts only the last `K` sessions and only the candidate's section.

- [ ] **Step 2 — RED.**

- [ ] **Step 3 — implement:**

```typescript
export function sectionOf(topicId: string, store: Store): string | undefined {
  for (const c of store.courses) for (const s of c.sections)
    if (s.topics.some((t) => t.topic_id === topicId)) return s.section_id;
  return undefined;
}

export function domainRecencyCount(sectionId: string, store: Store): number {
  const recent = [...store.sessions]
    .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    .slice(0, CONFIG.RECO.INTERLEAVE_WINDOW_K);
  return recent.filter((s) => sectionOf(s.topic_id, store) === sectionId).length;
}

export function interleavingMultiplier(count: number): number {
  const capped = Math.min(count, CONFIG.RECO.INTERLEAVE_WINDOW_K);
  return Math.pow(CONFIG.RECO.INTERLEAVE_BETA, capped);
}
```

- [ ] **Step 4 — GREEN.**
- [ ] **Step 5 — commit** `feat(engine): bounded domain interleaving (workflow §25, D6)`

---

### Task 3: integrate `U_final` into `recommend()` + invariants

**Files:** Modify `src/engine/maut.ts` (extend `UtilityBreakdown` with `agingBoost`, `interleavingMultiplier`, `finalUtility`), `src/engine/recommend.ts` (rank by `finalUtility`); Test `tests/engine/aging-interleaving-ranking.test.ts`.

**Behaviour:** after computing base `U` for all candidates, compute `maxU`, then per candidate `U_aged = U + agingBoost(residence, maxU)`, `U_final = U_aged · interleavingMultiplier(domainCount)` (with P4-D1 exemption if chosen). Rank by `U_final`. Record all three in `maut`.

- [ ] **Step 1 — failing tests (invariants §36–37):**
  - **Aging is bounded (§36):** a low-utility, long-starved candidate's total boost never exceeds `AGING_MAX_FRACTION·maxU`; a high `u_mem` urgent review still outranks a maximally-aged low-utility item.
  - **Domain recovery (§37):** with one domain dominating the last K sessions, a fresh candidate from *another* domain outranks a same-utility candidate from the saturated domain; and the saturated domain is **not** absent from the list (multiplier > 0).
  - **Urgent override (§37, if P4-D1=b):** an urgent memory review (`R < CRITICAL`) in the saturated domain still ranks above non-urgent other-domain items.
  - **Determinism:** identical store → identical order.

- [ ] **Step 2 — RED.**
- [ ] **Step 3 — implement** the pipeline in `recommend()` (replace the sort key `maut.utility` with `maut.finalUtility`; keep the same tiebreaks).
- [ ] **Step 4 — GREEN**, then `npx vitest run` (full). Repair any spec that asserted pre-aging ordering, documenting the §24/§25 change.
- [ ] **Step 5 — `tsc` + `npm run build` clean; commit** `feat(engine): U_final = aged·interleaved ranking + anti-starvation invariants (§24-26, §36-37)`

---

## Self-review

- Spec coverage: §24 (Task 1), §25/§26 (Task 2), §23 pipeline + §36/§37 invariants (Task 3), §54.8/§54.9 boundedness (tests), D6 (`section_id`).
- Type consistency: `UtilityBreakdown` gains `agingBoost`/`interleavingMultiplier`/`finalUtility`, used identically in `recommend()`.
- Determinism + bounds tested.

## Not in scope

- BKT knowledge tracing / IRT-CAT cold-start / 1000-learner validation harness → **Phases 5–6** (data-blocked / research-scale; recommend separate specs).
