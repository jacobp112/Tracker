# Cairn / Tracker — Learning-System Architecture (design)

**Status:** design only — nothing in this document is implemented. It is the architecture/design phase deliverable for `docs/superpowers/UPGRADE.md`, grounded in the current codebase at schema `3.2.0` and in the current-state report at `docs/superpowers/system-architecture.md`.

**Objective (the one thing this system must be good at):**

> Given everything this learner has done and everything we know about their current state, what is the highest-value thing they should do next?

Everything below is judged against that. If a proposed entity or field does not eventually feed that decision, it does not earn its place.

---

## 0. Reading of the current architecture (what we are extending)

The design must respect what already exists, so this is the shared baseline. All of it was re-verified against the source and is consistent with the current-state report.

### 0.1 The storage substrate is a *hybrid* event log, not pure event-sourcing

Each `Topic` (`src/domain/types.ts`) embeds **its own** append-only log:

```
Topic {
  review_history: ReviewEvent[]   // the log
  error_log: ErrorLogEntry[]      // occurrence log
  // materialized, engine-maintained:
  strength, k_factor, conf, last_reviewed, status, mastered_at, drift_history
}
```

* `applyEvent` (`engine/recalculate.ts`) is the **single recalculation path**. It appends the event *and* advances the materialized fields. `mergeInto` (`core/merge.ts`) is the only caller for pasted data; `useStore` is the only caller for in-app actions (`logManualReview`, `promoteTopic`, `toggleError`). Nothing appends to `review_history` by hand.
* `replayEvents` / `topicStateAsOf` (`engine/replay.ts`) prove the materialized fields are reconstructable forward from a genesis. The v3.1.0 migration (`core/migrations.ts`) uses exactly this to rebuild `k_factor`/`drift_history` after changing a rule — the pattern for any future correction.
* **Everything else is derived live, never stored**: retention (`engine/retention.ts`), health/OCI/badges (`engine/metrics.ts`), performance metrics (`engine/performance.ts`), prerequisite diagnostics (`engine/prerequisites.ts`), levels (`engine/leveling.ts`), course rollups (`engine/course.ts`, `engine/overview.ts`). This is the single most important property to preserve: **derivation over storage** is what keeps the model honest and migration-cheap ("nothing stored can go stale").

### 0.2 The `Exam` is a *result*, and its default behaviour is a smear

`Exam` (`types.ts`) is `{score, max_score, linked_topic_ids, breakdown?}`. On merge (`mergeExam`):

* With `breakdown[]` → one `test` event per topic from that topic's own marks (un-smeared, drives k-tuning).
* Without `breakdown[]` → the aggregate `score/max_score` is applied to **every** linked topic, stamped `smeared:true`, `fanout:N`. Smeared events are excluded from k-tuning (`applyEvent` guards on `!event.smeared`) and dampened in the lapse fold (`engine/stability.ts`).

This is precisely the "smear the score uniformly" behaviour UPGRADE.md wants to supersede. The infrastructure to prefer per-topic evidence (`breakdown`, `smeared`, `fanout`) already exists — we are going to feed it much better data.

### 0.3 `AssessmentEvidence` and the read-side-only invariant

`AssessmentEvidence` (`types.ts`, schema in `domain/schemas.ts`) is a rich, fully-optional per-event metadata block: `difficulty, novelty, independence, transfer_level, performance_quality, quality_rationale, cold, predicted_success, predicted_at, assessed_by`. Two invariants are load-bearing and must be carried forward:

1. **Read-side-only** — it is read *only* by the Performance layer and never feeds retention/health/levels/mastery (`performance.ts` header, `§A`). This keeps the "core" honest math immune to tutor-supplied qualitative claims.
2. **Never zero-filled** — a missing dimension stays `undefined`; every headline metric returns `null` below a `MIN_*_N` guard rather than a false zero (`mean`, `weightedComposite`, `MIN_INDEPENDENT_N` etc.).

### 0.4 The ingestion pipeline and its guarantees

`ingest()` → parse → `validateAgainst` (Ajv 2020-12, `additionalProperties:false` everywhere) → `checkIntegrity` (referential; every `_id` must resolve) → `buildPreview` → `commit` (mutates a `structuredClone`, adopts only on success). `detectSchema` auto-routes by a unique discriminator key. This preview→confirm→atomic-commit spine is reused verbatim for every new ingestion shape below.

### 0.5 The tutor loop already exists in embryo

`engine/session.ts` already builds a **curated** tutor briefing (`buildSessionContext` → `startSessionPrompt`) whose blocks are gated by `intent` × `scope`, and requests structured JSON back at the end (`sessionWrapUpPrompt`). Session setup writes a `FocusDraft` to a separate localStorage key (`cairn-focus-session`) with no store mutation; the store is only mutated at the import/commit step. `SessionRecord` records intent/scope/timer *after* the fact (a metadata side-channel; the study evidence itself lives as per-topic `ReviewEvent`s). So "Tutor Context" (§15) and "Tutor Output" (§16) are formalizations/extensions of existing seams, not green-field.

### 0.6 What is genuinely missing (the gap this design fills)

* No **assessment definition** — only results. No questions, no mark schemes, no attempts.
* No **question-level evidence** — hence the smear.
* Error model is a bare `resolved: boolean` with no recurrence identity, no severity, no verification.
* No **session plan** (intent-before), only the after-record; and the entire tutoring transcript is currently not captured — the app only sees the timer.
* No **recommendation** or **readiness** engine — the "what next?" question is unanswered.
* Storage is a single localStorage key — fine for compact topic logs, a problem for paper/mark-scheme documents.

---

## A. Target architecture

**Principle:** the application maintains learner state and makes deterministic, explainable decisions from evidence. The external AI teaches, interprets documents, and produces *structured observations*. It is never the source of truth for learner state. (This is already the de-facto rule — `duration_minutes` is never trusted from the AI, `testKind`/`actual_retention` are derived from marks not AI claims, `AssessmentEvidence` is read-side-only. We make it the explicit organising principle.)

The system grows a new **Assessment domain** and three new **derivation engines**, arranged so the existing substrate is extended, not replaced:

```
                    EXTERNAL AI (teaching + document interpretation + observation)
                          │ curated TutorContext ▲          │ structured JSON ▼
                          ▼                       │          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ INGESTION SPINE (unchanged): parse → Ajv → integrity → preview → atomic commit │
└──────────────────────────────────────────────────────────────────────────────┘
        │ course/session/exam (today)        │ assessment-def / attempt-result / session-outcome (new)
        ▼                                     ▼
┌───────────────────────────┐        ┌──────────────────────────────────────────────┐
│ STUDY SUBSTRATE (localStorage)     │ ASSESSMENT DOMAIN (IndexedDB)                  │
│  courses[] → sections → topics     │  assessments[]  (definitions: questions,       │
│    • review_history: ReviewEvent[] │    mark schemes, provenance)                   │
│    • error occurrences             │  attempts[]     (sittings + question marks)    │
│  exams[] (legacy aggregate)        │  errorPatterns[] (recurrence identity)         │
│  sessions[] (records) + plans[]    │                                                │
└───────────────────────────┘        └──────────────────────────────────────────────┘
        │  decompose (the KEY move)            │
        └──────────────►  a marked attempt emits precise, un-smeared ReviewEvents
                          (one per question→topic mapping) into the topic logs
        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ DERIVATION LAYER (pure, live, never stored)                                    │
│  existing: retention · health · performance · prerequisites · levels · course  │
│  new:      error-intelligence · recommendation · readiness                     │
└──────────────────────────────────────────────────────────────────────────────┘
        ▼
   DASHBOARD: "What should I do next?"
```

**The single most important architectural decision:** *question-level assessment is a richer **source** of the same `ReviewEvent`s, not a parallel truth.* When a learner marks a past paper, each question's marks land on its mapped topic(s) as a normal `test` event — precise and **un-smeared**, so it drives k-tuning through the existing path — carrying `AssessmentEvidence` derived from the paper's difficulty and the sitting conditions. The Assessment domain additionally stores the *navigable document* (questions + mark schemes) so the learner can revisit it. Consequences:

* The entire derived-metrics engine (`retention`, `health`, `performance`, `course`, `overview`) keeps working with **zero change** — it still reads `topic.review_history`.
* The smear disappears **wherever question-level evidence exists**; legacy aggregate exams keep smearing (correctly — we must not invent granularity they never had, §24).
* The new engines (error/recommendation/readiness) are pure reducers over the same substrate, matching the derived-live philosophy.

---

## B. Domain model

New entities. For each, per UPGRADE.md §1: *decision enabled · evidence · owner · persisted/derived · staleness*.

### New persisted entities (Assessment domain, IndexedDB)

**`AssessmentDefinition`** — the thing to sit.
* *Decision:* enables readiness ("ready for AQA Paper 1?"), gives questions a home, is the reusable template for repeat attempts.
* *Evidence:* AI ingestion of past-paper + mark-scheme documents, or AI generation, or a diagnostic template.
* *Owner:* application (validated + stored); AI proposes the structure.
* *Persisted.* Definitions are immutable once confirmed (a new paper = a new definition), matching the "course created once" rule (`checkCourse`).
* *Staleness:* effectively never — a past paper is historically fixed. Topic *mappings* inside it can go stale if topics are deleted; integrity re-checks on read.

**`Question`** (owned by a definition) — first-class question/subpart. See §F.

**`MarkScheme` / `MarkCriterion`** (owned by a question) — see §E.

**`AssessmentAttempt`** — one sitting + its marking. Doubles as the "result" (see §C).
* *Decision:* is *the* strong evidence unit — its question marks become the un-smeared ReviewEvents; its sitting conditions set evidence tier; its aggregate feeds readiness/recommendation.
* *Evidence:* the learner self-marks against the stored mark scheme; sitting conditions are learner-recorded, never inferred.
* *Owner:* application.
* *Persisted.* Append-only; a re-sit is a new attempt.
* *Staleness:* an attempt is a historical fact — never stale. Its *interpretation* (how much it counts) is derived and can change as the learner improves; that's correct.

**`ErrorPattern`** — recurrence identity for errors. See §I.
* *Decision:* "same conceptual error twice" — the single most-cited driver of high-urgency remediation in UPGRADE.md.
* *Evidence:* AI proposes a signature at observation time; the app validates/dedupes; the learner can merge/split.
* *Owner:* application (identity + lifecycle); AI proposes membership.
* *Persisted* (small). Occurrences remain in each topic's `error_log`; the pattern is the grouping key + lifecycle state.
* *Staleness:* lifecycle state (`verification_pending`) is derived from evidence dates, so it self-heals; the pattern record itself doesn't go stale.

### New persisted entities (Study substrate, localStorage — additive)

**`SessionPlan`** — intent-before. See §G.
* *Decision:* turns a recommendation into a concrete tutor briefing; lets the app later check "did the session achieve what it set out to?".
* *Evidence:* generated from a `Recommendation`.
* *Owner:* application.
* *Persisted* only for the *active/next* plan (a tiny set). History is reconstructable from `SessionRecord` + events, so we do not accumulate plans.
* *Staleness:* a plan goes stale the moment state changes; it is short-lived and regenerated, so we never trust an old one.

### New derived (never persisted) objects

**`Recommendation`**, **`ReadinessReport`**, **`ErrorUrgency`**, **`EvidenceProfile`**, **`TutorContext`**. All computed live from the substrate + assessment domain, exactly like `health`/`badges`/`prerequisiteInstability` today. Persisting them would create the staleness class the current architecture deliberately avoids. The one exception: a per-recommendation `snoozed_until` / `dismissed` flag (user intent, not derivable) may be persisted as a thin overlay keyed by recommendation identity.

### Additive fields on existing entities

* `ReviewEvent.provenance?: AssessmentProvenance` and `ReviewEvent.assessment_ref?: {assessment_id, attempt_id, question_id}` — links an event back to the question that produced it (nullable; legacy events have none). Enables "which question produced this evidence" without duplicating marks.
* `ErrorLogEntry.pattern_id?: string`, `ErrorLogEntry.severity?: ErrorSeverity`, and a richer `status` replacing bare `resolved` (kept back-compatible; see §I).
* `Topic.prerequisites?` already exists and is reused as-is.

**Rejected additions:** a global flat `events[]` table (the per-topic embedding works and cross-cutting reads already exist via `allTopics`); per-recommendation persistence (derive instead); learning objectives as a mandatory layer (see §9 → kept optional).

---

## C. Assessment model: definition → attempt → result

The conceptual distinction (§2) is real and we honour it. The question is how many *persisted* entities it costs.

**Options**
1. Three entities: Definition, Attempt, Result.
2. Two: Definition + Attempt (attempt carries the result inline).
3. One: a fat "assessment" blob.

**Recommendation: two persisted entities — `AssessmentDefinition` and `AssessmentAttempt` — with the *result* being a derived aggregate over the attempt's question marks.**

* The **result** is not an independent fact: it is entirely a function of the attempt's `QuestionResult[]` (marks awarded) + the definition's marks-available. Storing it separately invites drift (the exact bug the "single recalculation path" avoids). So: `AssessmentResult` is a **derived view** (`buildAttemptResult(attempt, definition)`), computed like `buildExamView` is today. Nothing to keep in sync.
* Definition and attempt *are* separate facts with different lifetimes (one definition, many sittings; a past paper is reusable), so they stay separate.

```
AssessmentDefinition 1 ──── * AssessmentAttempt
        │                          │
        ▼                          ▼
   Question[]  (+ MarkScheme)   QuestionResult[]  (marks awarded, per question)
        │                          │
        └── topic_mappings ───► decompose into per-topic ReviewEvents (un-smeared)
                                   + derived AttemptResult (aggregate %, per-topic %, evidence tier)
```

This mirrors the existing exam path (`Exam` stored; `ExamView` derived) but with the granularity moved down to the question. Legacy `Exam` remains a valid, coarser member of the same conceptual family (it is a definition+attempt+result collapsed into one aggregate row).

---

## D. Past-paper ingestion model

The HARD REQUIREMENT workflow (§3), realised on the existing ingestion spine. Two AI round-trips (ingest the paper; later report the marking), both through paste→validate→preview→commit.

### D.1 Lifecycle

```
1. Learner has: past-paper doc  +  mark-scheme doc
2. Cairn provides: `pastPaperIngestPrompt(store)` — a carefully constructed prompt (like coursePrompt/examPrompt)
     • injects the cross-course topic list (id → title) for mapping
     • instructs the AI to output an AssessmentDefinition JSON: structure, questions, subparts,
       marks, mark-scheme criteria, PROPOSED topic mappings, difficulty, provenance:"past_paper"
     • forbids markdown fences / extra fields (additionalProperties:false will reject them)
3. External AI reads both docs → emits AssessmentDefinition JSON
4. Learner pastes JSON into Cairn
5. Cairn: detectSchema → 'assessment_def' → Ajv validate → integrity:
     • every proposed topic_id must resolve (reuses checkIntegrity's rule)
     • marks reconcile: Σ question marks == paper max; subpart marks == parent marks
     • preview: "AQA Mathematics Paper 1 — 12 questions, 75 marks, 9 topics mapped (2 unmapped)"
6. Learner confirms (may correct topic mappings first — see §H)
7. Cairn stores the AssessmentDefinition (IndexedDB) + a compact reference in the study store
8. Cairn presents the assessment / instructs the learner to sit the physical paper
9. Learner sits the paper (records sitting conditions: timed? closed-book? cold? — §19)
10. Learner returns → Cairn presents the mark scheme question-by-question (self-marking UX, §7)
11. Learner self-marks → Cairn stores QuestionResult[] on a new AssessmentAttempt
12. Cairn maps performance → questions → criteria → topics → errors → evidence:
     • per topic, aggregate the marks of its mapped questions → ONE un-smeared `test` ReviewEvent
     • attach AssessmentEvidence (difficulty from the question, cold/independence from sitting conditions)
     • create ErrorLogEntry occurrences for flagged mistakes, linked to ErrorPatterns
13. Learner state updates through the existing single recalculation path (applyEvent)
```

Steps 5, 12, 13 reuse existing machinery (`ingest`, `mergeInto`→`applyEvent`, `resolveExamAssessment`). Only the schema, the prompt, and the marking UI are new.

### D.2 Why question-level evidence supersedes the smear

At step 12, a question mapped to a single topic contributes exactly its marks to that topic — no fan-out, no smear. `smeared` is `false`, so the event **does** self-tune `k_factor` (the mechanism by which real assessments outweigh study reviews). A question spanning topics splits by weight (§H). The result: the same `ReviewEvent` shape the engine already consumes, but sourced from ground truth instead of an aggregate guess.

---

## E. Mark-scheme model (subject-general)

The mark scheme must represent maths *and* essay subjects. The unifying abstraction: a question's mark scheme is a list of **criteria**, each worth marks, and criteria come in a small set of **kinds** that cover both "one mark per line" and "banded rubric".

```
MarkScheme {
  question_id
  total_marks
  criteria: MarkCriterion[]
  guidance?: string            // human-readable overall marking notes
}

MarkCriterion {
  criterion_id
  marks: number                // marks this criterion is worth
  kind: 'point' | 'method' | 'accuracy' | 'follow_through'
      | 'rubric_band' | 'quality' | 'alternative'
  label: string                // short: "M1", "AO2 band 3", "identifies cause"
  descriptor: string           // human-readable: what earns it
  conditions?: string          // "only if M1 awarded", "cao", "ft from (a)"
  alternatives?: string[]      // acceptable alternative answers
  band?: { level: number; min_marks: number; max_marks: number }  // rubric only
}
```

**Design decisions**

* **Structural vs human-readable.** Store *structurally*: marks, kind, band ranges, criterion identity (these drive the auto-total, the per-criterion award UI, and analytics). Keep *human-readable*: `descriptor`, `conditions`, `alternatives`, `guidance` (these are for the learner's judgement — the app does not attempt to auto-adjudicate "is this answer acceptable?", the learner does). This split is the same philosophy as `quality_rationale` (stored prose the app never parses).
* **Maths marks** (M/A/B/follow-through) → `kind: 'method' | 'accuracy' | 'point' | 'follow_through'` with discrete `marks` and `conditions`.
* **Essay/rubric subjects** (English, History, Economics extended answers) → `kind: 'rubric_band'` with a `band` range. Marking = the learner picks a band and a mark within it, guided by `descriptor`. One question can carry several `rubric_band` criteria (e.g. AO1/AO2/AO3 assessed separately).
* **Alternatives / conditions** are first-class but human-adjudicated. The app surfaces them at marking time; it never silently accepts or rejects.
* **Not maths-centric:** the model has no notion of "one mark per line". A criterion is an abstract unit of credit; discrete points and rubric bands are two kinds of it.

`awardable(criterion)` and the auto-total are pure functions over this structure — analogous to `effectOf`/`buildExamView`.

---

## F. Question model and topic mapping

Minimum viable question (§5), no more:

```
Question {
  question_id
  assessment_id
  label: string                 // "3", "3(b)", "3(b)(ii)" — human ordering
  parent_question_id?: string   // subpart tree
  order: number
  marks_available: number
  stem_ref?: string             // SHORT reference/prompt, NOT the full paper text (see §O)
  topic_mappings: TopicMapping[]
  mark_scheme: MarkScheme
  difficulty?: Difficulty        // reuses the 0–5 scale from AssessmentEvidence
  learning_objective_ids?: string[]   // optional; see §9
  provenance: AssessmentProvenance     // inherited from the definition
}

TopicMapping {
  topic_id
  role: 'primary' | 'secondary'
  weight: number                // 0–1; primary defaults high; Σ weights == 1 per question
  proposed_by: 'ai' | 'user'
  confirmed: boolean            // AI proposals must be confirmed before they weight evidence
}
```

**Fields deliberately omitted:** IRT parameters, discrimination indices, per-question response text storage (see §O). Difficulty is the tutor's 0–5 ordinal we already model — good enough to inform readiness/recommendation without an academic psychometric layer.

**Topic mapping is validated, never blindly trusted (§8):**

* AI proposes `topic_mappings`; integrity validates every `topic_id` resolves; **unconfirmed** mappings are shown but do **not** weight evidence until the learner confirms (they can bulk-confirm at preview). This is the "AI proposes, app validates, user corrects" pattern.
* Multiple topics per question are supported via `role` + `weight`.
* A question with no confident mapping is allowed to stay **unmapped** — its marks then contribute to the assessment aggregate but produce **no** per-topic event (explicit unknown over invented attribution — §24's rule applied at the question grain).

**How marks contribute when a question spans topics (§8):**

* **Rejected:** uniform smear (the current failure). **Rejected:** duplicating full marks onto every topic (double-counts mastery).
* **Chosen:** *weighted attribution.* Each mapped topic receives `weight × marks_earned` out of `weight × marks_available`. Per topic, sum across all its mapped questions in the attempt → one `test` event with `score/out_of` = those weighted sums. This is `smeared:false` (real per-topic evidence), so it drives k-tuning. A single-topic question (the common case) degenerates to exact attribution.

---

## G. Session model: plan → teaching → evidence → outcome

Today `SessionRecord` is *after-only* (intent/scope exist, but as a post-hoc label). We add the *before*.

```
Recommendation ─► SessionPlan ─► TutorContext ─► (AI teaches) ─► SessionOutcome JSON
                                                                        │
                                                          decompose → ReviewEvents + error occurrences
                                                                        │
                                                          Evaluation (did the plan's expected evidence arrive?)
                                                                        ▼
                                                          Updated learner state ─► next Recommendation
```

**`SessionPlan`** (persist only the active one):

```
SessionPlan {
  plan_id
  created_at
  from_recommendation_id?
  intent: SessionIntent          // reuse existing 'remediate'|'retention'|'new_content'|'adaptive'
  scope: SessionScope            // reuse existing
  target_topic_ids: string[]
  target_pattern_ids?: string[]  // error patterns to clean up
  reason: string                 // human-readable, from the recommendation
  expected_evidence: ExpectedEvidence   // what would count as success (e.g. "≥1 independent success on topic_x")
  prerequisite_topic_ids?: string[]
  assessment_prep_id?: string    // if this session is prepping for an assessment
  est_duration_minutes: number
}
```

Only fields that enable a decision are included. `expected_evidence` is the one genuinely new idea: it lets the post-session **Evaluation** step ask "did we get what we came for?" deterministically, rather than trusting the AI's self-report. `SessionPlan` feeds `buildSessionContext` (which already gates blocks by intent×scope) — we extend that function to also surface target error patterns and assessment context. It is written at session *setup* alongside the existing `FocusDraft`, so the plan and the timer share a lifecycle.

`SessionRecord` (after) is unchanged except for an optional `plan_id` back-link.

---

## H. Learner evidence model (the evidence hierarchy)

UPGRADE.md §17/§19 want a principled hierarchy, not multipliers. We already have the raw dimensions (`cold`, `independence`, `difficulty`, `novelty`, `transfer_level`) and the `MIN_*_N` "null over false-zero" discipline. We formalise them into an ordered **evidence tier** per event, derived (never stored):

```
tier(event) =
  6  past_paper, cold, timed, closed-book, independent (independence==3)   // gold benchmark
  5  independent cold retrieval (any source)
  4  independent practice (independence==3, not cold)
  3  lightly-assisted practice (independence==2)
  2  guided practice (independence 0–1)
  1  study review (no assessment metadata)
  0  smeared / provenance-unverifiable                                     // counted, but never certifies
```

**How tiers are used (no arbitrary multiplier):**

* They **gate**, not scale. Readiness (§K) and "verified resolution" (§I) require evidence *at or above a tier*, with a minimum count — reusing the existing `MIN_INDEPENDENT_N`, `MIN_COLD_N` pattern. "80% on an AI practice test" and "80% on a cold past paper" differ because they land in different tiers and only the higher tier satisfies the *benchmark* gate; both still contribute their `ReviewEvent` to strength/retention (that math is provenance-blind by design, and should stay that way).
* Provenance (`past_paper` vs `ai_generated` vs `diagnostic` vs `custom`) is a *component* of tier, combined with sitting conditions — so an AI-generated test sat cold and independently is still decent formative evidence, and a past paper revised with the mark scheme open is **not** benchmark evidence. This directly encodes the §19 distinction.
* `diagnostic` provenance is flagged so breadth-sampling assessments are read as *coverage* signals, not *mastery* signals (a diagnostic that samples one question per topic must not be treated as having assessed mastery).

This slots into the existing Performance layer as a small addition (`evidenceTier(event)` in `engine/performance.ts`), consumed by the new engines. Nothing about the core retention/health math changes.

---

## I. Error model: detection → urgency → remediation → verification

The current `resolved: boolean` (`ErrorLogEntry`) is the weakest link. Three additions: **recurrence identity**, **a real lifecycle**, and **derived urgency**.

### I.1 Recurrence identity — `ErrorPattern`

```
ErrorPattern {
  pattern_id
  signature: string          // stable key AI proposes ("sign-error-when-multiplying-negatives")
  error_type: ErrorType      // reuse conceptual|procedural|careless|knowledge_gap
  topic_ids: string[]        // where it shows up
  severity: ErrorSeverity    // intrinsic damage — see I.3
  status: ErrorStatus        // lifecycle — see I.2
  occurrence_ids: string[]   // links to ErrorLogEntry instances across topics
  first_seen, last_seen
}
```

Each `ErrorLogEntry` gains `pattern_id?`. The AI proposes a `signature` when it observes an error (Tutor Output, §M); the app matches it to an existing pattern (fuzzy match surfaced for confirmation) or opens a new one. **Recurrence** = a pattern with ≥2 occurrences — the exact signal UPGRADE.md keeps citing ("same conceptual error in two recent attempts"). The learner can merge/split patterns (identity stays app-owned).

### I.2 Lifecycle (replaces the boolean)

```
detected → active → remediation_attempted → verification_pending → verified_resolved
                                                        │
                                                        └── regressed (a fresh occurrence reopens it)
```

* `resolved: boolean` is **kept** for back-compat and maps to a distinct, weaker state: `learner_marked_resolved`. This is deliberately **not** the same as `verified_resolved`. The system surfaces the difference (§14): "you marked this fixed" vs "the system has evidence this is fixed".
* Transition to `verification_pending` happens when remediation is attempted (a `remediate` session targeting the pattern, or a corrected occurrence).
* Transition to `verified_resolved` is **evidence-gated** and *derived*, not toggled: a later success on the pattern's topic(s), at evidence **tier ≥ 4** (independent) — ideally **tier ≥ 5** (cold) for high-severity patterns — dated after the remediation, with no newer occurrence. One clean cold/independent success is sufficient for low severity; high-severity patterns require the success to be on a genuinely independent or cold item (we do **not** demand the full menu of six evidence types — that would make resolution unreachable).
* `regressed` reopens automatically when a new occurrence lands after `verified_resolved`.

Because the status is derived from occurrence + event dates, it **self-heals** and never goes stale — consistent with the derive-don't-store philosophy.

### I.3 Severity vs urgency (they are different)

* **Severity** = *intrinsic, slow-moving damage* of the error. A conceptual error in a foundational topic is high severity regardless of when it happened. Proposed by the AI (it understands the misconception), stored on the pattern, editable. Roughly: `error_type` (conceptual/knowledge_gap > procedural > careless) combined with the **foundationality** of its topic (how many downstream topics list it as a prerequisite — computed from the existing `prerequisites` graph via `upstreamPrerequisites` inverted).
* **Urgency** = *when to act*, a **derived, time-varying** classification. It is NOT age (explicitly, §13). Inputs, combined as **interpretable rules** (not a single weighted score):

```
CRITICAL  → severity high AND (recurrence ≥2 OR foundational-and-blocking active downstream work)
HIGH      → recurrence ≥2, OR severity high AND assessment within ~1 week,
            OR underlying topic retention decaying below DUE_THRESHOLD (about to be forgotten)
MEDIUM    → single occurrence, moderate severity, no imminent assessment
LOW       → careless/low-severity single occurrence, or verification_pending awaiting a natural review
```

and a **temporal band** derived from the same inputs: `TODAY` (critical / imminent assessment), `WITHIN 48H` (recurring or decaying), `THIS WEEK` (medium), `NEXT REVIEW CYCLE` (low / piggyback on the topic's projected due date from `projectedDue`).

The rules are ordered and short-circuit (like the recommendation cascade, §J), so every urgency verdict is explainable by naming the rule that fired and the evidence behind it. `resolution_confidence` (how strong the verification evidence is) *lowers* urgency; `consequence` (does this pattern cause downstream errors — inferred from co-occurrence on shared topics) *raises* it.

---

## J. Recommendation engine — "what should I do next?"

**A hierarchical, interpretable decision cascade — not a weighted score** (§11 explicit). Pure and derived, computed live over the substrate like `badges`/`weakTopics`/`prerequisiteInstability` already are.

```
recommend(store, assessments, now) → Recommendation[]   // ranked, each self-explaining
```

The cascade evaluates ordered guards; each that fires emits a `Recommendation`; results are ranked by urgency then value. Guards (reusing existing engines named in brackets):

```
1. UNRESOLVED CRITICAL ERROR?            → Remediate pattern            [error urgency §I]
2. FOUNDATIONAL PREREQUISITE UNSTABLE?   → Prerequisite remediation     [prerequisiteInstability]
3. VERIFICATION PENDING + due a check?   → Retrieval to verify a fix    [error lifecycle §I]
4. RECENTLY LEARNED, NOT YET VERIFIED?   → Independent/cold retrieval   [status + evidenceTier §H]
5. DUE FOR REVIEW (R < DUE_THRESHOLD)?   → Review                       [isDue / dueQueue]
6. SUFFICIENT PRACTICE + STABLE RETENTION + no critical errors?
                                         → Sit topic/broader assessment [readiness §K]
7. ASSESSMENT PASSED with tier-≥5 evidence?
                                         → Progress / next topic        [attempt result + tier]
8. ASSESSMENT FAILED?                    → Diagnose → remediate → reassess
9. else                                  → Continue learning / new content
```

```
Recommendation {
  action: 'remediate' | 'practise' | 'review' | 'retrieve' | 'assess' | 'progress' | 'learn'
  target: { kind: 'topic'|'pattern'|'assessment'|'section'; id: string; title: string }
  reason: string                 // evidence-grounded sentence (§20)
  evidence: EvidenceRef[]        // the concrete facts that triggered it (event ids, pattern ids, metrics)
  priority: 'critical'|'high'|'medium'|'low'
  recommended_when: 'today'|'within_48h'|'this_week'|'next_cycle'
  est_duration_minutes: number
}
```

**Derived, not stored** (§12): recommendations are recomputed every render, so they can never be stale — the same reason retention/health aren't stored. The only persisted overlay is user intent the system can't derive: `dismissed` / `snoozed_until`, keyed by a stable recommendation identity (action+target). Each recommendation carries its `evidence[]` so the UI can always answer "why?" (§20) without re-deriving.

---

## K. Readiness engine

Explainable, multi-signal, **never a single percentage threshold** (§18). A `ReadinessReport` is a checklist of criteria, each `pass | fail | unknown` with the evidence and the gap.

```
assessReadiness(target, store, assessments, now) → ReadinessReport

ReadinessReport {
  target                       // an AssessmentDefinition, or a topic-set (e.g. a section)
  verdict: 'ready' | 'not_ready' | 'insufficient_evidence'
  criteria: ReadinessCriterion[]
  blocking: ReadinessCriterion[]   // the subset that must be cleared
}

ReadinessCriterion {
  id: 'coverage'|'prerequisites'|'recent_retrieval'|'cold_performance'
    |'independent_performance'|'no_critical_errors'|'retention'|'calibration'|'assessment_history'
  state: 'pass'|'fail'|'unknown'
  detail: string               // "3 of 12 topics never practised independently"
  evidence: EvidenceRef[]
}
```

Criteria (each maps to an existing derivation):

* **Coverage** — every target topic at least `practising` (`topic.status`), unmapped questions flagged.
* **Prerequisites** — `prerequisiteInstability` reports zero unstable ancestors.
* **Recent retrieval** — target topics reviewed within their projected-due window (`projectedDue`).
* **Cold / independent performance** — `coldPerformance` / `independentPerformance` defined (i.e. `MIN_COLD_N`/`MIN_INDEPENDENT_N` met) and above threshold. If `null` (not enough data) → `unknown`, which yields `insufficient_evidence`, **not** `not_ready` (honest about absence).
* **No unresolved high-severity errors** — no CRITICAL/HIGH error patterns on target topics (§I).
* **Retention** — mean live retention across targets above a band (`averageRetention`).
* **Calibration** — `calibrationError`/OCI within tolerance (the learner's self-assessment is trustworthy).
* **Provenance-aware bar (§19):** certifying readiness for a **past-paper benchmark** requires evidence at **tier ≥ 5** (cold/independent); readiness for a **formative AI assessment** accepts tier ≥ 3. A past paper "passed" with the mark scheme open never satisfies the benchmark criterion.

The verdict is the AND of blocking criteria, but the **report** always shows the full checklist, so the learner sees *why* ("you're not ready: 2 prerequisites are unstable and you have no independent evidence yet"), never an opaque number.

---

## L. Tutor Context (what the app sends the AI)

Formalises and extends `buildSessionContext`. Generated by the app from a `SessionPlan`; the AI receives a **curated snapshot**, never the database.

**Include** (only what the current teaching task needs):
* Current objective + reason for session (from the plan).
* Target topics: title, `status`, live retention, surfaced health — the derived, presentational values (never raw `strength`/`k_factor`/`drift_history`).
* Relevant unresolved error **patterns** (signature + type + a corrected example), not the whole `error_log`.
* Recent evidence summary for the targets (last few outcomes, independence/cold flags) — not the raw event log.
* Known misconceptions (high-severity patterns on the targets).
* Prerequisites + their stability flags (`prerequisiteInstability`), so the tutor can shore up foundations.
* Expected outcome / `expected_evidence` (so the tutor knows what "done" looks like).
* Assessment context (if prepping): the target assessment's topics and the readiness gaps.
* Recommended teaching strategy (the `intentConfig` instructions/avoid already do this).

**Exclude** (explicitly):
* Raw `review_history`, `error_log`, other courses' data, internal engine internals (`k_factor`, `strength`, `drift_history`, `smeared`, `fanout`), IDs the tutor has no use for, anything about assessments the learner hasn't started.
* The output JSON schema at *briefing* time — the current code deliberately withholds it so the model teaches instead of dumping a log (`startSessionPrompt` comment); we keep that.

The invariant: the app is the source of truth; the tutor gets a read-only, minimal, presentation-level snapshot.

---

## M. Tutor Output (what the AI returns)

A new Ajv-validated ingestion schema (`session_outcome`), `additionalProperties:false`, extending today's `session` shape. Everything is an **observation**; the app decides its effect (the read-side-only invariant, generalised).

```
SessionOutcome {
  schema_version, session_id, course_id, date, duration_minutes(=0, app is timekeeper)
  topics_covered: [{
    topic_id, confidence_reported,
    assessment?: AssessmentEvidence,        // reuse existing rubric verbatim
    concepts_demonstrated?: string[],
    errors?: [{ error_type, description, proposed_signature?, proposed_severity? }],  // pattern hints
    questions?: [{ ref, marks_earned?, marks_available?, outcome }],   // if practice Qs were used
    evidence_of_understanding?: string,
    uncertainty?: string                    // the AI flags what it is unsure about
  }]
  suggested_follow_up?: string
}
```

**How observations map to state (app-owned):**
* `confidence_reported` + `assessment` → a `ReviewEvent` through `applyEvent` (unchanged path). `assessment` stays read-side-only.
* `errors[].proposed_signature/severity` → *proposals*; the app matches to `ErrorPattern`s (surfacing fuzzy matches for confirmation) and sets severity, but the learner can override. The AI never directly writes a pattern's lifecycle.
* `duration_minutes` ignored (app measures it — existing rule).
* `uncertainty` is surfaced to the learner and *lowers* the evidence weight of that topic's outcome, rather than being silently trusted.

Critically, the AI cannot mark an error `verified_resolved`, cannot set `status`, cannot move mastery. It reports; the app derives.

---

## N. Dashboard / UX

A single **"What should I do next?"** surface driven by the recommendation engine, replacing statistic-dumping as the primary view.

```
NEXT ACTION                 (top Recommendation)
  Remediate: Quadratic inequalities
  Why: same conceptual sign-error in your last two attempts; prerequisite "factorising" retention 58%
  Priority: HIGH · Recommended: TODAY · ~25 min           [Start session ▶]

THEN                        (next 2–3 recommendations)
  Review: Trig identities — due tomorrow · ~15 min
  Retrieve (verify fix): Integration by parts · ~10 min

UPCOMING ASSESSMENTS        (readiness meters, provenance-aware)
  AQA Paper 1 (past paper) — Readiness: not ready (2 prerequisites unstable) — see why
  Topic test: Vectors — ready ✓

ATTENTION                   (compact, collapsible)
  • 1 critical error awaiting remediation
  • 2 fixes awaiting verification
  • 3 overdue reviews
  • 1 topic ready to progress
```

Rules to avoid clutter (§21):
* The recommendation engine already ranks — show the **top** action prominently, the next few smaller, everything else collapsed.
* Every item is **explainable inline** (its `reason` + a "see why" that lists `evidence[]`).
* Readiness shows a *verdict + top blocker*, not a raw %.
* Self-marking UI (§7) is a focused, single-task flow: question · marks available · mark-scheme criteria · award control · optional error tag · running total. Topic mapping / error classification / notes are one tap away, not on the primary surface. The task is "mark my paper accurately and quickly."

The existing Overview/CourseDashboard become secondary "browse the numbers" views; the derived engines that feed them (`overview.ts`, `course.ts`) are unchanged.

---

## O. Storage architecture

**Analysis (§23):** the study substrate is compact (topic logs are small ordinal events) and localStorage is fine for it — it already handles courses/exams/sessions. But `AssessmentDefinition`s carry many questions, mark-scheme prose, and per-attempt marking records. A few past papers could exceed the ~5 MB localStorage budget, and — critically — loading that blob on every render would tax the hot path (every derivation re-reads the whole store today).

**Options**
1. Everything in the one localStorage key (status quo). *Rejected:* quota + hot-path cost.
2. A backend. *Rejected:* the app is intentionally local-first (§22/§23); no conventional backend for its own sake (Firebase is auth-only today, and stays that way).
3. **Split local storage: study substrate in localStorage, assessment domain in IndexedDB.** *Chosen.*

**Recommendation:**
* Keep the study store (`courses`, `exams`, `sessions`, `session_plans`, `error_patterns`) in localStorage under `studyos-store` — small, synchronous, hot.
* Move the assessment domain (`assessments` definitions + `attempts` with question text and marking records) to **IndexedDB**, keyed by `assessment_id` / `attempt_id`, loaded on demand (opening an assessment, marking, computing readiness for a specific target).
* In the study store keep only **compact references**: `{assessment_id, title, provenance, topic_ids, max_marks}` plus the **decomposed ReviewEvents** (which already live in topic logs). So the hot path — retention/health/recommendations for the dashboard — never touches IndexedDB; it reads the events as today.
* **Document text:** store the *structured* question metadata + mark-scheme criteria (needed to navigate and self-mark), and a **short `stem_ref`**, not the full verbatim paper prose. Rationale: size, and copyright caution for past papers. The learner can navigate the assessment and mark scheme from the structured form even if the original AI chat is gone (§5 requirement), without warehousing full exam text. If a learner wants the full text, it's optional and lives in IndexedDB, never in the hot store.
* **Backup/restore + migrations** (existing strengths, §22) are extended to cover both stores: export bundles localStorage + an IndexedDB dump; import restores both atomically. This is the one place the current single-key simplicity genuinely grows, and it is contained behind the `core/storage.ts` module (`loadStore`/`saveStore` gain async assessment-domain siblings; the study path stays synchronous).

---

## P. Migration strategy (3.2.0 data survives)

**Never invent historical evidence (§24).** Concretely:

* **Old exams with only `82%`** stay `Exam` rows producing **smeared** events. They are *not* retrofitted into questions or attempts. They remain valid, coarse, tier-0 evidence — exactly what they always were. `buildExamView` keeps rendering them.
* **Exam results without definitions** — the legacy `Exam` *is* the collapsed definition+attempt+result; no back-fill.
* **Sessions without plans** — remain plan-less `SessionRecord`s (`plan_id` absent). We do not fabricate a retrospective plan.
* **Errors without recurrence identity** — remain occurrences with `pattern_id` absent and `signature` **unknown**. We do **not** auto-cluster old errors into patterns (that would be inventing recurrence). New errors get patterns; old ones can be *manually* linked by the learner if they choose.
* **Review events without question evidence** — keep `provenance`/`assessment_ref` absent. They stay whatever tier their existing `smeared`/`assessment` fields imply.

Migration mechanics reuse the existing forward-only, additive `migrate()` (`core/storage.ts`) and the replay-based data migration pattern (`core/migrations.ts`):
* Additive fields (`ErrorLogEntry.pattern_id?`, `ReviewEvent.provenance?`) need no data touch — they're optional and absent on legacy rows.
* The IndexedDB store starts empty; there is nothing to migrate into it (no historical assessments existed).
* The one rule enforced everywhere: **explicitly unknown beats inferred.** `null`/absent is a first-class value the whole codebase already respects (`predictRetention` returns `null`, `MIN_*_N` guards return `null`).

---

## Q. Schema / version strategy

Current: `3.2.0` (single localStorage key, additive migrations).

**Recommended progression — two conceptual versions so the storage split lands separately from the additive logic:**

* **`3.3.0` (additive, localStorage-only, backward-compatible).** New optional fields + small collections that don't need IndexedDB:
  * `ErrorPattern[]` collection + `ErrorLogEntry.pattern_id?/severity?/status?` (keeping `resolved` as `learner_marked_resolved`).
  * `SessionPlan` (active-only) + `SessionRecord.plan_id?`.
  * `ReviewEvent.provenance?` + `assessment_ref?`.
  * New engines that are pure over existing data: error-intelligence, recommendation, readiness (readiness/recommendation degrade gracefully with no assessments yet).
  * Old stores load unchanged (missing optionals are absent). No data migration required.

* **`4.0.0` (assessment domain + storage split).** The major version, because it introduces IndexedDB and a new top-level domain:
  * `AssessmentDefinition` / `Question` / `MarkScheme` / `AssessmentAttempt` in IndexedDB.
  * New ingestion schemas: `assessment_def`, `attempt_result`, `session_outcome` (all Ajv `additionalProperties:false`, all through the existing pipeline, all detected by a unique discriminator key à la `detectSchema`).
  * The un-smeared question→topic decomposition path (a richer sibling of `mergeExam`, emitting `smeared:false` per-topic events with weighted attribution).
  * Backup/restore spans both stores.
  * **Backward compatibility:** `loadStore` still reads any `≤4.0.0` study store; a store with no assessment domain is valid (empty IndexedDB). The version guard (`parsed.schema_version > SCHEMA_VERSION` → refuse) is unchanged.

Why not one big `4.0.0`? Because `3.3.0` delivers the error-intelligence + recommendation + readiness engines — the actual "what next?" payload — on data we already have, before taking on the IndexedDB/assessment complexity. It de-risks the "most important" objective and lets the past-paper work land as an independent, testable increment.

---

## Implementation phases

Chosen to make each phase independently shippable and to front-load the objective ("what next?"). Ordering respects dependencies: evidence model before the engines that read it, engines before the UI that surfaces them, storage split only when assessment documents demand it.

```
Phase 1 — Evidence tier + error identity (schema 3.3.0, additive)
  evidenceTier(event); ErrorPattern + lifecycle fields; provenance on events.
  Pure, localStorage-only. Migrations: none (additive optionals).

Phase 2 — Error intelligence engine
  severity vs urgency (derived), verification lifecycle, urgency classification.
  Reuses prerequisites graph for foundationality.

Phase 3 — Recommendation engine (the core objective)
  hierarchical cascade over existing derivations; self-explaining Recommendations.
  Dashboard "What should I do next?" v1 (works before any assessment exists).

Phase 4 — Readiness engine
  explainable checklist over coverage/prereqs/retrieval/cold-independent/errors/retention/calibration.

Phase 5 — Session planning
  SessionPlan (intent-before) + expected_evidence + post-session Evaluation;
  extend buildSessionContext/TutorContext; session_outcome tutor-output schema.

Phase 6 — Assessment domain + storage split (schema 4.0.0)
  IndexedDB; AssessmentDefinition/Question/MarkScheme; backup/restore spanning both stores.

Phase 7 — Past-paper ingestion
  pastPaperIngestPrompt; assessment_def schema + integrity (mark reconciliation, topic-map validation);
  preview → confirm → store definition.

Phase 8 — Sitting + self-marking + question-level evidence
  sitting-conditions capture; question-by-question marking UX; QuestionResult[];
  weighted question→topic decomposition into un-smeared ReviewEvents.

Phase 9 — Assessment-aware recommendation/readiness
  provenance/tier-gated readiness for real assessments; assess/progress/reassess cascade branches.

Phase 10 — Migration hardening + dashboard polish
  legacy-data audits ("never invent history" tests), quota handling for IndexedDB,
  dashboard clutter rules, verification-of-fix loop end-to-end.
```

---

## Competing options, resolved (summary)

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Question-level truth | parallel truth vs richer event source | **richer source** of same `ReviewEvent`s | derivation engine unchanged; smear removed only where evidence exists |
| Result entity | 3 entities vs 2 vs 1 | **2** (definition + attempt; result derived) | result is a function of marks — deriving avoids drift (single-path principle) |
| Provenance weighting | multipliers vs tiers-as-gates | **evidence tiers gate**, don't scale | matches "null over false-zero"; no arbitrary numbers; §19 distinction is structural |
| Multi-topic marks | uniform smear vs duplicate vs weighted | **weighted attribution** | precise, drives k-tuning, degenerates to exact for single-topic Qs |
| Error resolution | boolean vs evidence-gated lifecycle | **derived lifecycle**, `resolved`=weak signal kept | distinguishes "marked" from "verified"; self-heals |
| Recommendations | weighted score vs cascade | **interpretable cascade**, derived | explainable (§20); never stale |
| Storage | one key vs backend vs split | **localStorage + IndexedDB split** | keeps hot path fast + local-first; quarantines large docs |
| Learning objectives | mandatory layer vs optional | **optional** (`learning_objective_ids?`) | topics+questions+errors+evidence already suffice for recommendations; add only if mapping/diagnosis demonstrably improves (§9) |
| Versioning | one 4.0.0 vs 3.3.0 then 4.0.0 | **two steps** | ships the "what next?" objective on existing data first; de-risks IndexedDB |

## On learning objectives (§9) — the deliberate "no, unless"

Kept **optional** (`Question.learning_objective_ids?`, no LO entity in the core path). The recommendation and readiness engines are designed to run on **topics + questions + errors + evidence** alone, which is sufficient for the target decisions. LOs earn a first-class entity only if a concrete need appears — e.g. a mark-scheme criterion that must map to something finer than a topic, or error diagnosis that repeatedly needs sub-topic granularity. The field is reserved so introducing them later is additive, not a migration. This honours "do not introduce learning objectives simply because they sound useful."

---

*End of design. No code has been modified. Recommended next step: review this document, then begin Phase 1 (schema 3.3.0, additive) behind the existing preview→confirm→atomic-commit spine.*
