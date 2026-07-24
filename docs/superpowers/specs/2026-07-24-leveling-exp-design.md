# Level-up UI & EXP — Design

**Date:** 2026-07-24
**Branch:** `rewrite-baseline-and-leveling`
**Status:** approved for planning

## Problem

The leveling engine (`src/engine/leveling.ts`) exists but nothing renders it, and
there is no EXP concept at all. We want to surface *progress* in a way that is
honest under this app's core principle — **derive, never store; numbers can't
drift from the history that explains them** — without letting *activity*
masquerade as *knowledge*.

The failure mode we are explicitly designing against: a stored, accumulating XP
counter that rises when you re-read and never falls when you forget. That metric
gets more flattering the longer you use it — the exact thing OCI exists to catch.
We will not put a systematic liar on the dashboard.

## The model: three numbers, three jobs, never merged

| Number | Answers | Behaviour | Home |
|---|---|---|---|
| **Topic level** (0–5) | "What have I demonstrably reached here?" | Ratchets on evidence; never reverses | TopicDetail |
| **EXP** = Σ retention over started topics | "What can I retrieve *today*?" | Moves continuously, both ways | Overview header |
| **Work logged** (sessions · hours · papers) | "What have I put in?" | Monotonic | Overview header |

The cardinal sin — merging effort into progress — is avoided by keeping these
three orthogonal. EXP answers "what do I know right now"; work logged answers
"what have I put in"; level answers "what have I demonstrably reached."

### Why each behaves as it does

- **Topic level ratchets** because it is gated on *evidence events* (validation,
  mastery), which are historical facts, and facts don't decay. A validated topic
  stays validated.
- **EXP moves both ways** because retention *is* "what you could retrieve today,"
  and retention decays. EXP falling after an idle week is the point: it makes the
  due queue self-motivating rather than nagging.
- **Work logged only rises** because it counts append-only history that only
  grows. It is what you look at on a bad week when EXP has dipped and you need
  evidence you haven't wasted six months.

## EXP: `Σ retention over started topics`

```
exp     = Σ  min(1, predictRetention(topic, now))   for topics with status ≠ not_started
ceiling = count of started topics
```

Rendered as **"14.2 / 23 topics retrievable."**

**Why retention alone, not `strength × retention`.** `strength` is unbounded and
grows on *every* review (`recalculate.ts` — strength only ever climbs). Weighting
by it would (a) let re-reading an already-fresh topic raise EXP — activity
leaking back in — and (b) let one obsessively-drilled topic dominate the sum.
Retention alone is bounded [0,1] per topic and is *precisely* "the fraction you
could retrieve right now."

**Strength is still rewarded — temporally, not magnitudinally.** A deeply-learned
topic and a barely-learned one both sit near 1.0 the day you review them (both
are retrievable today — true). The difference appears next week: the strong one
has barely sagged, the weak one has fallen off. So over-learning shows up as
*area under the curve over time* — visible precisely in the 7-day trend — rather
than as a bigger number today. This is a more faithful model of what strength does.

**Linear, not `retention²`.** Retention isn't linear in exam usefulness (0.5 is
closer to a coin-flip than to "half a topic known"), so there's a case for convex
weighting. We reject it: EXP is a *direction indicator*, not a score; convexity
makes the trend jumpier for accuracy we don't need. If the distinction ever
matters it belongs in a separate diagnostic badge ("many topics in the 0.4–0.6
band"), never folded into the headline.

**Clamp.** `predictRetention` already returns `1` for `t ≤ 0` and `< 1` for
`t > 0`, so it is mathematically ≤ 1 today. We nonetheless apply an explicit
`min(1, …)` at the EXP accumulation so a backdated event or clock skew can never
push a point above the ceiling.

## EXP trend: 7-day, by forward-replay

The sparkline needs EXP as-of each of the last 7 days. We reconstruct it from the
append-only history — **no stored snapshots**.

**Forward-replay, never subtract.** For each topic, genesis is a known constant
(`prompts.ts`: `k_factor` is always `8.4 = DECAY_K`; strength `0`, seeded to
`SEED_STRENGTH` by the first event's `promote`; status `not_started`). We fold
`applyEvent` over the topic's `review_history` events with `date ≤ d` to get its
exact state as-of day `d`, then evaluate `min(1, predictRetention(state, d))`.

**The most-recent point is short-circuited to live state.** Rather than replaying
to reproduce today, `expTrend`'s last point reads `retrievable(store, now)`
directly. This makes invariant 2 unconditionally true — including for an imported
topic whose genesis `k_factor ≠ DECAY_K`, where a from-genesis replay would
otherwise diverge from live state. It is also cheaper. Only the *earlier* points
(strictly in the past) come from replay.

We do **not** reconstruct past state by subtracting recent strength increments:
strength is additive, but `k_factor` self-tunes over a *set* of drift samples and
is not generally reversible by removing the last few events. Forward-replay is
provably correct and costs nothing at this scale (7 days × N topics).

> Note: from-genesis replay assumes genesis `k_factor = DECAY_K`, exact for
> topics created in-app. A topic *imported* with pre-baked history and a
> non-default `k_factor` has exact **current** EXP (the most-recent point is live
> state, per above) but its *earlier* trend points may be approximate. Acceptable
> edge — it never touches today's headline figure or invariant 2.

**What the sparkline plots: `exp / ceiling`, not raw `exp`.** Over 21 months you
ingest three A-level syllabi at staggered times; a heavy study week on new
material raises numerator and denominator together, and an ingestion followed by
first-pass study moves raw EXP in ways that aren't retention change. The *ratio*
is comparable across time; raw EXP is not. So the trend line is the ratio, the
label shows the absolute pair, and ingestion days may be marked on the axis so a
step reads as "course added," not "something happened to my memory."

## Topic level: high-water mark, gated on evidence

`topicLevel` (existing, 0–5) bands the `health` score and gates it: `not_started`
→ 0, unvalidated topics cap at `UNVALIDATED_CAP` (3), only `mastered` reaches 5.

**But `topicLevel` alone is not a ratchet** — `health` includes retention, so a
mastered-then-decayed topic's health falls and its band falls with it. To make
the ratchet a real property rather than an assumption about how health behaves,
the surfaced level is the **high-water mark over replayed history**:

```
topicLevelHighWater(topic, now) = max over boundaries d of topicLevel(state_asof d, statusOf(d), d)
```

The **boundary set is `{ each event date } ∪ { mastered_at }`**. Event dates
capture health's local maxima (health peaks immediately after an event, since
retention only decays between events). `mastered_at` is unioned in explicitly:
mastery is a status flip that unlocks level 5 but is not guaranteed to fall on an
event date, and under mastered status the level peaks *at* `mastered_at` (health
decays from there). If `mastered_at` always coincides with its triggering event
this is a harmless no-op; if it ever doesn't, omitting it would silently cap the
watermark at 4 — the exact failure the status reconstruction exists to prevent.

**Status must be reconstructed, because it gates the level and is not in
`review_history`.** Two status distinctions affect `topicLevel`: `not_started`
forces 0, and `mastered` unlocks level 5 (non-mastered caps at `MAX_LEVEL − 1`).
Both are recoverable without a stored status timeline: a topic is `not_started`
until its first event; it is treated as `mastered` from `mastered_at` onward
(stored, never cleared — Document 1 §2.3) and non-mastered before then. So
`statusOf(d)` = `not_started` (d < first event) → non-mastered → `mastered`
(d ≥ `mastered_at`). This is what lets the watermark actually reach 5 for a
mastered topic; replaying `review_history` alone would never see the mastery
gate and would wrongly cap the watermark at 4.

Derived, unstored, and monotonic by construction. `levelUps(old, new)` compares
watermarks and can therefore only ever return **non-negative** deltas.

**Never cap level to retention.** A topic mastered in January and decayed by June
shows Level 5 while retention reads 34%. That is not a lie — it is two true
statements: *Level 5 = you got here*; *retention 34% = it's fading*. Shown
adjacent, the tension is the most useful thing on the screen — the "you knew this
once" signal that should drive the due queue. Capping level to retention would
destroy the ratchet and lose that information.

## Level-up detection: at commit time, from the diff

No stored "last level" is needed. `useStore` already commits via clone → mutate →
swap, so both old and new stores are in hand at commit. `levelUps(oldStore,
newStore, now)` returns the topics whose high-water level rose; the committing
route (LogSession / AddExam) fires a toast per increase.

**Only topics touched by the commit are examined.** A watermark is a max over
past states, so the passage of time alone can never raise it — only a topic
receiving an event this commit can level up. `levelUps` restricts to the changed
topics (by `topic_id` diff), which is both cheaper (no full-corpus scan that
grows with the syllabi) and semantically tighter: it makes "level-ups are
evidence-only" structural rather than emergent.

## UI

### Overview header
- **"Retrievable now — 14.2 / 23 topics"** with a 7-day `Sparkline` (reuse the
  existing component) plotting `exp / ceiling`.
- A quiet **"Work logged"** stat cluster beside it: sessions · hours · papers.
- **No global level.** If Overview ever needs something celebratory, use a
  roll-up count of level-ups this week — never a global level banded off EXP
  (that inherits EXP's volatility and forces watermark hacks). If a global level
  is ever wanted, the only honest construction bands off a *validated-topic
  count*, labelled as achievement ("42 topics validated"), not current state.

### TopicDetail
- **Level indicator (0–5) = the high-water mark**, shown **adjacent to
  retention %**: "Lv 5 · retention 34%". Two numbers. The current health band is
  intentionally *not* shown in the headline — it's largely redundant with
  retention (both say "faded"). It may appear in expanded detail only.
- **Level-up toast** (reuse `feedback.tsx`) fires on commit of a session/exam
  when the topic's high-water level increased. Celebration lives where the
  evidence event happens.

## Components & boundaries

New engine module **`src/engine/progress.ts`** (EXP is a distinct concept from
leveling; keeps both files focused):
- `retrievable(store, now) → { exp, ceiling }`
- `expTrend(store, now, days = 7) → { date, ratio, exp, ceiling }[]`
- `workLogged(store) → { sessions, hours, papers }`

Extend **`src/engine/leveling.ts`**:
- `topicLevelHighWater(topic, now) → number`
- `levelUps(oldStore, newStore, now) → { topic, from, to }[]`

Reused as-is: `Sparkline`, `feedback.tsx` toasts, `predictRetention`,
`applyEvent`, `topicLevel`, `health`.

Constants (`CONFIG`): add an EXP trend window (`PROGRESS.TREND_DAYS = 7`). No new
magic numbers inline.

## Invariants (encoded as tests, per the spec-as-tests convention)

1. **EXP decays.** Given ≥1 started topic past `t=0`, `exp` strictly decreases as
   `now` advances with no new events (the "≥1" scope avoids passing trivially on
   an empty store), and `exp` never exceeds `ceiling`.
2. **Most-recent point is live.** `expTrend`'s last point equals live
   `retrievable(store, now)` unconditionally — it is short-circuited to live
   state, so it holds even for imported topics with a non-default `k_factor`.
3. **Ratchet holds.** A mastered-then-decayed topic keeps its high-water level
   (Lv 5) even as `topicLevel` (current band) and retention fall.
4. **Level-ups are evidence-only and non-negative.** A toast fires only when the
   high-water level increases; `levelUps` never returns a negative delta, and a
   pure study review that doesn't cross a band fires nothing.
5. **Work logged is monotonic** across any commit.
6. **Clamp.** No EXP point exceeds `ceiling` even with a backdated/future-dated
   event.

## Out of scope (deliberately)

- Global "Knowledge Level" number.
- "Level-ups this week" Overview roll-up (possible later; not v1).
- Convex (`retention²`) EXP weighting and the 0.4–0.6-band diagnostic badge.
- Any stored/cached progress value.
