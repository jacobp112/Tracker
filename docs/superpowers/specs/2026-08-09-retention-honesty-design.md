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
    if e.kind == 'test_fail' and not e.smeared:
      P *= penaltyFrom(e.test.actual_retention)      // continuous, ≤ 1
    else if e.kind == 'test_pass' and not e.smeared:
      P = min(1, P * LAPSE_RECOVERY)                  // asymmetric recovery
  return P
```

- **Scale-free and order-independent** in the way additive/fractional-subtraction penalties are not: a fixed subtraction is devastating at `strength 3` and noise at `strength 20`; a fractional subtraction is multiplicative in disguise but non-commutative with later gains, so replay order would start to matter. `Π` avoids both.
- `smeared` events (uniform-fallback exams, §4) are **excluded from the fold** — they never tuned `s_eff` any more than they should tune `k`.
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
  else:                       // test_pass / test_fail
     TEST_GAIN_MIN + (TEST_GAIN_MAX − TEST_GAIN_MIN) · actual_retention
```

`TEST_GAIN_MIN ≈ 0.15`, `TEST_GAIN_MAX ≈ 1.5` (today's fail/pass anchors), monotonic in `actual_retention`, no discontinuity at the mark. This changes **raw strength**, which still feeds velocity — intentional: a near-miss test no longer tanks velocity via a token `+0.15`. The signature changes from `(kind, confidence)` to `(event)` because tests now need `actual_retention`; all callers update. Gain and penalty are **orthogonal**: a low fail adds a small raw gain *and* applies a strong penalty; a high pass adds a large raw gain *and* recovers `P`.

### 2.5 Recovery asymmetry

`LAPSE_RECOVERY ≈ 1.25`, **not** `2.0`. A `test_pass` also adds up to `TEST_GAIN_MAX` to raw `strength`; if one pass fully erased one fail's `P`, a fail→pass round trip would leave the topic *better off than before the lapse*. Asymmetric recovery makes a lapse cost several passes to walk back.

### 2.6 New constants

| Constant | Default | Meaning |
|---|---|---|
| `S_EFF_MIN` | `0.25` | floor on `s_eff` so a fully-lapsed topic still has a defined, non-zero curve |
| `LAPSE_RECOVERY` | `1.25` | per-pass multiplicative recovery of `P`, capped at 1 |
| `PENALTY_FLOOR` | `0.40` | `penaltyFrom` at `actual_retention = 0` |
| `TEST_GAIN_MIN` | `0.15` | continuous test gain at `actual_retention = 0` |
| `TEST_GAIN_MAX` | `1.50` | continuous test gain at `actual_retention = 1` |

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

**Live rule (future writes):** in `mergeExam`, an exam with no `breakdown[]` (or a topic absent from it) smears one uniform score across every linked topic. Mark that event `smeared: true`; `applyEvent` then **skips `pushDrift` and `tuneKFactor`** for it, and the §2.2 fold skips it. Self-tuning must not run on evidence we know is interpolated.

**The correction — existing state is already contaminated.** `k_factor` and `drift_history` are *stored* on the topic and already contain tuning from past uniform-fallback exams. Skipping future writes leaves that baked into live `k` — and into the harness at whatever point it hands off to stored values.

**Chosen exit: recompute on deploy.** `store.exams[]` retains each exam's breakdown presence, so we can replay every past exam under the new rule and rebuild `k_factor` + `drift_history` from scratch, via the same shared forward-k function (§3.2), run once at migration. This also backfills the `smeared` marker onto each exam-sourced event so future replays need no join back to the exam.

- This is the **one** place this spec touches persisted state, so it needs a `schema_version` bump (`3.0.0 → 3.1.0`) and a load-time migration; everything else is a clean redeploy.
- `smeared` is an **optional** boolean on `ReviewEvent` (absent ⇒ not smeared), so pre-migration bundles still validate and import; the migration sets it.
- Rejected alternative — *let it decay*: `±10%` clamped steps wash contamination out over a handful of real exams, and it keeps the spec migration-free. Defensible for a small local-first store, but it leaves known-bad `k` in place under the exact eval we're about to make a model decision on. Not worth it while we're already writing the function.

---

## 5. Day-quantization nit

`daysBetween` floors elapsed ms, so `t` is quantised to whole days — under-counting decay by up to ~1 day. Replace with **fractional days**:

```
t = (to − from) / MS_PER_DAY        // no floor
```

Keep `t ≤ 0 → R = 1` (clock-skew / backdating guard). Consequence to call out: "reviewed today" is now ~99% by evening rather than a flat 100% for the whole day — consistent with the product's "visibly decays between visits" behaviour, but it changes existing tests and the §2 wording ("`t`: whole days elapsed" → fractional). **This changes `t → predicted R → drift → k`, so it must land before the baseline harness run** or before/after aren't measuring the same model.

---

## 6. Offline eval harness

A standalone scorer (not shipped in the app bundle) that reads a real store (exported bundle / localStorage dump) and, for each topic, walks events in date order; at each **test** event it computes predicted `R` from **prior events only** (forward replay up to just before the event, via the §3.2 shared function so `k` is recomputed forward, never stored) and compares to `actual_retention`.

- **Metrics:** MAE `= mean |R_pred − a|`; log-loss with `actual_retention` as a soft label `= mean −[a·ln R_pred + (1−a)·ln(1−R_pred)]`.
- **Models compared:** `current` · `#1` (multiplicative penalty, binary gain) · `#1 + continuous` (penalty + §2.4 gain) · a rough FSRS port.
- **Eval-set hygiene:** **exclude `smeared` (uniform-fallback) events from scoring** — a chunk of the labelled set is synthetic interpolation and would tune us to our own smear. (Down-weighting is the fallback; exclude is cleaner now that events carry the marker.)
- **Decision rule:** if `#1` (or `#1 + continuous`) closes most of the gap to FSRS on MAE/log-loss, it's the answer, not a waypoint. Tune `penaltyFrom` shape, `TEST_GAIN_*`, `LAPSE_RECOVERY`, `PENALTY_FLOOR`, `S_EFF_MIN` on this metric — not by taste.

---

## 7. Sequencing (within this spec)

1. **Day-quantization + #6** (live rule, `smeared` marker, migration + recompute). These change the model `t`/`k`, so they must precede any baseline.
2. **Harness on the current model** → record the **baseline** MAE/log-loss. If the harness lands after the rewrite there's no before-number and "did this help" becomes taste again — the exact failure the harness exists to prevent.
3. **#1 + #7** (fold, `s_eff`, continuous gain, `projectedDue`, `history.ts` consolidation), then re-score and tune.

---

## 8. Testing

- Regression test pinning **drift-computed-before-append** in `applyEvent` (guards a future "tidy" to `next`).
- `penaltyFrom`: monotonic; `penaltyFrom(0.80) = 1.0`; `penaltyFrom(0) = PENALTY_FLOOR`.
- `s_eff = max(S_EFF_MIN, strength·P)`; floor holds for a fully-lapsed topic.
- Recovery asymmetry: fail→pass does **not** leave `s_eff` above its pre-fail value.
- `projectedDue` moves earlier after a fail (uses `s_eff`, not raw `strength`).
- `retentionSeries` past points do **not** reflect future fails (forward-replay consolidation).
- Migration: idempotent; recomputed `k_factor`/`drift_history` for a store with a known uniform-fallback exam differ from pre-migration and match a fresh forward replay under the new rule.
- Harness: predicted `R` at each test uses prior events only (no leakage of the scored event or later ones).
- Worked-example / engine tests updated for fractional `t` and continuous test gain.

---

## 9. Follow-ups unlocked

- **#4** becomes "persist what §3.2 already computes" (structured `drift_history` with `{date, drift, k_after}`), making `expTrend`/level high-water exact rather than approximate.
- **#2**, **#5**, **#3**, streak/`manual_review`, and the **FSRS** decision each get their own spec; the FSRS one is now informed by §6's numbers.
