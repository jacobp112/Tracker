# Performance & Transfer Metrics — Design

**Date:** 2026-08-10
**Status:** Approved framework, phased implementation
**Scope:** Add a second analytic layer — *Performance Health* — measuring how effectively
a learner can **use** knowledge (independent application, transfer, performance at
rising difficulty/novelty, cold assessment), alongside the existing *Knowledge Health*
(retention/mastery) layer, which is left provably unchanged.

This document fixes the whole conceptual framework and the tutor→tracker contract so
the schema decisions are made with the dashboard in view. It is implemented as a
sequence of separately-planned phases (§H), each with its own plan → build → review.

---

## A. Governing principle — two parallel layers, never merged

The existing model already answers one question well. We add a second, orthogonal one.

| Layer | Question | Source |
|---|---|---|
| **Knowledge Health** (existing `health()`) | "How securely is this retained?" | `src/engine/metrics.ts`, unchanged |
| **Performance Health** (new) | "How effectively can the learner use what they know?" | `src/engine/performance.ts`, new |

**Hard invariant (load-bearing):** the Performance layer is **read-side only**. Nothing in
it may ever write to, or feed the computation of, any existing signal:

> `retention`, `k_factor`, `strength`, `conf`, `health`, `topicLevel` / high-water, EXP /
> retrievable, mastery %, velocity, badges, OCI, projections, streak, volume.

This is how requirement #15 / #24 (existing calculations provably unchanged) is satisfied
**by construction** rather than by hope: the new layer only *reads* `review_history`. §F.6
adds golden tests that pin the existing numbers before and after the whole change.

Both layers are surfaced (requirement #12); neither is collapsed into a single number.

### Anti-gaming, stated as a structural rule (requirement #18)

The signal we want is **"performance at increasing difficulty/novelty while maintaining
independence,"** never "harder questions = better learner," "more novel = better learner,"
or "more attempts = better learner." This is enforced in the math, not disclaimed in prose:

- Difficulty and novelty raise a metric **only when paired with independent success** — a
  hard problem the learner could not do independently does not lift any score.
- Attempt **volume** is never rewarded; every metric has a minimum-data guard, so a few
  informative, appropriately-challenging attempts outweigh many trivial ones.
- Below a metric's data threshold it returns `null` → the UI shows "—", never an inflated
  or zero-filled number (this reuses the app's existing honesty rule).

---

## B. Data model — one optional `assessment` block on `ReviewEvent`

The tutor's new dimensions live in a single nested optional block on the atomic fact,
mirroring the existing `test?: TestEvidence` precedent (`src/domain/types.ts`). Every
dimension is optional: partial applicability is a first-class requirement (#16) — a recall
card has difficulty but no meaningful transfer; a creative-writing task has quality but no
useful novelty; a guided teaching interaction has no independent result.

```ts
// src/domain/types.ts — new

/** 0 recall · 1 direct application · 2 multi-step familiar · 3 unfamiliar
 *  application · 4 non-routine reasoning · 5 exceptionally challenging. */
export type Difficulty = 0 | 1 | 2 | 3 | 4 | 5;

/** 0 identical · 1 minor variation · 2 different presentation · 3 genuinely
 *  unfamiliar · 4 highly novel (learner must determine the approach). */
export type Novelty = 0 | 1 | 2 | 3 | 4;

/** 0 solution required · 1 substantial hinting · 2 minor hint/prompt ·
 *  3 completely independent. */
export type Independence = 0 | 1 | 2 | 3;

/** 0 cannot transfer · 1 transfers with prompting · 2 transfers independently ·
 *  3 independently transfers AND generalises. Kept independent of `novelty`. */
export type TransferLevel = 0 | 1 | 2 | 3;

/** 0–5 subject-appropriate composite of the dimensions the tutor deems relevant
 *  (correctness, reasoning, efficiency, clarity, method, communication, …). Not
 *  every subject uses every dimension. */
export type PerformanceQuality = 0 | 1 | 2 | 3 | 4 | 5;

export interface AssessmentEvidence {
  difficulty?: Difficulty;
  novelty?: Novelty;
  independence?: Independence;
  transfer_level?: TransferLevel;
  performance_quality?: PerformanceQuality;
  /** Short tutor rationale for the quality judgement (requirement #5). */
  quality_rationale?: string;
  /** Tutor-marked cold assessment (§ requirement #7). NEVER auto-inferred from
   *  source — an exam is only cold if the tutor says so. */
  cold?: boolean;
  /** Tutor's PRE-attempt probability of success, 0–1 (requirement #11). Only
   *  counts toward calibration when `predicted_at` verifies it as foresight — see
   *  §D.calibrationError and the timing rule below. */
  predicted_success?: number;
  /** ISO timestamp of when `predicted_success` was formed. Load-bearing for
   *  honesty: a prediction emitted in the same pass as the outcome is hindsight.
   *  Calibration counts a prediction ONLY when this exists and is strictly before
   *  the attempt's `date`. Absent or not-preceding → excluded from calibration. */
  predicted_at?: string;
  /** Optional tutor/model/session tag (provenance, requirement #14). */
  assessed_by?: string;
}
```

`ReviewEvent` gains one field:

```ts
export interface ReviewEvent {
  // …existing fields unchanged…
  assessment?: AssessmentEvidence;
}
```

### Provenance (requirement #14) — by presence, not by a heavy structure

Every provenance question the brief asks is already answerable without a per-field origin
record:

- **which attempt / session / exam / timestamp** → the event's existing `event_id`,
  `source`, `source_id`, `date`.
- **tutor-assigned vs system-derived** → the *presence* of an `assessment` block means
  tutor-assigned. The tracker **never derives per-attempt dimension values onto events**;
  all derivation (§D) happens live at the aggregate level and is never written back. So no
  per-attempt value is ever system-derived, and an `origin` enum would be a constant — a
  smell we avoid. `assessed_by` optionally records *which* tutor/model, when supplied.
- **missing dimensions** stay `undefined` — never guessed, never zero-filled (#14, #15).

---

## C. Contract — purely additive, optional (schema, merge, back-compat)

Data enters exactly one way (`src/core/pipeline.ts`): the learner pastes tutor-produced
JSON. We extend that path additively; no new ingest type, no required field.

### Schema (`src/domain/schemas.ts`)

A shared `ASSESSMENT_EVIDENCE` schema object (`additionalProperties: false`, all properties
optional, ordinal bounds enforced, `predicted_success` in `[0,1]`, `predicted_at` a
`date-time`) is attached to:

- `SESSION_SCHEMA.topics_covered[].items.properties.assessment`
- `EXAM_SCHEMA.breakdown[].items.properties.assessment`
- `EXAM_SCHEMA.properties.cold` (top-level boolean — an exam paper the tutor marks cold),
  applied to every linked topic's event unless a per-breakdown `assessment.cold` overrides.

Because `additionalProperties: false` currently *rejects* unknown keys, adding these keys is
what *permits* the tutor to send them. Old JSON that omits them still validates unchanged —
the fields are optional. This is the backward-compatibility guarantee (#15), verified by a
test that the current fixture set still passes.

### Merge (`src/core/merge.ts`)

`mergeSession` and `mergeExam` copy the `assessment` block (if present) onto the
`ReviewEvent` they already construct — one added spread, no new decomposition. Exam-level
`cold` is folded into each event's `assessment.cold` when the per-topic block doesn't set it.
The block is passed through verbatim; the tracker adds nothing to it.

### Versioning

`SCHEMA_VERSION` 3.1.0 → **3.2.0**. **No data migration** — old events simply have no
`assessment` block. Derived metrics treat their dimensions as *unknown* and exclude them from
performance aggregates (§D). We do not migrate old events by inventing values (#15).

---

## D. Derived analytics — new `src/engine/performance.ts`

All metrics are computed live from `review_history`, transparent (documented weights, no
opaque formula), and **degrade gracefully**: composites re-normalise over the dimensions
actually *present* rather than treating a missing dimension as zero, and every metric has a
minimum-data guard returning `null` below threshold. All tunables live in a new
`CONFIG.PERFORMANCE` block (`src/config/constants.ts`) — no inline magic numbers, matching
the existing constant discipline.

Helper: `assessedEvents(topic)` → events whose `assessment` block carries at least one
scored dimension. `observedSuccess(event)` → the attempt's realised success in `[0,1]`,
taken from `test.actual_retention` when present, else `performance_quality / 5`, else
`undefined` (never fabricated).

### Independence tiers — strict

Independent Performance uses **`independence === 3` only**. A minor prompt (`=== 2`) is still
assistance; folding it into the headline would rebuild the exact assisted≈autonomous
conflation §10 exists to prevent. The `=== 2` band is surfaced **separately** as a
**"lightly assisted"** tier, and `0–1` as **"assisted."** The data is preserved; the
headline stays honest.

- **Independent Performance** (#10): among `independence === 3` attempts — accuracy, plus the
  *difficulty* and *novelty* of that independent work — reported **beside** assisted accuracy
  and the lightly-assisted tier, never merged. Distinguishes assisted success from autonomous
  mastery.
- **Transfer Ability** (#9): mean `transfer_level` (→ 0–100), recent trend, count of
  qualifying attempts, and a coverage/confidence indicator. Below `PERFORMANCE.MIN_TRANSFER_N`
  attempts → "not enough data," never a high score on one or two observations.
- **Cold Performance** (#8): a transparent weighted composite over the *present* dimensions of
  **cold attempts only** (correctness/score, difficulty, novelty, independence, transfer,
  quality). Missing dimensions drop out and the remaining weights re-normalise; never zeroed.
  Below `PERFORMANCE.MIN_COLD_N` → `null`.
- **Performance-by-difficulty / -by-novelty** (#13): success rate bucketed by difficulty and
  by novelty, **restricted to independent (`=== 3`) attempts** — this is the
  difficulty×independent-success and novelty×independent-success signal that shows real
  progress beyond routine practice.
- **calibrationError** (#11): mean `|predicted_success − observedSuccess|` (signed bias +
  magnitude), over attempts where **`predicted_at` exists and is strictly before the event's
  `date`**. Predictions without verifiable foresight are excluded (defaulting absence to
  exclusion is the honest failure mode). **Kept separate from OCI** — OCI continues to measure
  confidence-vs-performance; calibration measures tutor-prediction-vs-outcome.
- **Performance Health** (#12): the parallel 0–100 composite (below).

### Performance Health composite — weights

Proposed weights, implemented as named `CONFIG.PERFORMANCE.HEALTH_WEIGHTS` constants (tunable
without code change):

| Input | Weight |
|---|---|
| independent accuracy (`independence === 3`) | 0.30 |
| difficulty of independent success | 0.20 |
| novelty of independent success | 0.15 |
| transfer | 0.20 |
| performance quality | 0.15 |

Beyond-routine dimensions (difficulty + novelty + transfer = 0.55) outweigh raw accuracy
(0.30) overall — the correct direction for #18.

**Deliberate decision — the accuracy component is NOT gated on a difficulty floor.** A learner
who drills easy-but-independent work at high accuracy honestly banks the 0.30 accuracy weight
while difficulty/novelty/transfer sit at zero. That reads as *"solid but untested,"* which is a
true statement about them — not gaming. Performance Health as a whole still cannot approach the
top without the beyond-routine dimensions, so the incentive gradient points the right way. This
is a chosen behaviour, recorded here so it is not mistaken later for an artifact of the weights
summing to 1.

Missing-dimension handling: the composite re-normalises over inputs with data; if too few
inputs are present for a meaningful score it returns `null` (min-data guard), never a partial
number dressed as complete.

---

## E. Prerequisites & instability diagnostics (requirement #6)

`Topic` gains an optional `prerequisites?: string[]` (topic_ids), authored by the
course/tutor layer — no subject-specific relationships are hard-coded. Added to `TOPIC` schema
as an optional array of `topic_*` ids.

`prerequisiteInstability(topic, store)` (in `performance.ts`) inspects the health/retention of
a topic's declared prerequisites when that topic underperforms, so a repeatedly-failing Topic C
can point at unstable upstream A/B rather than assuming C is the root cause. This is **diagnostic
evidence only** — it **never** overwrites mastery or any stored state (#6). Cycles are guarded
defensively (visited-set); the graph is assumed a DAG but a cycle cannot hang or corrupt the
diagnostic.

---

## F. Phasing — each phase is its own plan → build → review

1. **Data model** — types (`AssessmentEvidence`, ordinals, `ReviewEvent.assessment`,
   `Topic.prerequisites`). No behaviour yet.
2. **Contract** — schema additions, merge pass-through, `predicted_at` timing acceptance,
   version bump. Back-compat test on existing fixtures.
3. **Analytics engine** — `performance.ts` + `CONFIG.PERFORMANCE`: Independent Performance
   (with tiers), Transfer Ability, Cold Performance, perf-by-difficulty/novelty,
   calibrationError, Performance Health.
4. **Prerequisites** — `Topic.prerequisites` wiring + `prerequisiteInstability` diagnostic.
5. **Dashboard** — a distinct **Performance** section (the retention dashboard stays the
   primary knowledge view). Headline cards: Cold Performance, Independent Performance, Transfer
   Ability, Performance Quality, Novel-Task Success. Diagnostic views: perf-by-difficulty,
   perf-by-novelty, assisted-vs-independent, transfer trend, cold trend, prerequisite
   instability. Trends at 7-day / 30-day / lifetime via the existing replay-by-date approach.
6. **Validation** — golden tests proving every existing metric is byte-for-byte unchanged;
   per-derivation unit tests; missing-field and historical-event tests; a generic-naming audit
   confirming no subject-specific assumption (esp. mathematics) leaked into the model.

---

## G. Success criterion (from the brief)

| | Learner A (95% acc, easy, familiar, heavily assisted) | Learner B (82% acc, hard, novel, independent, strong transfer) |
|---|---|---|
| Knowledge Health / raw accuracy | **high** (correctly) | lower |
| Independent Performance (`===3`) | low (assisted) | high |
| Cold / Transfer / perf-by-difficulty | low | high |
| **Performance Health** | **low** | **high** |

Both layers are surfaced side by side; A's higher raw accuracy is still reported truthfully,
while B's stronger underlying performance is now visible. The purpose is not to replace
mastery/retention — it is to add the missing dimension: *secure knowledge → independent
application → transfer → performance at rising difficulty/novelty.*

---

## H. Non-goals / explicit exclusions

- No network, no AI calls inside the app — provenance and assessment values arrive only via
  pasted tutor JSON (existing local-first invariant).
- No rewrite of retention/mastery math; no new coupling into it.
- No auto-inference of `cold`, `independence`, or any dimension from source or correctness.
- No reward for attempt volume or for difficulty/novelty absent independent success.
