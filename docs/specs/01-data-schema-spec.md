# Data & Schema Specification
**Document 1 of 4 — Project: [Working Title] Personal Tracker**
**Status:** Draft v0.2.1 — Topic schema synced to the real model (Document 2 v0.2); `mastered_at` added (§2.3)
**Depends on:** Nothing (this is the foundational document)
**Referenced by:** Math & Algorithms Spec, UI Spec, Product Spec / User Stories

---

## 0. Purpose of this document

This document is the single source of truth for every data shape in the system. No field, enum, or ID format may be invented at build time — if it's not defined here, it does not exist yet, and the correct action is to flag it, not improvise it.

All schemas are written as **JSON Schema (2020-12 dialect)**. All domain objects carry a `schema_version` field so the app can validate and migrate data safely as the schemas evolve.

### 0.1 Changelog — v0.2 (model sync)

Document 2 v0.2 withdrew the Ebbinghaus + SM-2 model in full and declared itself authoritative: *"Any reference in another document to `ease_factor`, `memory_strength`, or 'SM-2' is stale and should be read as `strength` / `kFactor` / this document."* Both Document 2 §13 and Document 3 §8 flagged this sync as **required before build**. This is that sync. v0.1 and the real model disagreed on **six** load-bearing points, not just the two field names:

| # | v0.1 said | Document 2 v0.2 needs | Resolution |
|---|---|---|---|
| 1 | `memory_strength`, `ease_factor` on Topic | `strength`, `kFactor`, `driftHistory[]`, `conf`, `cards` | **Doc 2 wins.** §2.3 rewritten; withdrawn fields deleted. |
| 2 | confidence is an integer **0–100** (§1.3, "enforced everywhere") | confidence is **1–5** — every formula divides by 5 (`OCI`, `confidenceScore`, strength increments, badges) | **Doc 2 wins.** Its math is unimplementable on a 0–100 scale without inventing a rescale that no document specifies. §1.3 is amended: *percentages* stay 0–100, *confidence* is 1–5. |
| 3 | status `not_started \| in_progress \| review_due \| mastered` | the four-state ladder `Not Started → Learning → Practising → Mastered` (§7) | **Doc 2 wins.** `in_progress`/`review_due` are withdrawn. `review_due` in particular was a *derived* state in the old model; in the real model due-ness is computed live from `R < DUE_THRESHOLD` and is never stored. |
| 4 | ReviewEvent `source: session \| exam \| manual_review` | strength increments key off `test-pass` / `test-fail` / study-review-with-confidence (§3) | **Both, kept orthogonal.** These describe different things: *provenance* vs *what the event was*. Conflating them loses information (a test can arrive from a session). §2.4 now carries `source` (provenance) **and** `kind` (what the math reads). |
| 5 | `next_review_due` "computed by the engine" | *no next-due formula exists* — it belonged to the withdrawn SM-2 model | **Dropped from storage.** Retaining a field no formula can populate would guarantee stale data. Due-ness is live (`R < DUE_THRESHOLD`). The dates Document 3 §5.2's review plan shows are *projected*, via the new Document 2 §2.1 — derived from the existing curve, not a new model. |
| 6 | no test/exam evidence on ReviewEvent | tests carry `score`, `outOf`, `confidence`, and an observed `actualRetention` to drive drift (§4.1) and OCI (§5) | **Doc 2 wins.** §2.4 gains an optional `test` block, required when `kind` is a test. |

**Naming:** Document 2 writes model fields in camelCase (`kFactor`, `driftHistory`). This document's §1 convention is snake_case, and the AI ingestion prompts emit snake_case. **Storage stays snake_case**; Document 2's names map 1:1 (`kFactor` → `k_factor`, `driftHistory` → `drift_history`, `reviewHistory` → `review_history`, `reviewed` → `last_reviewed`, `outOf` → `out_of`, `actualRetention` → `actual_retention`). No translation layer — the TypeScript domain types mirror storage exactly.

**Scope note:** `cards` is stored as a **count**, not a flashcard domain. Document 2 only ever reads `cardCount` (§6 `cardScore`, §8 "Under-carded"). A real flashcard object model is **not** in v1 and is added to Document 4 §13's out-of-scope list.

**Migration:** this is a breaking change to the Topic shape, so it is a **major** bump under §7 — `1.0.0` → `2.0.0`. No migration function ships: no user data exists yet (v1 is unreleased, single-user, local-first). If that stops being true before release, §7's migration rule applies and this note must be replaced with a real `v1 → v2` migration.

---

## 1. Core conventions (apply to every schema in this document)

1. **IDs**: all `*_id` fields are strings, format `{prefix}_{ulid}` (e.g. `topic_01J8Z...`). Prefixes: `course_`, `section_`, `topic_`, `session_`, `exam_`, `error_`, `activity_`(fitness), `set_`.
2. **Dates/times**: all timestamps are ISO 8601, UTC, e.g. `2026-07-16T14:32:00Z`. Date-only fields (no time component) use `YYYY-MM-DD`.
3. **Percentages**: integers 0–100, not floats, not 0–1. Enforced everywhere for consistency.
3a. **Confidence**: integer **1–5** (see §0.1 item 2). This is a *different scale from percentages* and the distinction is load-bearing — every Document 2 formula that touches confidence divides by 5. A confidence of `80` is not "80%", it is invalid. Retention and health remain 0–100 percentages.
4. **Every top-level object requires `schema_version`** (semver string, e.g. `"1.0.0"`). See §7 for migration policy.
5. **Unknown fields**: schemas use `"additionalProperties": false`. Any AI-generated JSON with extra/hallucinated fields fails validation rather than silently being accepted — see §6 (Validation & Auto-Repair).
6. **Referential integrity**: any field ending in `_id` or `_ids[]` that references another object (e.g. a `topic_id` inside an exam) must resolve to an object that actually exists in the user's data store. Dangling references are a validation error, not a warning.
7. **Enums are closed sets.** No freetext status fields. This is what keeps the math engine (Document 2) reliable — it can't compute against a status value it wasn't built for.

---

## 2. Domain: Study

This is the most detailed domain and the one every other part of the study dashboard reads from.

### 2.1 Course object (top level)

```json
{
  "schema_version": "1.0.0",
  "course_id": "course_01J8ZX3K",
  "title": "Calculus I",
  "created_at": "2026-07-01T09:00:00Z",
  "source": "ai_generated",
  "sections": [ /* Section objects, see 2.2 */ ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | see §7 |
| `course_id` | string | yes | unique |
| `title` | string | yes | 1–120 chars |
| `created_at` | ISO datetime | yes | |
| `source` | enum | yes | `"ai_generated"` \| `"manual"` |
| `sections` | array<Section> | yes | min 1 |

### 2.2 Section object

```json
{
  "section_id": "section_01J8ZX9P",
  "title": "Limits and Continuity",
  "order": 1,
  "topics": [ /* Topic objects, see 2.3 */ ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `section_id` | string | yes | unique within course |
| `title` | string | yes | |
| `order` | integer | yes | display ordering, 0-indexed |
| `topics` | array<Topic> | yes | min 1 |

### 2.3 Topic object

This is the atomic unit that the entire decay/spaced-repetition engine (Document 2) operates on.

```json
{
  "topic_id": "topic_01J8ZXA1",
  "title": "Epsilon-delta definition of a limit",
  "status": "practising",
  "conf": 4,
  "strength": 1.3,
  "k_factor": 7.0,
  "cards": 1,
  "last_reviewed": "2026-07-14T18:00:00Z",
  "drift_history": [-0.07, -0.12, -0.11],
  "review_history": [ /* ReviewEvent objects, see 2.4 */ ],
  "error_log": [ /* ErrorLogEntry objects, see 2.5 */ ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `topic_id` | string | yes | unique within course |
| `title` | string | yes | |
| `status` | enum | yes | `"not_started"` \| `"learning"` \| `"practising"` \| `"mastered"` — the Document 2 §7 ladder. **Set by the learner/import, not derived** (Document 2 §7): the math never silently demotes a topic; decay shows up as falling retention and health, not as a rewritten status. Display labels ("Not Started", "Practising") are Document 3's concern. |
| `conf` | integer 1–5 | yes | most recent self/AI-reported confidence. **1–5, not 0–100** (§1.3a). `0` is invalid — a topic with no confidence recorded yet uses `1`. |
| `strength` | float ≥ 0 | yes | the decay model's `s` — Document 2 §3. Defaults to `0` on an untouched topic; seeded to `1.0` on first promotion out of `not_started`. Only ever grows. |
| `k_factor` | float, 4.2–16.8 | yes | Document 2's self-tuning per-topic decay constant (`kFactor`, §4). **Engine-managed, never edited by hand.** Defaults to `DECAY_K` = `8.4`. Clamped to `[K_MIN, K_MAX]`; persisted to 2 dp. |
| `cards` | integer ≥ 0 | yes | count of flashcards for this topic. Feeds `cardScore` (Document 2 §6) and the "Under-carded" badge (§8). A **count only** — flashcard objects are out of v1 scope (Document 4 §13). Defaults to `0`. |
| `last_reviewed` | ISO datetime \| null | yes | Document 2's `reviewed`. `null` if never reviewed → retention is **undefined**, and the UI shows "—", never 0% (Document 2 §2). |
| `mastered_at` | ISO datetime \| null | yes | *(added v0.2.1)* when this topic **first** reached `mastered`. `null` until then. **Never cleared** — if the learner demotes a topic it retains the stamp, because Document 2 §10 asks how many topics have *ever* reached Mastered, not how many are Mastered now. Required because velocity ("topics reaching Mastered within the last `VELOCITY_WINDOW_WEEKS`") is otherwise uncomputable: status is learner-set and status changes are not events, so nothing else records *when* mastery happened. Engine-managed; stamped on the transition into `mastered`. |
| `drift_history` | array<float> | yes | Document 2 §4.1. Most-recent-first is **not** assumed — append order, capped at `DRIFT_WINDOW` (5) most recent. Can be empty. Tuning begins only at `DRIFT_MIN` (3) samples. |
| `review_history` | array<ReviewEvent> | yes | can be empty array. **Append-only** (§2.4). |
| `error_log` | array<ErrorLogEntry> | yes | can be empty array |

**Withdrawn in v0.2** (§0.1): `memory_strength`, `ease_factor`, `next_review_due`, `confidence` (0–100), and the `in_progress` / `review_due` statuses. Any JSON carrying them fails validation under `additionalProperties: false` — which is the intended behaviour, since such JSON was generated against the withdrawn model.

**Not stored, computed live on every render** (Document 2): retention `R(t)`, health, OCI, diagnostic badges, due-ness (`R < DUE_THRESHOLD`), and the projected due date (§2.1). Storing any of these would let them go stale between visits, and continuous decay is the product's core behaviour.

### 2.4 ReviewEvent object

Every time a topic's state changes — from a study session OR an exam — one of these is appended. This is the event log Document 2's math reads from. **Nothing overwrites this array; it is append-only.**

```json
{
  "event_id": "event_01J8ZXB2",
  "date": "2026-07-14T18:00:00Z",
  "kind": "study_review",
  "source": "session",
  "source_id": "session_01J8ZXAA",
  "confidence_reported": 4,
  "notes": "Solid on the formal definition, still shaky on applying it to proofs."
}
```

A test event additionally carries its evidence:

```json
{
  "event_id": "event_01J8ZXB9",
  "date": "2026-07-15T10:00:00Z",
  "kind": "test_fail",
  "source": "exam",
  "source_id": "exam_01J8ZXD5",
  "confidence_reported": 4,
  "test": { "score": 11, "out_of": 20, "actual_retention": 0.55 }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `event_id` | string | yes | |
| `date` | ISO datetime | yes | |
| `kind` | enum | yes | `"study_review"` \| `"test_pass"` \| `"test_fail"` — **what the event was**. This is what the math reads: it selects the strength increment (Document 2 §3) and gates drift/OCI (§4, §5). |
| `source` | enum | yes | `"session"` \| `"exam"` \| `"manual_review"` — **where it came from** (provenance). Orthogonal to `kind`: a `test_fail` can arrive from a `session` or an `exam` (§0.1 item 4). |
| `source_id` | string | yes | FK to `session_id` or `exam_id` |
| `confidence_reported` | integer 1–5 | yes | §1.3a. Drives the strength increment for `study_review`, and OCI for tests. |
| `test` | object | **yes if `kind` is `test_pass`/`test_fail`**, else forbidden | the test's evidence — see below |
| `test.score` | number ≥ 0 | yes (in `test`) | marks earned |
| `test.out_of` | number > 0 | yes (in `test`) | marks available. `kind` is `test_pass` when `score ≥ 0.80 × out_of` (Document 2 §1, "Test pass mark"), else `test_fail` — **computed on ingestion, never user-asserted**, so `kind` can't contradict the score. |
| `test.actual_retention` | number 0–1 | yes (in `test`) | observed retention at the moment of sitting = `score / out_of`. Computed on ingestion (like `pace_sec_per_km`, §5.1) so drift can't be corrupted by an inconsistent value. Drives Document 2 §4.1. |
| `notes` | string | no | freetext, max 500 chars |

**Withdrawn in v0.2:** `recall_success` — it fed the SM-2 interval math, which no longer exists. Nothing in Document 2 v0.2 reads it. Recall is now expressed by `kind` (a test outcome) or `confidence_reported` (a study review).

**Append-only.** Nothing overwrites this array; entries are never mutated. This is the event log Document 2's math reads from, and drift/OCI are only reproducible if history is immutable.

### 2.5 ErrorLogEntry object

```json
{
  "error_id": "error_01J8ZXC7",
  "date": "2026-07-14T18:00:00Z",
  "source": "session",
  "source_id": "session_01J8ZXAA",
  "error_type": "conceptual",
  "description": "Confused the limit definition with continuity definition.",
  "resolved": false,
  "resolved_date": null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `error_id` | string | yes | |
| `date` | ISO datetime | yes | |
| `source` | enum | yes | `"session"` \| `"exam"` |
| `source_id` | string | yes | FK |
| `error_type` | enum | yes | `"conceptual"` \| `"procedural"` \| `"careless"` \| `"knowledge_gap"` — this taxonomy drives the "recurring weaknesses" view in the UI, see Doc 3 |
| `description` | string | yes | max 500 chars |
| `resolved` | boolean | yes | user or AI can mark resolved |
| `resolved_date` | ISO datetime \| null | yes | |

---

## 3. Domain: Study Session (ingestion object)

This is the object the AI generates at the end of a study session, per the prompt template in §8. It is **not** stored as-is — on ingestion it is decomposed into `ReviewEvent` and `ErrorLogEntry` objects appended to the relevant topics (see §6.3, Ingestion Pipeline).

```json
{
  "schema_version": "1.0.0",
  "session_id": "session_01J8ZXAA",
  "course_id": "course_01J8ZX3K",
  "date": "2026-07-14T18:00:00Z",
  "duration_minutes": 45,
  "topics_covered": [
    {
      "topic_id": "topic_01J8ZXA1",
      "confidence_reported": 4,
      "notes": "Solid on definition, shaky on proofs.",
      "errors": [
        {
          "error_type": "conceptual",
          "description": "Confused limit definition with continuity definition."
        }
      ]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | `"2.0.0"` (§0.1 migration note) |
| `session_id` | string | yes | |
| `course_id` | string | yes | FK |
| `date` | ISO datetime | yes | |
| `duration_minutes` | integer > 0 | yes | |
| `topics_covered` | array | yes | min 1 |
| `topics_covered[].topic_id` | string | yes | FK, must exist in course |
| `topics_covered[].confidence_reported` | integer 1–5 | yes | §1.3a — **not** 0–100 |
| `topics_covered[].notes` | string | no | max 500 chars |
| `topics_covered[].errors` | array | no | can be empty/omitted |
| `topics_covered[].errors[].error_type` | enum | yes (if error present) | same enum as §2.5 |
| `topics_covered[].errors[].description` | string | yes (if error present) | max 500 chars |

**Withdrawn in v0.2:** `recall_success` (see §2.4). A session logs study reviews; each becomes a ReviewEvent with `kind: "study_review"`, `source: "session"`.

---

## 4. Domain: Exam / Test

Exams link across topics and, per your requirement, across sections or even courses. This is the object that carries the most weight in the confidence/decay recalculation (see Document 2 §4, "Evidence Weighting").

```json
{
  "schema_version": "1.0.0",
  "exam_id": "exam_01J8ZXD5",
  "title": "Midterm 1",
  "date": "2026-07-15T10:00:00Z",
  "linked_topic_ids": ["topic_01J8ZXA1", "topic_01J8ZXA9"],
  "score": 78,
  "max_score": 100,
  "breakdown": [
    {
      "topic_id": "topic_01J8ZXA1",
      "points_earned": 18,
      "points_possible": 20,
      "errors": []
    },
    {
      "topic_id": "topic_01J8ZXA9",
      "points_earned": 12,
      "points_possible": 20,
      "errors": [
        {
          "error_type": "procedural",
          "description": "Sign error in chain rule application."
        }
      ]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | |
| `exam_id` | string | yes | |
| `title` | string | yes | |
| `date` | ISO datetime | yes | |
| `linked_topic_ids` | array<string> | yes | min 1; **may span multiple courses/sections** — no constraint that they share a parent |
| `score` | number ≥ 0 | yes | |
| `max_score` | number > 0 | yes | |
| `confidence_reported` | integer 1–5 | no | how confident the learner felt sitting it. **Required for OCI** (Document 2 §5) — an exam without it contributes no calibration signal, which is why §5 says "over all its tests *that carry a confidence rating*". Applied to every linked topic unless a `breakdown[]` entry overrides it. |
| `breakdown` | array | no | if omitted, the exam's overall score is applied uniformly to all `linked_topic_ids` (see Doc 2 §4.2 for the fallback rule) |
| `breakdown[].topic_id` | string | yes (if breakdown present) | must be in `linked_topic_ids` |
| `breakdown[].points_earned` | number ≥ 0 | yes | |
| `breakdown[].points_possible` | number > 0 | yes | |
| `breakdown[].confidence_reported` | integer 1–5 | no | per-topic confidence; overrides the exam-level value for this topic |
| `breakdown[].errors` | array<ErrorLogEntry-lite> | no | same shape as §2.5 minus `error_id`/`resolved` (assigned on ingestion) |

**On ingestion**, each linked topic gets one ReviewEvent with `source: "exam"`, `kind` derived from its own `points_earned / points_possible` against the 0.80 pass mark (§2.4), and a `test` block carrying that ratio as `actual_retention`. Each topic therefore recalculates against **its own** prior state — identical inputs can produce different results per topic (Document 4 E5-S2).

**Design rule:** an exam is not tied to one `course_id`. It only carries `linked_topic_ids`, because a single exam (e.g. a general assessment) may span topics from unrelated courses. The dashboard resolves each `topic_id` back to its parent course/section for display.

---

## 5. Domain: Fitness

### 5.1 Running activity

```json
{
  "schema_version": "1.0.0",
  "activity_id": "activity_01J8ZXE1",
  "date": "2026-07-14",
  "distance_km": 8.05,
  "duration_seconds": 2400,
  "pace_sec_per_km": 298,
  "type": "tempo",
  "notes": ""
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | |
| `activity_id` | string | yes | |
| `date` | date | yes | |
| `distance_km` | number > 0 | yes | |
| `duration_seconds` | integer > 0 | yes | |
| `pace_sec_per_km` | number > 0 | yes | **computed on ingestion** as `duration_seconds / distance_km`, not user-supplied, to prevent inconsistent math |
| `type` | enum | yes | `"easy"` \| `"tempo"` \| `"long"` \| `"interval"` \| `"race"` |
| `notes` | string | no | |

### 5.2 Lifting session

```json
{
  "schema_version": "1.0.0",
  "session_id": "session_01J8ZXF3",
  "date": "2026-07-14",
  "exercises": [
    {
      "exercise_name": "Back Squat",
      "sets": [
        { "set_number": 1, "reps": 5, "weight_kg": 80, "rpe": 7 },
        { "set_number": 2, "reps": 5, "weight_kg": 85, "rpe": 8 },
        { "set_number": 3, "reps": 5, "weight_kg": 85, "rpe": 8.5 }
      ]
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | string | yes | |
| `session_id` | string | yes | |
| `date` | date | yes | |
| `exercises` | array | yes | min 1 |
| `exercises[].exercise_name` | string | yes | freetext but matched against a canonical exercise list client-side for chart grouping (fuzzy-matched, not enforced by schema) |
| `exercises[].sets` | array | yes | min 1; **array, not flat total** — required for per-set progression tracking |
| `sets[].set_number` | integer ≥ 1 | yes | |
| `sets[].reps` | integer ≥ 0 | yes | |
| `sets[].weight_kg` | number ≥ 0 | yes | stored in kg; UI may display lb via conversion, see Doc 3 |
| `sets[].rpe` | number 1–10 | no | Rate of Perceived Exertion, optional |

---

## 6. Ingestion Pipeline & Validation

This section defines exactly what happens between "user pastes JSON" and "dashboard state updates." This is the part most likely to be under-specified by an agent, so it is spelled out as a sequence.

### 6.1 Ingestion sequence (applies to Study Session, Exam, Course, and Fitness objects alike)

1. **Parse.** Attempt `JSON.parse`. On failure → show raw parse error to user, do not proceed.
2. **Schema validate.** Validate against the relevant JSON Schema (§2–5) using a standard validator (e.g. Ajv). Collect **all** errors, not just the first.
3. **Referential integrity check.** For every `*_id` reference, confirm the target exists in the user's current data store. Collect all failures.
4. **If validation or integrity checks fail:** do not partially ingest. Show the user a structured error list (field path + problem, in plain English, not raw JSON Schema error text) and return them to manual correction. *(v0.2.1: the Auto-Repair offer is removed — §6.2 is deferred.)*
5. **If validation passes:** proceed to the domain-specific merge logic (§6.3).

### 6.2 Auto-repair path — **DEFERRED (not in v1)**

*(v0.2.1: deferred by product decision — no built-in AI is being implemented at this time. See Document 4 E2-S5. With it goes the last in-app AI call, so the app makes no network requests at all. Step 4 above therefore ends at the structured error list and manual correction.)*

Retained as specification for whenever it is picked up: if validation fails, the user may opt to send `{original_json, schema, error_list}` to an AI completion call with an explicit repair prompt (defined in Document 4, not this doc, since it's a product-flow concern). The repaired JSON is re-run through steps 1–3 above. **Auto-repair never bypasses validation** — a repaired object is validated exactly as strictly as a fresh one.

### 6.3 Domain-specific merge logic

- **Course object:** if `course_id` does not exist → create new course. If it exists → this is a schema error (courses are created once via initial AI ingestion; later updates to syllabus structure are a separate "amend course" flow, out of scope for v1 — flag as future work in Document 4).
- **Study Session object:** decomposed per `topics_covered[]` entry: append one `ReviewEvent` (`kind: "study_review"`, `source: "session"`) to the matching topic's `review_history`, append `ErrorLogEntry` objects to `error_log`, then trigger the Document 2 recalculation — which updates `strength` (§3), `conf`, and `last_reviewed`. It does **not** write `status` (learner-set, §7) and there is no `next_review_due` to write (§0.1 item 5).
- **Exam object:** for each `linked_topic_ids` entry (using `breakdown` if present, else the uniform fallback), append a `ReviewEvent` with `source: "exam"`, `kind` derived from that topic's score against the 0.80 pass mark, and a `test` block; append any `ErrorLogEntry` objects; then run the same recalculation. Because the event is a test, it additionally drives **drift → `k_factor` tuning** (Document 2 §4) and **OCI** (§5) — which is the real sense in which exams "carry more weight" than sessions.
- **Fitness objects:** appended directly to the activity log for that domain; no cross-object recalculation needed (fitness has no decay model in v1).

---

## 7. Versioning & migration policy

- Every stored object carries `schema_version` (semver).
- A **minor** version bump (`1.0.0` → `1.1.0`) means new optional fields only — old data remains valid, no migration needed.
- A **major** version bump (`1.x.x` → `2.0.0`) means a breaking change — a migration function must be written that transforms `v1` objects to `v2` shape before they're read by any v2-aware code. Migration functions are pure, one-directional, and never run silently in the background without being logged.
- The AI ingestion prompt template (§8) always requests the **current schema major.minor** so freshly-generated JSON from users matches what the app expects.

---

## 8. AI ingestion prompt template (Study domain)

This is the exact instruction block the app displays for the user to copy alongside their syllabus, to be pasted into their AI of choice.

> You are converting a course syllabus into a structured JSON object for a study tracker. Output **only** valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.
>
> Schema (v2.0.0):
> - Root: `{schema_version, course_id, title, created_at, source, sections[]}`
> - `schema_version`: always `"2.0.0"`.
> - `course_id`: generate as `course_` followed by a random 10-character alphanumeric string.
> - `created_at`: ISO 8601 UTC, now.
> - `source`: always `"ai_generated"`.
> - Each section: `{section_id, title, order, topics[]}`. `section_id` follows the same random-suffix pattern with prefix `section_`. `order` is 0-indexed.
> - Each topic: `{topic_id, title, status, conf, strength, k_factor, cards, last_reviewed, drift_history, review_history, error_log}`.
>   - `topic_id`: prefix `topic_`.
>   - `status`: always `"not_started"` for a fresh syllabus.
>   - `conf`: always `1`. (Confidence is a **1–5** scale, not a percentage.)
>   - `strength`: always `0`.
>   - `k_factor`: always `8.4`.
>   - `cards`: always `0`.
>   - `last_reviewed`: always `null`.
>   - `drift_history`, `review_history`, `error_log`: always empty arrays `[]`.
>
> Break the syllabus into sections matching its natural structure (chapters/weeks/units), and topics matching individual concepts/skills within each section — granular enough that a topic represents something masterable in a single study session, not an entire chapter.
>
> Here is the syllabus: [PASTE SYLLABUS HERE]

*(The end-of-session prompt template — which generates the Study Session object in §3 — lives in Document 4 alongside the other product-flow prompts, since it depends on UX decisions like what the user is asked at session end.)*

---

## 9. Open items for other documents

- Exact decay formula, `kFactor` self-tuning, health/OCI weights, projected due date → **Document 2 (Math & Algorithms Spec) v0.2**
- *(Sync note: **resolved in v0.2.** The Topic shape now matches Document 2 v0.2's real model — `strength`, `k_factor`, `drift_history`, `conf`, `cards` — and the withdrawn `ease_factor` / `memory_strength` / `next_review_due` / `recall_success` fields are deleted. The sync flagged as required by Document 2 §13 and Document 3 §8 is complete; Documents 1, 2 and 3 are now consistent on the Topic shape.)*
- How these objects render (retention matrix, activity calendar, charts) → **Document 3 (UI Spec) v0.3**
- End-of-session prompt template, auto-repair prompt template, full user stories with DoD/DoR → **Document 4 (Product Spec) v0.2**
