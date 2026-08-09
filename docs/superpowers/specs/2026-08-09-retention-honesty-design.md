# Retention Honesty Rewrite — Design

**Date:** 2026-08-09
**Status:** Draft for review
**Amends:** Document 2 (Math & Algorithms Spec) §2, §3, §4; Document 1 schema (`ReviewEvent`)
**Scope owner:** the study engine (`src/engine`, `src/core/merge.ts`, `src/config/constants.ts`)

---

## 1. Purpose

Today a lapse makes a topic look **healthier**. `strength` is append-only and a failed test still adds `+0.15` (`strengthIncrement`, `recalculate.ts:16`), and retention is `R(t) = e^(−t/(k·s))`, so raising `s` *lengthens* the predicted interval. The only downward pressure is `kFactor` drift, which needs `DRIFT_MIN` (3) samples, moves `±K_STEP` (10%) per step, and clamps at `K_MIN` (4.2). A topic you repeatedly fail drifts its `k` down slowly while `s` climbs monotonically past it. Every mature SRS treats a lapse as a **stability reduction**; this spec makes that true here without breaking the append-only principle.

Two effects fall out of the fix: EXP stops saturating (`Σ min(1,R)` no longer pins mature topics near 1.0 forever), and the 80% pass/fail cliff on strength gain is removed.

### In scope

1. **Lapse penalty (#1):** decouple monotonic `strength` from an **effective stability** `s_eff` that lapses knock down, derived (never stored) by replaying `review_history`.
2. **Continuous test gain (#7):** test strength gains become continuous in `actual_retention`; study-review gains keep their confidence buckets (there is no score to be continuous in).
3. **#6 correction:** stop tuning `kFactor`/`drift` on uniform-fallback exams **and** recompute live `k_factor`/`drift_history` on deploy to purge existing contamination.
4. **Day-quantization nit:** retention uses fractional days, removing up-to-a-day error in `t`.
5. **Offline eval harness:** score predicted `R` against `actual_retention` (MAE + log-loss, prior-events-only) so the #1-vs-FSRS decision is empirical.

### Out of scope (own specs, sequenced after)

- **#2** calibration null + weight renormalisation — pure health/UI decision, never touches retention, cannot move the harness metric.
- **#4** persisted structured drift rewind — this spec already writes the forward-k function; #4 later becomes "persist what this computes." Costs nothing to defer.
- **#5** cards as a health input.
- **#3** confidence's triple role.
- streak / `manual_review` product call.
- **FSRS** as the retention model — gated on the harness result. Not adopted here; `kFactor` is the difficulty analogue and only tunes on exams, so an FSRS port would ship with personalisation disabled for anyone who doesn't log exams. Fix the "only exams tune k" honesty first; then FSRS is a real upgrade rather than a lateral move.

Everything except the #6 migration is a **redeploy, not a data migration** — the store is event-sourced, so a math change recomputes on next render with nothing to backfill.

---

## 2. Model

### 2.1 `strength` vs `s_eff`

`strength` stays exactly as it is: append-only, one accumulator per topic, the input to **velocity, EXP-history, work-logged, and badges**. Nothing that reads `strength` today changes.

Retention, health-via-retention, EXP, `projectedDue`, and the due queue instead read **effective stability**:

```
s_eff = max(S_EFF_MIN, strength · P)
```

where `P ∈ (0, 1]` is a **lapse factor** folded from the topic's `review_history`. `P = 1` for any topic that has never failed a test, so unlapsed topics are unchanged.

### 2.2 The fold (derived, in `replay.ts` — not stored)

```
lapseFactor(events, asOf):
  P = 1
  for e in events ordered by date, date ≤ asOf:
    if e.kind == 'test_fail':
      pen = penaltyFrom(e.test.actual_retention)                 // continuous, ≤ 1
      if e.smeared: pen = 1 − (1 − pen) · SMEAR_PENALTY_DAMPING  // toward 1 = softer
      P *= pen
    else if e.kind == 'test_pass':
      P = min(1, P · LAPSE_RECOVERY)                             // asymmetric, capped
  return P
```

- **Scale-free and order-independent** in the way additive/fractional-subtraction penalties are not: a fixed subtraction is devastating at `strength 3` and noise at `strength 20`; a fractional subtraction is multiplicative in disguise but non-commutative with later gains, so replay order would start to matter. `Π` avoids both.
- `smeared` events (uniform-fallback exams, §4) are **included in the fold** — a smeared exam is still real evidence the topic was tested and went badly; it is only *imprecisely attributed* across the linked topics. This is unlike `tuneKFactor` (§4), which is compounding self-tuning off a residual where interpolation accumulates *permanent* curve-shape error; the fold is a bounded, per-event response, so it takes the evidence, optionally softened by `SMEAR_PENALTY_DAMPING` (default `1.0`, a no-op until the harness says otherwise). **Gain (§2.4) and penalty must agree on smeared — both act.** If the penalty excluded smeared while the gain did not, a no-`breakdown[]` learner would have `P = 1` forever: raw strength rises on every failed exam with no offsetting penalty, which is exactly today's "a lapse looks healthier," preserved intact for the uniform-fallback subset.
- The binary `kind` still *selects the branch*, but its **magnitude is continuous**, so the 80% cliff disappears: `penaltyFrom(actual_retention)` is continuous through the mark (`≈1.0` at 0.80), so a 79% barely dents `s_eff` and a 30% guts it.

### 2.3 `penaltyFrom` (parameterised; linear default)

```
penaltyFrom(a) = clamp( PENALTY_FLOOR + (1 − PENALTY_FLOOR) · (a / TEST_PASS_MARK),
                        PENALTY_FLOOR, 1 )
```

`penaltyFrom(0.80) = 1.0`, `penaltyFrom(0) = PENALTY_FLOOR (0.4)`, monotonic. The shape is a **named, swappable function** — the harness may replace linear with a convex form; the endpoints are the contract.

### 2.4 Continuous test gain (#7)

`strengthIncrement` becomes continuous for **tests only**:

```
strengthIncrement(event):
  if kind == 'study_review':  // unchanged — confidence buckets
     conf ≤ 2 → CONF_LOW ; conf == 3 → CONF_MID ; conf 4–5 → CONF_HIGH
  else:                       // test_pass / test_fail, a = actual_retention
     a ≤ TEST_PASS_MARK → TEST_GAIN_MIN + (TEST_GAIN_AT_PASS_MARK − TEST_GAIN_MIN) · (a / TEST_PASS_MARK)
     a >  TEST_PASS_MARK → TEST_GAIN_AT_PASS_MARK + (TEST_GAIN_MAX − TEST_GAIN_AT_PASS_MARK) · ((a − TEST_PASS_MARK) / (1 − TEST_PASS_MARK))
```

Anchored to **mirror `penaltyFrom`**: `a = 0.80 → TEST_GAIN_AT_PASS_MARK (1.5)`, exactly today's pass value, so the mark is **unchanged**; `a = 0 → TEST_GAIN_MIN (0.15)`; and it continues above the mark to `TEST_GAIN_MAX (2.0)` so a 100% exam beats an 80% one. Contract: **continuous, monotonic, unchanged at the mark.**

A single-anchor form (`a=1 → 1.5`) is wrong: it deflates every sub-perfect pass (an 85% would drop from `1.5` to ~`1.3`). Raw strength feeds `topicVelocity → slow_growth (<0.5)` / `ready_to_test (≥0.5)`, so deflating gains **shifts both badge thresholds as a side effect** — and the harness scores predicted `R` against `actual_retention`, so it is **blind** to a badge-firing-rate regression. §8 adds a badge-firing-rate guard for exactly this. The signature changes from `(kind, confidence)` to `(event)` because tests now need `actual_retention`; all callers update. Gain and penalty are **orthogonal** but must agree on smeared (§2.2): a low fail adds a small raw gain *and* applies a strong penalty; a high pass adds a large raw gain *and* recovers `P`.

### 2.5 Recovery asymmetry — stated on `P`, not `s_eff`

`LAPSE_RECOVERY ≈ 1.25`, **not** `2.0`: a `test_pass` also adds up to `TEST_GAIN_MAX` to raw `strength`, so recovery must be slow or a lapse is trivially undone.

The invariant lives on **`P`, not `s_eff`**. Because `s_eff = strength · P` and raw `strength` only grows, for a *young* topic the additive gain dominates the multiplicative recovery and `s_eff` after fail→pass *exceeds* its pre-fail value — e.g. `strength 1.0, P 1, s_eff 1.0`: hard fail (`a=0`) → `strength 1.15, P 0.4, s_eff 0.46`; perfect pass → `strength 2.65, P 0.5, s_eff 1.33 > 1.0`. Crossover is ~`strength 1.65`, and **no choice of `LAPSE_RECOVERY` fixes it** — the raw gain arrives through the other term. Therefore:

- **Guaranteed on `P`:** `P` is capped at `1`; a `test_fail` with `a < TEST_PASS_MARK` strictly lowers `P`; a *hard* fail then one pass leaves `P = PENALTY_FLOOR · LAPSE_RECOVERY = 0.5 < 1` — ~5 passes to fully recover (`⌈log(1/PENALTY_FLOOR)/log(LAPSE_RECOVERY)⌉`).
- **Not universal:** recovery is a *fixed* `1.25` per pass (not continuous in `a`), so a *mild* fail from an already-depressed `P` can be over-recovered (`P 0.6 → mild fail 0.54 → pass 0.675 > 0.6`). Whether recovery should scale with `a` above the mark is a harness question, deferred — don't assert a universal strict-`<` on `P` or the regression test hits the same "fails, then mis-tune a constant" trap.
- **`s_eff` non-overshoot is tested only on a mature starting strength** (§8), never on a seeded `s = 1`.

### 2.6 New constants

| Constant | Default | Meaning |
|---|---|---|
| `S_EFF_MIN` | `0.25` | floor on `s_eff` so a fully-lapsed topic still has a defined, non-zero curve |
| `LAPSE_RECOVERY` | `1.25` | per-pass multiplicative recovery of `P`, capped at 1 |
| `PENALTY_FLOOR` | `0.40` | `penaltyFrom` at `actual_retention = 0` |
| `SMEAR_PENALTY_DAMPING` | `1.0` | fraction of a smeared exam's penalty that applies (`1.0` = full/no damping, `0` = none) |
| `TEST_GAIN_MIN` | `0.15` | continuous test gain at `actual_retention = 0` |
| `TEST_GAIN_AT_PASS_MARK` | `1.50` | test gain at the `0.80` mark — today's pass value, so the mark is unchanged |
| `TEST_GAIN_MAX` | `2.00` | test gain at `actual_retention = 1` (a perfect exam beats an 80% one) |

All defaults are **starting points for the harness**, not calibrated finals.

---

## 3. Where it plugs in

- **`predictRetention` (`retention.ts`)** folds `P` from the passed topic's `review_history` and uses `s_eff`. It keeps reading the **stored** `k_factor` (O(1)); stored `k` equals the forward-recomputed `k` after the §4 migration, so no live `k` recompute is needed. The `P` fold is O(history); memoise it (WeakMap keyed on the `review_history` array reference) for the per-topic-per-render path.
- **`projectedDue` (`retention.ts:73`) is *not* free.** It computes `t_due = −k · strength · ln(threshold)` from raw `strength` directly. Switch it to `s_eff` or failed topics won't resurface. `isDue`/`dueQueue` *are* free — they route through `predictRetention`.
- **`history.ts` will otherwise fold future fails.** `topicAsOf` keeps the *full* `review_history` and rebuilds strength by *subtracting* later increments; a past sparkline point would see fails that hadn't happened yet, and its `incrementOf(kind, conf)` mirror can't compute continuous test gains (needs `actual_retention`). **Fix:** retire the subtraction path and put `retentionSeries` on the same forward replay (`topicStateAsOf`) that already returns a correctly-truncated history. One replay, not two.
- **Drift ordering is already safe — keep it.** `applyEvent` computes drift from the pre-append `topic`, not `next` (`recalculate.ts:78`), so a fail is scored against the curve *before* it lands; once `predictRetention` folds `P`, that stays correct precisely because the pre-event topic's history excludes the in-flight event. Pin with a regression test — this is the kind of correctness that survives only until someone "tidies" `applyEvent`.
- **`topicVelocity` stays on raw `strength`** (unchanged). Routing it through `s_eff` would make `brittle_fluency` and `slow_growth` both fire on the same lapse.

### 3.1 Triple-counting — verify before tuning

A failed exam already hits health via `errorScore` and (if confidence was high) `calibrationScore`; adding retention makes it three. Probably still correct, but **check the resulting health drop isn't absurd on a real store before tuning any constant.** This is a validation step, not a design change.

### 3.2 Shared forward-k function

Extract the forward walk that carries `strength`, `k_factor`, `drift_history`, and `P`/`s_eff` from genesis (`k = DECAY_K`) into **one shared function**, used by (a) `topicStateAsOf`, (b) the §4 migration, and (c) the harness. It **recomputes `k` forward and never trusts stored `k`** — trusting stored `k` would leak today's `k` into past predictions and quietly contaminate the prior-events-only guarantee the whole #1-vs-FSRS decision rests on. `topicStateAsOf` already forward-replays via `applyEvent`; this makes that the single path. When #4 lands later, its app-side change is just "persist what this already computes."

---

## 4. #6 — uniform-fallback exams, and purging existing contamination

**Live rule (future writes):** in `mergeExam`, an exam with no `breakdown[]` (or a topic absent from it) smears one uniform score across every linked topic. Mark that event `smeared: true`; `applyEvent` then **skips `pushDrift` and `tuneKFactor`** for it. Self-tuning (`k`) must not run on evidence we know is interpolated — but the §2.2 fold still *includes* the event (dampened by `SMEAR_PENALTY_DAMPING`), because a bounded per-event penalty tolerates smeared evidence where compounding `k`-tuning does not (§2.2).

**The correction — existing state is already contaminated.** `k_factor` and `drift_history` are *stored* on the topic and already contain tuning from past uniform-fallback exams. Skipping future writes leaves that baked into live `k` — and into the harness at whatever point it hands off to stored values.

**Chosen exit: recompute on deploy.** `store.exams[]` retains each exam's breakdown presence, so we can replay every past exam under the new rule and rebuild `k_factor` + `drift_history` from scratch, via the same shared forward-k function (§3.2), run once at migration. This also backfills the `smeared` marker onto each exam-sourced event so future replays need no join back to the exam.

- This is the **one** place this spec touches persisted state, so it needs a `schema_version` bump (`3.0.0 → 3.1.0`) and a load-time migration; everything else is a clean redeploy.
- `smeared` is an **optional** boolean on `ReviewEvent` (absent ⇒ not smeared), so pre-migration bundles still validate and import; the migration sets it.
- **Migration must run on the import path too, not just load.** `loadStore` calls `migrate` (`storage.ts:39`), but `importBundle` restores verbatim and its caller `replaceStore` (`useStore.ts:216`) does neither — so importing a pre-`3.1.0` bundle *after* deploy would silently reinstate contaminated `k`. Route import (and `replaceStore`) through the same versioned, idempotent `migrate`, a no-op once `schema_version ≥ 3.1.0`.
- **Unresolved provenance defaults to `smeared: true`.** Backfilling reads breakdown presence by joining `event.source_id → store.exams[]`. If that row is gone, "absent ⇒ not smeared" is the *un-cautious* default — it lets unverifiable evidence tune `k`. Default an unresolvable exam-sourced test event to `smeared: true`: unknown provenance is excluded from `k`-tuning and merely dampened in the fold.
- Rejected alternative — *let it decay*: `±10%` clamped steps wash contamination out over a handful of real exams, and it keeps the spec migration-free. Defensible for a small local-first store, but it leaves known-bad `k` in place under the exact eval we're about to make a model decision on. Not worth it while we're already writing the function.

---

## 5. Day-quantization nit

`daysBetween` floors elapsed ms, so `t` is quantised to whole days — under-counting decay by up to ~1 day. Replace with **fractional days**:

```
t = (to − from) / MS_PER_DAY        // no floor
```

**Resolution check (gating, per §7) — resolved: safe.** Fractional `t` is only honest if `last_reviewed` carries a time. It does: `ReviewEvent.date` and `last_reviewed` are schema-typed `date-time` with `ajv-formats` asserting the format (`schemas.ts:15,57,107` + `validate.ts:81`), so a date-only value is *rejected at ingestion* and can never enter the store. Sessions/manual-reviews stamp `new Date().toISOString()`; the guard `t ≤ 0 → R = 1` stays.

Residual caveat (documented, not blocking): a source that only knows the calendar date — chiefly an AI-filled exam — may stamp midnight, making intra-first-day `t` somewhat arbitrary. The error is bounded (< 1 day) and self-corrects at the next real-timestamped event; it is *not* the whole-day phantom-decay failure, which the format assertion rules out.

Consequences to call out: the §2 wording changes ("`t`: whole days elapsed" → fractional); existing worked-example/engine tests change. And "reviewed today" is now **strength-dependent** — a mature topic reads ~99% by evening, but a freshly seeded topic (`s = 1`) reads ~94%, a larger visible change than a single number implies. **This changes `t → predicted R → drift → k`, so it lands before the baseline harness run** or before/after aren't the same model.

---

## 6. Offline eval harness

A standalone scorer (not shipped in the app bundle) that reads a real store (exported bundle / localStorage dump) and, for each topic, walks events in date order; at each **test** event it computes predicted `R` from **prior events only** (forward replay up to just before the event, via the §3.2 shared function so `k` is recomputed forward, never stored) and compares to `actual_retention`.

- **Metrics:** MAE `= mean |R_pred − a|`; **log-loss with `actual_retention` as a soft label** `= mean −[a·ln R_pred + (1−a)·ln(1−R_pred)]` — a Bernoulli-on-pass/fail loss would bake the 80% cliff into the metric we're using to evaluate *removing* the 80% cliff. **Report the Bernoulli (hard pass/fail) figure alongside it** anyway, since published FSRS numbers are Bernoulli and the comparison must be like-for-like.
- **Numerical guards:** clamp `R_pred` to `[ε, 1−ε]` before log-loss — `t ≤ 0 → R = 1` is reachable (a test the same day as a prior review) and `ln(1−1) = −∞` would silently poison a run. Record a **constant-predictor baseline** (predict the store's mean `actual_retention`) so MAE has a scale.
- **Models compared:** `current` · `#1` (multiplicative penalty, binary gain) · `#1 + continuous` (penalty + §2.4 gain) · a rough FSRS port.
- **Eval-set hygiene:** smeared (uniform-fallback) events are **excluded as *targets*** (a synthetic interpolation must not score a model) **but kept in *history*** — they still moved `strength` and `last_reviewed`, so dropping them from the replay would corrupt the state every *other* prediction is built on. (Down-weighting targets is the fallback; exclude is cleaner now that events carry the marker.)
- **Decision rule:** if `#1` (or `#1 + continuous`) closes most of the gap to FSRS on MAE/log-loss, it's the answer, not a waypoint. Tune `penaltyFrom` shape, `TEST_GAIN_*`, `LAPSE_RECOVERY`, `PENALTY_FLOOR`, `S_EFF_MIN`, `SMEAR_PENALTY_DAMPING` on this metric — not by taste.

---

## 7. Sequencing (within this spec)

1. **Day-quantization + #6** (live rule, `smeared` marker, migration + recompute). These change the model `t`/`k`, so they must precede any baseline.
2. **Harness on the current model** → record the **baseline** MAE/log-loss. If the harness lands after the rewrite there's no before-number and "did this help" becomes taste again — the exact failure the harness exists to prevent.
3. **#1 + #7** (fold, `s_eff`, continuous gain, `projectedDue`, `history.ts` consolidation), then re-score and tune.

---

## 8. Testing

- Regression test pinning **drift-computed-before-append** in `applyEvent` (guards a future "tidy" to `next`).
- `penaltyFrom`: monotonic; `penaltyFrom(0.80) = 1.0`; `penaltyFrom(0) = PENALTY_FLOOR`.
- `strengthIncrement` (test branch): monotonic in `a`; **unchanged at the mark** (`a = 0.80 → TEST_GAIN_AT_PASS_MARK`); `a = 1 → TEST_GAIN_MAX` (above the mark value).
- Smeared consistency: a smeared `test_fail` both adds raw gain (§2.4) *and* lowers `P` (§2.2, dampened) — never one without the other.
- `s_eff = max(S_EFF_MIN, strength·P)`; floor holds for a fully-lapsed topic.
- **Recovery invariant on `P`, at a hard fail:** `a = 0` fail then one pass leaves `P = PENALTY_FLOOR·LAPSE_RECOVERY (0.5) < 1`; ~5 passes to reach `1`. Do **not** assert strict `<` for a mild fail — it can over-recover (§2.5).
- **`s_eff` non-overshoot gated on maturity:** fail→pass does not raise `s_eff` above pre-fail *only* for a mature starting strength (e.g. `s ≥ 3`); never assert it for a seeded `s = 1`.
- **Badge-firing-rate guard:** on a fixed store, `slow_growth`/`ready_to_test` firing counts before vs after the continuous-gain change — the harness metric is blind to this, so it needs its own test.
- `projectedDue` moves earlier after a fail (uses `s_eff`, not raw `strength`).
- `retentionSeries` past points do **not** reflect future fails (forward-replay consolidation).
- Migration: idempotent; runs on **load and import**; recomputed `k_factor`/`drift_history` for a store with a known uniform-fallback exam differ from pre-migration and match a fresh forward replay under the new rule; an unresolvable exam-sourced event backfills `smeared: true`.
- Harness: predicted `R` at each test uses prior events only (no leakage of the scored event or later ones); `R_pred` clamped to `[ε, 1−ε]` so a same-day test can't yield `−∞` log-loss; smeared events excluded as targets but present in history.
- Worked-example / engine tests updated for fractional `t` and continuous test gain.

---

## 9. Follow-ups unlocked

- **#4** becomes "persist what §3.2 already computes" (structured `drift_history` with `{date, drift, k_after}`), making `expTrend`/level high-water exact rather than approximate.
- **#2**, **#5**, **#3**, streak/`manual_review`, and the **FSRS** decision each get their own spec; the FSRS one is now informed by §6's numbers.
