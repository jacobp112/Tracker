# Math & Algorithms Specification
**Document 2 of 4 — Project: [Working Title] Personal Tracker**
**Status:** Draft v0.2.1 — model replaced (§0.1); projected due date added (§2.1)
**Depends on:** Document 1 (Data & Schema Spec)
**Referenced by:** UI Spec, Product Spec / User Stories

---

## 0. Purpose of this document

This document defines every formula, threshold, and constant used by the study engine. Nothing here is a suggestion — if a value is listed as a constant, it is implemented as a named, configurable constant (not a magic number inline in code), and no formula may be substituted without updating this document first.

The engine has one job: from a topic's history of reviews, tests, and errors, produce the numbers the dashboard shows — **live retention**, a composite **health score**, a **calibration** reading, and a set of **diagnostic signals**. It is a real, working model (it powers an existing build), not a theoretical design.

### 0.1 Changelog / model note

An earlier draft (v0.1) specified an Ebbinghaus + SM-2 easiness-factor model with a `memory_strength` and `ease_factor` per topic. **That model is withdrawn in full and must not be implemented.** It is replaced by the model below, which is the one actually in use: an exponential forgetting curve driven by a `strength` value and a **self-tuning per-topic decay constant (`kFactor`)**, plus a five-component **health score**, an **overconfidence index (OCI)** for calibration, and a set of derived **diagnostic badges**. Any reference in another document to `ease_factor`, `memory_strength`, or "SM-2" is stale and should be read as `strength` / `kFactor` / "this document."

---

## 1. Constants & parameters (single reference table)

All constants live in one config object/file, never inline. Defaults shown are the calibrated production values.

| Constant | Symbol | Default | Meaning |
|---|---|---|---|
| Baseline decay constant | `DECAY_K` | `8.4` | calibrated so strength 1 → retention ≈ 0.70 at ~3 days |
| Due threshold | `DUE_THRESHOLD` | `0.70` | a topic is "due for review" when predicted retention drops below this |
| kFactor lower clamp | `K_MIN` | `DECAY_K × 0.5` = `4.2` | slowest a topic's decay constant may be tuned |
| kFactor upper clamp | `K_MAX` | `DECAY_K × 2.0` = `16.8` | fastest-retaining a topic may be tuned to |
| kFactor tune step | `K_STEP` | `0.10` (±10%) | proportional adjustment per tuning event |
| Drift trigger band | `DRIFT_BAND` | `0.10` | average drift beyond ±this triggers a kFactor adjustment |
| Drift history length | `DRIFT_WINDOW` | `5` | most recent drift samples retained per topic |
| Min drift samples to tune | `DRIFT_MIN` | `3` | tuning only begins once this many drift samples exist |
| Strength gain — test pass | — | `1.5` | strength added on a passed test |
| Strength gain — test fail | — | `0.15` | strength added on a failed test |
| Strength gain — conf ≤ 2 | — | `0.30` | study review, low confidence |
| Strength gain — conf = 3 | — | `0.60` | study review, medium confidence |
| Strength gain — conf 4–5 | — | `1.00` | study review, high confidence |
| Slow-growth velocity floor | `SLOW_V` | `0.50` | strength-per-review below this (with ≥3 reviews) flags Slow Growth |
| Health weight — retention | `W_RET` | `0.30` | |
| Health weight — error pressure | `W_ERR` | `0.25` | |
| Health weight — calibration | `W_CAL` | `0.20` | |
| Health weight — fluency | `W_CONF` | `0.15` | |
| Health weight — card coverage | `W_CARD` | `0.10` | |
| Test pass mark | — | `0.80` | fraction of `outOf` at/above which a test counts as a pass |
| Velocity window | `VELOCITY_WINDOW_WEEKS` | `4` | rolling window for study velocity |
| Projection optimism / pessimism | — | `1.25` / `0.75` | multipliers giving the projected-finish range |

---

## 2. Retention (the forgetting curve)

$$R(t) = e^{-t / (k \cdot s)}$$

- `R(t)`: predicted retention, 0–1 (shown as a % in the UI).
- `t`: whole days elapsed since the topic's `reviewed` date, computed against `now`.
- `s`: the topic's current `strength` (≥ 0).
- `k`: the topic's current `kFactor` (defaults to `DECAY_K` until tuned).

Rules:
- If the topic has never been reviewed (`reviewed == null`) or `status == "Not Started"` → retention is **undefined** (not a number). The UI shows a neutral "—" cell, not 0%.
- If `t ≤ 0` (reviewed today) → `R = 1.0`.
- If `s ≤ 0` → `R = 0.0`.

Retention is evaluated **fresh on every dashboard render** against the current date — so a topic visibly decays between visits with no event. This continuous decay is the product's core behaviour.

A topic is **due for review** when `R < DUE_THRESHOLD` (0.70).

### 2.1 Projected due date

*(Added in v0.2.1 — required by Document 1 v0.2 §0.1 item 5. The withdrawn v0.1 model stored a `next_review_due` written by SM-2 interval math; that math is gone, so the date is **derived from the curve above** rather than stored. This introduces no new model: it is §2 solved for `t`.)*

Setting `R(t) = DUE_THRESHOLD` and solving for `t`:

$$t_{due} = -k \cdot s \cdot \ln(\text{DUE\_THRESHOLD})$$

```
due_date = reviewed + t_due days          // t_due = −k·s·ln(0.70) ≈ 0.3567·k·s
```

- Undefined when `reviewed == null` or `s ≤ 0` — the UI shows "not yet reviewed", never a fabricated date.
- If `due_date` is in the past the topic is **already overdue**; the UI says so rather than showing a past date as "upcoming".
- This is a *projection*, recomputed live like retention. It is **never persisted** — a stored copy would go stale the moment `k` or `s` changed.

**Worked check** (the §12 topic): `k = 7.0`, `s = 1.3` → `k·s = 9.1`, `t_due = 0.3567 × 9.1 = 3.25` days. Reviewed 9 days ago, so it fell due ~5.75 days back — consistent with its `R = 37%` being well under 0.70.

This is what populates Document 3 §5.2's "Upcoming review plan" dates and orders the review queue (§11).

---

## 3. Strength

`strength` is a per-topic accumulator that lengthens the retention curve (higher strength = slower decay). It only ever grows, by a fixed increment per logged event:

| Event | Increment |
|---|---|
| Test passed (`source = test-pass`) | `+1.5` |
| Test failed (`source = test-fail`) | `+0.15` |
| Study review, confidence ≤ 2 | `+0.30` |
| Study review, confidence = 3 | `+0.60` |
| Study review, confidence 4–5 | `+1.00` |

On each review the topic's `reviewed` date is set to today and the event is appended to `reviewHistory` (append-only). New topics initialise `strength` to `0`; the first status promotion out of "Not Started" seeds it to `1.0` (see §7).

---

## 4. Self-tuning decay (`kFactor`)

This is what makes the model adaptive: each topic learns its own real decay rate by comparing what the curve *predicted* against what a test actually *showed*.

### 4.1 Drift

On a test event (`test-pass` / `test-fail`) that carries an observed retention (`actualRetention`, i.e. the test's fractional score at the moment of sitting):

```
drift = actualRetention − predictedRetention   // predicted via §2 just before the event
```

Push `drift` onto the topic's `driftHistory`, capped at `DRIFT_WINDOW` (5) most-recent samples.

### 4.2 Adjustment

Once `driftHistory` holds at least `DRIFT_MIN` (3) samples, compute the mean drift and adjust:

```
avgDrift = mean(driftHistory)

if avgDrift < −DRIFT_BAND:      kFactor_new = kFactor_old × (1 − K_STEP)   // decayed faster than predicted → shorten curve
else if avgDrift > +DRIFT_BAND: kFactor_new = kFactor_old × (1 + K_STEP)   // retained better than predicted → lengthen curve
else:                           kFactor_new = kFactor_old                   // within band, no change

kFactor_new = clamp(kFactor_new, K_MIN, K_MAX)   // 4.2 … 16.8
```

Persist `kFactor_new` (rounded to 2 dp) only if it changed by more than `0.001`. A negative average drift means the learner is forgetting *faster* than the model assumed, so the curve is pulled in (steeper decay); positive drift lengthens it.

---

## 5. Calibration — Overconfidence Index (OCI)

OCI measures the gap between how confident the learner felt and how they actually scored. Per topic, over all its tests that carry a confidence rating:

```
OCI = mean over tests of [ (confidence / 5) − (score / outOf) ]
```

- `OCI > 0` → **overconfident** (felt stronger than performance).
- `OCI < 0` → **underconfident**.
- `OCI ≈ 0` → **well calibrated**.

Topics with no tests have `OCI = 0` by definition. The UI thresholds a course-level mean OCI at ±0.10 to label "Overconfident / Well calibrated / Underconfident" (Document 3). OCI also feeds the health score (§6).

---

## 6. Health score (0–100)

A single composite per topic, the weighted sum of five sub-scores (each 0–100):

```
health = W_RET·retentionScore + W_ERR·errorScore + W_CAL·calibrationScore
       + W_CONF·confidenceScore + W_CARD·cardScore
       =  0.30·retentionScore + 0.25·errorScore + 0.20·calibrationScore
       +  0.15·confidenceScore + 0.10·cardScore
```

Sub-scores:

| Sub-score | Definition |
|---|---|
| `retentionScore` | `predictRetention(topic) × 100` (0 if undefined) |
| `errorScore` | by count of **active** errors on the topic: `0 → 100`, `1 → 70`, `2 → 40`, `≥3 → 0` |
| `calibrationScore` | `100 × (1 − |OCI|)`, floored at 0; **`100` if the topic has no tests** (no evidence of miscalibration) |
| `confidenceScore` | `(confidence / 5) × 100`; `0` if no confidence recorded |
| `cardScore` | `min(100, cardCount × 20)` — full at 5+ flashcards |

Result is rounded to an integer. Health is **only surfaced** for topics at status `Practising` or `Mastered` (Document 3 §5.2) — below that there isn't enough signal for it to be meaningful, though it is still computable.

Health bands for colour (Document 3): `> 70` high (green), `40–70` mid (amber), `< 40` low (red).

---

## 7. Status

Status is a four-state ladder: `Not Started → Learning → Practising → Mastered`. In this model status is **set by the learner/import** (a review or import promotes it), not derived purely from the math — but two automatic rules apply:

- On the first promotion out of `Not Started`, if `strength` is falsy it is seeded to `1.0` and `reviewed` stamped to today.
- The math never silently demotes a topic; decay is expressed through falling retention and health, not by rewriting status.

(This is a deliberate difference from the withdrawn v0.1, which derived status from thresholds. If a future version wants derived status, it must be specified here first.)

---

## 8. Diagnostic badges

Qualitative flags derived from the quantitative state, surfaced per topic (Document 3). Let `velocity = strength / reviewCount` (0 if no reviews), and `lastFailed = latest test scored < 0.80 × outOf`.

| Badge | Condition | Meaning |
|---|---|---|
| **Slow growth** | `reviews ≥ 3` and `velocity < SLOW_V (0.5)` | strength isn't moving despite repeated review — change method |
| **Boredom zone** | `confidence = 5` and `reviews ≥ 4` and `activeErrors = 0` and not `lastFailed` | over-reviewed a solid topic (Bjork desirable-difficulty) — rotate out |
| **Brittle fluency** | `confidence ≥ 4` and `lastFailed` | felt fluent, latest test missed the 80% bar |
| **Under-carded** | `activeErrors ≥ 2` and `cardCount = 0` | recurring misconceptions but no flashcards made |
| **Ready to test** | `confidence ≥ 4`, not `lastFailed`, has tests, `velocity ≥ 0.5`, not Not Started | good fluency after real work — validate with a timed set |

Study-time signals (Friction, Needs retrieval, Efficient, etc.) are a parallel set driven by logged study seconds vs. confidence; they follow the same "derive a label from the numbers" pattern and are specified alongside the time-tracking feature (backlog, Document 4).

---

## 9. Weak-topic ranking

For the "weak topics" surface (Document 3 §5.2), rank the course's topics by a weakness ordering:

1. Primary sort: **lowest health first**.
2. Tie-break: **lowest retention first**.
3. Exclude `Not Started` and `Mastered` from the weak list (nothing to act on / already done).

Active errors and the badges above are shown alongside so the list explains *why* a topic is weak, not just that it is.

---

## 10. Velocity & projected finish

```
velocity = (topics reaching "Mastered" within the last VELOCITY_WINDOW_WEEKS) / VELOCITY_WINDOW_WEEKS   // topics per week
```

**Low-data guard:** if fewer than 2 topics have ever reached Mastered, velocity is undefined — the projection must show "Not enough data yet", never a fabricated or infinite date.

```
remaining       = count of topics not yet Mastered
best_case_date  = today + remaining / (velocity × 1.25) weeks
worst_case_date = today + remaining / (velocity × 0.75) weeks
```

Always shown as a **range**, never a single date. If `remaining == 0` → "Course complete".

---

## 11. Due-for-review selection

The review queue (Document 3 Overview) is built from topics with `R < DUE_THRESHOLD`, then:

1. Sort by **lowest retention first** (most decayed on top).
2. Apply section spreading: when picking the top N (default 5), prefer not to place two consecutive topics from the same section, so the queue interleaves subjects rather than dumping one section.

---

## 12. Worked example (real numbers)

Topic "Algebraic fractions": `strength = 1.3`, `kFactor = 7.0`, `reviewed = 9 days ago`, `confidence = 4`, `activeErrors = 2`, `cards = 1`, one test scoring 11/20 at confidence 4.

**Retention.**
`t = 9`, `k·s = 7.0 × 1.3 = 9.1` → `R = e^(−9/9.1) = e^(−0.989) = 0.372` → **37%.** Below 0.70, so **due for review**.

**OCI.** one test: `(4/5) − (11/20) = 0.80 − 0.55 = 0.25` → `OCI = +0.25` → **overconfident.**

**Health.**
- retentionScore = 37.2
- errorScore = 40 (2 active errors)
- calibrationScore = 100 × (1 − 0.25) = 75
- confidenceScore = (4/5)×100 = 80
- cardScore = min(100, 1×20) = 20
- health = 0.30·37.2 + 0.25·40 + 0.20·75 + 0.15·80 + 0.10·20 = 11.16 + 10 + 15 + 12 + 2 = **50** (mid band, amber).

**Badges.** velocity = 1.3 / 3 reviews ≈ 0.43 (< 0.5 with ≥3 reviews) → **Slow growth.** Under-carded needs `cards = 0`, but cards = 1, so it does *not* fire.

**Self-tuning.** Suppose the next test shows actual retention 0.30 while the curve predicted 0.37 → `drift = −0.07`. After three such negative samples averaging below −0.10, `kFactor` drops to `7.0 × 0.9 = 6.3` (still above `K_MIN` 4.2), steepening the curve to match the faster real forgetting.

---

## 13. Open items for other documents

- Colour bands, heatmap, health chips, calibration and badge presentation → **Document 3 (UI Spec)**
- Study-time signals, flashcard/error data flow, end-of-session prompt → **Document 4 (Product Spec)**
- **Document 1 sync required:** the Topic schema must carry `strength`, `kFactor`, `driftHistory[]`, `reviewHistory[]`, `conf`, `cards`, and error linkage — and must **drop** the withdrawn `ease_factor` / `memory_strength` fields. Flagged for a Document 1 update before build.
