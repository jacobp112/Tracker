# Product Specification & User Stories
**Document 4 of 4 — Project: [Working Title] Personal Tracker**
**Status:** Draft v0.4 — E4 re-written against Document 3 v0.3 (mockup re-base); prompts re-issued against Document 1 v0.2 (model sync); auto-repair deferred, app is now fully offline
**Depends on:** Document 1 (Data & Schema), Document 2 (Math & Algorithms), Document 3 (UI & Design System)
**Referenced by:** — (this is the terminal document; it ties the other three into buildable units of work)

**Changelog v0.2:** Document 3 v0.3 adopted `mockups/studyos-notion-apple.html` as the visual source of truth, withdrawing the single-accent palette, the 5-band retention scale, the no-ambient-motion rule, and the per-topic retention heatmap (Document 3 §0.1). **E4-S1 through E4-S4 are re-written accordingly** — the old E4-S2 ("Retention heatmap") and E4-S3 ("List view") could not pass against the approved design and were replaced by "Retention matrix" and "Hero, activity calendar & props row". E1-S1/E1-S2 acceptance criteria now reference Document 3 v0.3 tokens.

**Changelog v0.3:** Document 1 v0.2 synced the Topic schema to the real model (Document 2 v0.2), a sync Document 2 §13 and Document 3 §8 had both flagged as required before build. Ripples into this document:
- **§3.1 (end-of-session prompt)** re-issued: `schema_version` `2.0.0`, `confidence_reported` is now **1–5** (was 0–100), `recall_success` removed. A prompt emitting the old shape would produce JSON that fails validation on arrival — the prompts and the schemas must ship in lockstep.
- **§3.2 (exam prompt)** re-issued: `2.0.0`, adds optional `confidence_reported` (1–5) at exam and breakdown level to feed OCI (Document 2 §5); explicitly forbids the AI asserting pass/fail, which is derived from marks.
- **§13** gains item 7: a flashcard domain is out of v1 scope — `cards` is a count on the Topic, nothing more.
- **E3-S3**'s reference to "quality score, EF update, S update, next-due" describes the withdrawn SM-2 model and is rewritten (§7).
- **E5-S2** unchanged in intent, but "evidence/confidence weights" now means: tests drive drift → `k_factor` (Document 2 §4) and OCI (§5), which is the actual mechanism by which exams outweigh sessions.

---

## 0. Purpose of this document

This document turns the three foundational specs into buildable work. It contains: the remaining AI prompt templates (end-of-session, exam, auto-repair), the global Definition of Ready and Definition of Done that every story inherits, and the full user-story backlog organized by epic. Each story has its own acceptance criteria on top of the global DoD.

**How an implementing agent should use these four documents together:** Document 1 says what the data is. Document 2 says how the numbers are computed. Document 3 says how it looks. Document 4 (this one) says what to build, in what order, and how to know when a piece is actually finished. No story is "done" until it satisfies both its own acceptance criteria and the global Definition of Done in §2.

---

## 1. Global Definition of Ready (DoR)

A story may not be started until **all** of these are true. If any is false, the correct action is to resolve it or flag it — never to start building on an unresolved assumption.

1. The story references the specific section(s) of Documents 1–3 it depends on, and those sections are not marked as open/unresolved.
2. All data shapes the story touches are fully defined in Document 1 (no field is "to be decided").
3. All formulas the story touches are fully defined in Document 2 (no constant is "to be tuned later" in a way that blocks building — tunable ≠ undefined; the default value must exist).
4. All UI the story touches has a layout and token reference in Document 3.
5. Acceptance criteria are written and testable (a human or test can objectively pass/fail them).
6. Any external dependency (AI completion endpoint, chart library choice) is named and available.

## 2. Global Definition of Done (DoD)

A story is done only when **all** of these are true, in addition to its own acceptance criteria:

1. Implements the referenced Document 1–3 sections exactly; any necessary deviation is documented and the source doc updated *first*.
2. All data written conforms to the Document 1 schemas and passes validation (§ Document 1 §6).
3. All math matches Document 2 exactly, verified against the worked example (Document 2 §8) where applicable.
4. UI matches Document 3 tokens and layout; uses shared components (Document 3 §3), not one-off variants.
5. Responsive to 360px, keyboard-accessible, `prefers-reduced-motion` respected, WCAG AA contrast — the accessibility floor (Document 3 §6) is met, not deferred.
6. Empty, loading, and error states all exist and follow the voice rules (Document 3 §7).
7. Unit tests cover the math/validation logic; the Document 2 §8 worked example is encoded as a test case.
8. No hardcoded magic numbers — constants come from the config object (Document 2 §1).
9. No silent failures — every failure path surfaces a plain-English message, never a console-only error or a partial write.

---

## 3. Remaining AI prompt templates

### 3.1 End-of-session prompt (produces the Study Session object, Document 1 §3)

Displayed with a "Copy prompt" button in the log-session flow. The user pastes it into their AI at session end.

> You are logging a completed study session into a tracker. Output **only** valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.
>
> Schema (v2.0.0), Study Session:
> - Root: `{schema_version, session_id, course_id, date, duration_minutes, topics_covered[]}`
> - `schema_version`: `"2.0.0"`. `session_id`: `session_` + 10 random alphanumeric chars. `date`: ISO 8601 UTC now. `course_id`: [APP INSERTS THE ACTIVE COURSE ID HERE].
> - Each `topics_covered[]` entry: `{topic_id, confidence_reported, notes, errors[]}`
>   - `topic_id`: must be one of the topic IDs from the course below.
>   - `confidence_reported`: integer **1–5** (1 = could not recall it, 3 = shaky but getting there, 5 = fluent and confident). This is **not** a percentage — 80 is invalid.
>   - `notes`: short freetext, ≤ 500 chars, optional.
>   - `errors[]`: for each mistake, `{error_type, description}` where `error_type` is one of `conceptual` | `procedural` | `careless` | `knowledge_gap`. Empty array if none.
>
> Only include topics actually covered this session. Be honest with confidence — inflated numbers corrupt the learner's review schedule.
>
> Course topics (id → title): [APP INSERTS TOPIC LIST]
> Session transcript / summary: [LEARNER OR AI PASTES SESSION CONTENT]

### 3.2 Exam entry prompt (produces the Exam object, Document 1 §4)

> You are converting exam/test results into JSON for a study tracker. Output **only** valid JSON matching this exact schema — no fences, no commentary, no extra fields.
>
> Schema (v2.0.0), Exam:
> - Root: `{schema_version, exam_id, title, date, linked_topic_ids[], score, max_score, confidence_reported, breakdown[]}`
> - `schema_version`: `"2.0.0"`. `exam_id`: `exam_` + 10 random alphanumeric chars.
> - `linked_topic_ids`: every topic this exam tested — may span multiple courses.
> - `confidence_reported`: integer **1–5**, how confident the learner felt sitting it (not a percentage). Optional, but without it this exam contributes nothing to calibration.
> - `breakdown[]` (include if you can attribute marks to topics): each `{topic_id, points_earned, points_possible, confidence_reported, errors[]}`, errors as `{error_type, description}`. Per-topic `confidence_reported` is optional and overrides the exam-level value.
> - If you cannot break marks down by topic, omit `breakdown` — the tracker will apply the overall score to all linked topics.
> - Do **not** report whether a topic passed or failed; the tracker derives that from the marks.
>
> Available topics across all courses (id → title): [APP INSERTS FULL TOPIC LIST]
> Exam details: [USER PASTES SCORES / MARKED PAPER]

### 3.3 Auto-repair prompt (Document 1 §6.2)

Sent programmatically (not shown to user) when validation fails and the user opts into repair.

> The following JSON failed validation against a schema. Return **only** the corrected JSON — no commentary, no fences. Fix only what's needed to pass validation; do not invent data that isn't derivable from the original. If a required value genuinely cannot be recovered, use the schema's specified default.
>
> Schema: [APP INSERTS SCHEMA]
> Validation errors: [APP INSERTS ERROR LIST]
> Original JSON: [APP INSERTS ORIGINAL]

**Repair guardrail:** repaired output re-runs full validation (Document 1 §6.1 steps 1–3). If it fails twice, stop auto-repairing and return the user to manual correction — never loop indefinitely.

### 3.4 Fitness prompts (produces the Running / Lifting objects, Document 1 §5)

*(Added v0.4 — the v0.1–v0.3 prompt set omitted fitness, but E6 ingests running and lifting objects through the same E2 pipeline, which needs a copy-prompt to honour the zero-setup premise. These fill that gap; they emit Document 1 v0.2 §5 shapes.)*

**Running:**
> You are logging a run into a tracker. Output **only** valid JSON matching this schema — no fences, no commentary, no extra fields.
> `{schema_version: "2.0.0", activity_id: "activity_" + 10 random alphanumeric, date: "YYYY-MM-DD", distance_km: number, duration_seconds: integer, type: one of "easy"|"tempo"|"long"|"interval"|"race", notes: optional string}`
> Do **not** include `pace_sec_per_km` — the tracker computes it from distance and duration.
> Run details: [USER PASTES RUN]

**Lifting:**
> You are logging a lifting session. Output **only** valid JSON matching this schema — no fences, no commentary, no extra fields.
> `{schema_version: "2.0.0", session_id: "session_" + 10 random alphanumeric, date: "YYYY-MM-DD", exercises: [{exercise_name, sets: [{set_number, reps, weight_kg, rpe?}]}]}`
> Weights are in **kg**. `rpe` (1–10) is optional. Keep each set as its own entry — do not collapse to a total.
> Session details: [USER PASTES WORKOUT]

---

## 4. Epic breakdown & build order

Epics are ordered so each builds only on completed work. Rough dependency chain:

```
E1 Foundation & Design System
        │
E2 Ingestion & Validation ──────┐
        │                       │
E3 Study Engine (math)          │
        │                       │
E4 Study Dashboard ◄────────────┘
        │
E5 Exams
        │
E6 Fitness   (independent of E3–E5, can run parallel after E2)
        │
E7 Overview & Cross-domain
        │
E8 Settings, Export/Import, Polish
```

---

## 5. Epic E1 — Foundation & Design System

**Goal:** the token system, shared components, navigation shell, and theming exist before any feature is built on top of them.

### E1-S1 — Design tokens implemented
As a developer, I want all Document 3 v0.3 §2 tokens available as themeable variables so no feature hardcodes a color, size, or duration.
**DoR add:** Document 3 v0.3 §2 finalized.
**Acceptance criteria:**
- All color, type, spacing, radius, elevation, and motion tokens from Document 3 §2 exist as named variables — including `--edge`/`--edge-strong`, the page washes, the two accents, both data scales (§2.2a traffic light, §2.2b blue ramp), and `--ease`/`--spring`.
- Light and dark themes both defined; switching theme swaps every token with no visual gaps.
- Theme resolves **before first paint** from `localStorage` with a `prefers-color-scheme` fallback — no FOUC (Document 3 §2.3).
- A visible "token sheet" dev route renders every token for QA.

### E1-S2 — Shared component library
As a developer, I want the Document 3 §3 primitives built once so screens compose them.
**Acceptance criteria:**
- Card, hero stat, delta chip, props row, retention row, segmented control, status pill, health chip, diagnostic badge, calibration indicator, activity calendar, progress ring, data table, timeline/plan item, sheet/modal, empty state, toast, and paste-and-validate input all exist and render from tokens.
- Each has a dev-route showcase with all its states (default/hover/active/disabled/loading/empty/error).
- Card carries `--shadow-card` **and** the `inset 0 1px 0 var(--edge)` top highlight (Document 3 §3 — not optional).
- Retention row correctly maps a 0–100 input to the §2.2(a) stop, and always renders the number in text alongside the colour.

### E1-S3 — App shell & navigation
As a user, I want to move between domains via a sidebar (desktop) or bottom tabs (mobile).
**Acceptance criteria:**
- Sidebar per Document 3 §4 on ≥768px; bottom tab bar below 768px; transform happens cleanly at the breakpoint.
- Domains expand to list courses/activities.
- "Add tracker" and "Settings" reachable from the shell.
- Keyboard-navigable; focus visible throughout.

---

## 6. Epic E2 — Ingestion & Validation

**Goal:** the paste → validate → integrity-check → preview → commit pipeline works for any schema, before any specific domain uses it.

### E2-S1 — JSON parse & schema validation
As a user, when I paste JSON, I want it checked against the correct schema so bad data never enters my tracker.
**DoR add:** Document 1 §2–6 finalized; a JSON Schema validator chosen.
**Acceptance criteria:**
- Parses input; on parse failure shows the raw error location, does not proceed.
- Validates against the relevant schema (course / session / exam / fitness), collecting *all* errors not just the first (Document 1 §6.1).
- `additionalProperties: false` enforced — hallucinated fields fail validation.
- Encodes at least the Document 1 §6 rules as tests.

### E2-S2 — Referential integrity check
As a user, I want references to non-existent topics/courses caught, so an exam can't link to a topic I don't have.
**Acceptance criteria:**
- Every `*_id` / `*_ids[]` reference resolved against the current store (Document 1 §1.6).
- Dangling references reported as errors with the offending id and field path.

### E2-S3 — Plain-English error translation
As a user, I want validation errors in language I understand, not raw schema output (Document 3 §5.6 rule).
**Acceptance criteria:**
- Each raw validation error maps to a human sentence naming the field by its user-facing label and stating the fix.
- Example parity: a confidence-out-of-range error reads exactly "Topic 'Chain rule' has a confidence of 105 — confidence is a 1–5 rating, not a percentage." *(Updated in v0.3: Document 1 v0.2 §1.3a made confidence a 1–5 scale, so the v0.1 wording "it can't be above 100" now teaches the wrong thing — 100 is not the bound, and a percentage is not the unit.)*
- Structural Ajv noise (`if`/`allOf`/`not` wrappers) is never surfaced; only the underlying cause is.
- JSON generated against the **withdrawn v0.1 model** is the likeliest bad paste, so stale fields (`ease_factor`, `memory_strength`, `next_review_due`, `recall_success`) are named explicitly and the user is told to re-generate with the current prompt.

### E2-S4 — Preview & commit
As a user, I want to see what will be added before it's committed, so nothing enters silently.
**Acceptance criteria:**
- On successful validation, a preview summarizes the object (e.g. "3 sections, 14 topics") before a confirm action.
- Commit is atomic — partial writes impossible; a failure mid-commit rolls back.
- Success toast uses the action's verb (Document 3 §7).

### E2-S5 — Auto-repair path — **DEFERRED (not in v1)**
As a user, when my JSON is broken, I want an optional one-tap fix rather than re-prompting from scratch.
**DoR add:** an AI completion endpoint available; §3.3 prompt finalized.

**Status:** deferred by product decision — no built-in AI is being implemented at this time. The DoR was never satisfiable: no AI completion endpoint exists, and the app makes no network calls.

**Consequence — this is a net simplification, and worth stating plainly:** auto-repair was the *only* in-app AI call (§13.6). Without it **the app makes no network requests at all** and is fully offline-capable and local-first. That is a stronger position than the original design, not a weaker one — the user's own AI does the generating, and the tracker only ever validates.

**What replaces it:** the manual correction path, which already exists and is not a fallback but the whole story — E2-S3's plain-English errors name the field, state the fix, and (for the likeliest failure, JSON generated against the withdrawn v0.1 model) tell the user to re-generate with the current prompt. A user who can read "Topic 'Chain rule' has a confidence of 105 — confidence is a 1–5 rating, not a percentage" does not need a repair button.

**If it is ever picked up**, the §3.3 prompt and its two-attempt guardrail stand as written, and the repaired JSON must be validated exactly as strictly as fresh input (Document 1 §6.2). Nothing in E2-S1…S4 needs to change to accommodate it — `ingest()` is already the single entry point a repair loop would call.

---

## 7. Epic E3 — Study Engine (math core)

**Goal:** the recalculation algorithm exists as a pure, tested module before any dashboard reads from it. This epic ships no UI.

### E3-S1 — Constants config
As a developer, I want every Document 2 §1 constant in one config object so the math is tunable without code changes.
**Acceptance criteria:**
- All §1 constants present with their default values, named, in one place.
- No constant appears as an inline literal anywhere in the engine.

### E3-S2 — Retention function
As a developer, I want `R(t) = e^(−t/(k·s))` implemented so any surface can query a topic's live retention.
**Acceptance criteria:**
- Given `last_reviewed`, `strength` and `k_factor`, returns current retention against `now` (Document 2 §2).
- Returns **undefined** (not a number) for `last_reviewed == null` or `status == not_started` — the UI shows "—", never 0%.
- `t ≤ 0` (reviewed today) → `1.0`. `s ≤ 0` → `0.0`.
- Projected due date per Document 2 §2.1; undefined when retention is undefined, and reported as *overdue* rather than a past date.

### E3-S3 — Recalculation on a logged event
As a developer, I want one recalculation path so sessions, exams, and manual reviews all update state identically.
**DoR add:** Document 2 v0.2.1 §3–5 finalized; Document 1 v0.2 Topic shape (`strength`, `k_factor`, `drift_history`, `conf`, `cards`).
**Acceptance criteria:**
- One code path, parameterized by the event's `kind` — no duplicated per-source implementations.
- Applies the §3 strength increment for the event's `kind`/confidence; stamps `last_reviewed`; appends to `review_history`.
- On a test event: pushes drift per §4.1 (capped at `DRIFT_WINDOW`), and tunes `k_factor` per §4.2 **only** once `DRIFT_MIN` samples exist, clamped to `[K_MIN, K_MAX]`, persisted at 2 dp, and only when changed by more than `0.001`.
- `strength` only ever grows; `review_history` and `drift_history` are append-only; existing entries never mutated.
- Does **not** write `status` (learner-set, Document 2 §7) except the one automatic rule: first promotion out of `not_started` seeds `strength` to `1.0` and stamps `last_reviewed`.
- **The Document 2 §12 worked example is encoded as a passing test** — retention, OCI, health, badges, and the §4.2 tuning step, every intermediate value matched.

### E3-S4 — Live derivation on load
As a user, I want a topic's retention and health to reflect decay even on days I don't open it.
**Acceptance criteria:**
- Retention, health, OCI, badges, due-ness and projected due date are **computed on every load**, never read from storage (Document 1 v0.2 §2.3).
- A topic can become due purely from elapsed time, with no event.
- The math never demotes `status` (Document 2 §7) — decay is expressed as falling retention/health only.

### E3-S5 — Health, calibration, badges, weak ranking, velocity, projection
As a developer, I want the derived metrics available for the dashboard.
**Acceptance criteria:**
- Health per §6 — the five weighted sub-scores, rounded; `calibrationScore` is 100 when the topic has no tests.
- OCI per §5; topics with no tests have `OCI = 0` by definition.
- Badges per §8, each firing on exactly its stated condition.
- Weak ranking per §9: lowest health first, tie-broken by lowest retention, excluding `not_started` and `mastered`.
- Velocity per §10 with the **<2-mastered undefined guard**.
- Projection per §10 as a **range**; returns explicit "Not enough data yet" / "Course complete" states instead of `Infinity` or a divide-by-zero date.
- Due queue per §11: lowest retention first, with section spreading over the top N.

---

## 8. Epic E4 — Study Dashboard

**Goal:** surface the engine (E3) through the primary study screens (Document 3 §5.2–5.3).

### E4-S1 — Course dashboard shell
**Acceptance criteria:** breadcrumb (Courses › [title]); 32px page title + subtitle; "Start review" primary action in the topbar; layout per Document 3 §5.2 (hero + activity row → props row → retention matrix → review plan), single column, collapsing per §2.5 breakpoints.

### E4-S2 — Retention matrix
As a user, I want to see every topic's live retention grouped by section so decay is visible at a glance.
**DoR add:** Document 3 v0.3 §5.2 (this story was re-written when the per-topic heatmap was withdrawn — see Document 3 §0.1 item 6).
**Acceptance criteria:**
- Topics grouped by section under uppercase group labels, one card per group, one retention row per topic (Document 3 §3).
- Each row: status dot + title + optional diagnostic badge; bar track + `%` in tabular mono + hover/focus-revealed "Review →".
- Bar, dot, and number all encode `R_now`, colored via the §2.2(a) 3-stop scale. Not-started renders `—`, never `0%`.
- Values computed fresh on load (reads E3-S2/S4) — a topic changes band between visits with no event.
- **The `%` is always present in text** — a colour-only row fails this story (Document 3 §6).
- Rows are keyboard-focusable and the "Review →" action is reachable without a pointer.

### E4-S3 — Hero, activity calendar & props row
**Acceptance criteria:**
- Hero: avg-retention figure + delta chip + interactive sparkline (goal line, hover crosshair with value+date readout, draw-on, count-up) per Document 3 §5.2.
- Activity calendar: 90 days on the §2.2(b) blue ramp; each cell exposes date + session count; Less→More legend + month labels.
- Props row: Health / Calibration / Due review / Projected finish in one 4-column card, values in tabular mono, collapsing 4→2 under 920px.
- All motion gated on `prefers-reduced-motion` (Document 3 §2.6): reveals forced visible, bars jump to final width, count-up prints final value, pulses off.

### E4-S4 — Projection & review plan
**Acceptance criteria:** projection shown as a **range** with its window caption, or the explicit "Not enough data yet" state (E3-S5) — never a fabricated or infinite date; upcoming review plan renders as a timeline with the next item badged and live-pulsed; ordering honours the weak-topic rule (lowest health, tie-broken by lowest retention — Document 2 §9) with unresolved-error counts and badges shown so the list explains *why*.

### E4-S5 — Topic detail with retention curve
As a user, I want to open a topic and see its retention curve, history, and errors.
**Acceptance criteria:**
- Opens as sheet (mobile) / side panel (desktop) per Document 3 §5.3.
- Retention curve draws the Ebbinghaus decay with review events as recovery points and a dashed line at `R_THRESHOLD`; "now" marker on the current point. Draw-on animation respects reduced-motion.
- Review history and error log render as data tables; error entries have working resolve toggles that write back to `error_log`.

### E4-S6 — Log session flow
As a user, I want to log a finished session by pasting AI JSON.
**Acceptance criteria:** uses E2 pipeline with the §3.1 prompt (copy button, active course id injected); on commit, triggers E3-S3 recalculation for each covered topic; dashboard reflects updated colors/status without a manual refresh.

---

## 9. Epic E5 — Exams

### E5-S1 — Add exam result flow
**Acceptance criteria:** uses E2 pipeline with the §3.2 prompt; full cross-course topic list injected; supports both breakdown-present and uniform-fallback exams.

### E5-S2 — Exam recalculation
As a user, I want an exam to update every linked topic with appropriate weight.
**Acceptance criteria:**
- Derives per-topic inputs per Document 2 §4.1 (breakdown) or §4.2 (fallback), then runs E3-S3 with exam evidence/confidence weights.
- Wrong answers become `error_log` entries on the right topics.
- Each linked topic recalculates against its own prior state (identical inputs can produce different results).

### E5-S3 — Exams screen
**Acceptance criteria:** per Document 3 §5.4 — exam cards show cross-topic reach grouped by parent course, per-topic effect (boosted/flagged) legible, error-type chips use the neutral categorical palette.

---

## 10. Epic E6 — Fitness

Independent of the study engine; can run in parallel once E2 exists.

### E6-S1 — Running log & trends
**Acceptance criteria:** running objects validated (Document 1 §5.1) with `pace_sec_per_km` computed on ingestion, not user-supplied; list + pace/distance trend chart filterable by run `type`.

### E6-S2 — Lifting log & progression
**Acceptance criteria:** lifting objects validated (Document 1 §5.2) with sets-as-array; per-exercise weight-over-time chart using per-set data (top-set or est-1RM, not flat total); kg/lb display toggle with storage staying kg.

---

## 11. Epic E7 — Overview & Cross-domain

### E7-S1 — Overview screen
**Acceptance criteria:** per Document 3 §5.1 — "due for review" aggregates review-due topics across *all* courses sorted most-decayed first (section spreading, Document 2 §11); streak / weekly-volume / **overall-mastery** stat tiles *(v0.4: next-exam withdrawn — exams are completed results, not scheduled events; see Document 3 §5.1)*; a hero course-health ring across all courses; unified recent-activity feed spanning sessions, exams, runs, lifts (the visible event-sourcing model), newest first.

---

## 12. Epic E8 — Settings, Export/Import & Polish

### E8-S1 — Full data export/import
As a user, I want to export everything as JSON and re-import it, since my data is JSON to begin with.
**Acceptance criteria:** export produces a single valid JSON bundle of all domains; import runs the full E2 pipeline; round-trip (export then import into empty state) reproduces identical state.

### E8-S2 — Theme & unit preferences
**Acceptance criteria:** light/dark toggle persists; kg/lb default persists; changes apply app-wide immediately.

### E8-S3 — Reduced-motion & a11y audit pass
**Acceptance criteria:** full pass against Document 3 §6 across every shipped screen; documented checklist.

---

## 13. Explicitly out of scope for v1 (do not build early)

These are recorded so they aren't silently pulled forward — a recurring failure mode where an agent "helpfully" builds unrequested scope.

1. **Savings-effect decay model** (Document 2 §3.5) — relearned-material slower-decay. No formula defined; v2.
2. **Course amendment flow** — editing a syllabus's structure after creation (Document 1 §6.3). v1 creates a course once.
3. **Fitness decay/readiness modeling** — fitness has no math engine in v1 (Document 2), only trends.
4. **Multi-user / sync / accounts** — v1 is single-user local-first unless a later document says otherwise.
5. **Native mobile apps** — v1 is a responsive web app; iOS *aesthetic*, not a native iOS build.
6. **In-app AI calls — all of them.** *(Widened in v0.4.)* The app never teaches; it ingests JSON the user's own AI produced. v0.1–v0.3 carved out one exception, auto-repair (E2-S5); that is now deferred too, so **the app makes no AI calls and no network requests of any kind**. It is fully offline-capable. Any proposal to add a network call is a scope change against this document.
7. **A flashcard domain** — Document 2 §6 (`cardScore`) and §8 ("Under-carded") only ever read a *count*, so Document 1 v0.2 stores `cards` as an integer on the Topic. Card objects, decks, and review scheduling for cards are **not** v1. The mockup's sidebar shows a "Flashcards" sub-item; that is aspirational chrome, not v1 scope.

Any request touching these mid-build should be raised as a scope change against this document, not absorbed.

---

## 14. Document set summary

| Doc | Owns | Must not drift from |
|---|---|---|
| 1 — Data & Schema | every JSON shape, ingestion pipeline, versioning | — |
| 2 — Math & Algorithms | all formulas, constants, the recalculation path | Doc 1's Topic shape |
| 3 — UI & Design System | tokens, components, screen layouts, voice | Docs 1 & 2 (shows their data/math) |
| 4 — Product (this) | prompts, DoR/DoD, user stories, build order, scope | Docs 1–3 (implements them) |

The four are consistent as of v0.1. Any change to a lower-numbered doc must be checked against the higher-numbered ones before build.
