Cairn/Tracker — Current State Report
Reverse-engineered from codebase inspection on 2026-08-11. No changes proposed — understanding only.

A. Architecture Summary
Framework
Vite + React 18 + TypeScript, single-page app. No server-rendered pages. No backend API for core logic.

Governing Principle: Local-first, zero-network
The app stores ALL state in browser localStorage under a single key (studyos-store). There is no backend database, no API calls, and no server-side state. Firebase is used exclusively for authentication (Google sign-in), not for data storage. The AI tutor runs outside the app — the user copies a prompt from the app, pastes it into an external AI (e.g. ChatGPT), then pastes the AI's JSON response back into the app.

Architecture Layers

┌─────────────────────────────────────────────────────────┐
│  UI Layer (React Components / Routes)                   │
│  Overview · CourseDashboard · TopicDetail · Exams       │
│  Performance · StartSession · FocusMode · AddFlow       │
│  QuickAdd · Settings · Auth                             │
├─────────────────────────────────────────────────────────┤
│  Engine Layer (Pure Functions — derive, never store)    │
│  retention · recalculate · metrics · leveling           │
│  performance · course · overview · progress             │
│  session · exams · history · replay · stability         │
│  prerequisites · performance-view · palette             │
├─────────────────────────────────────────────────────────┤
│  Domain Layer (Types, Schemas, Prompts)                 │
│  types.ts · schemas.ts · prompts.ts                     │
├─────────────────────────────────────────────────────────┤
│  Core Layer (Infrastructure)                            │
│  pipeline · validate · integrity · merge · storage      │
│  detect · errorTranslation · migrations · transfer      │
│  focusDraft                                             │
├─────────────────────────────────────────────────────────┤
│  Persistence: localStorage (one key: studyos-store)     │
└─────────────────────────────────────────────────────────┘
Data Model Paradigm: Event-Sourced, Derive-Don't-Store
The atomic unit of truth is the ReviewEvent, appended to each topic's review_history. Sessions and exams are decomposed into per-topic events on ingestion; they are not stored as first-class entities (though Store.exams[] and Store.sessions[] exist as side-channels for metadata/duration).

Everything derived is recomputed live every render: retention, health, levels, EXP, streaks, projections — none are persisted. "Nothing stored can go stale."

B. Learning Lifecycle — Complete Data Flow
1. User starts a learning session

App.tsx: SessionFlowState idle → setup
→ StartSession.tsx renders
→ User selects topic, intent (remediate|retention|new_content|adaptive), scope (clean_slate|topic|section|course), timer mode
→ buildSessionContext() assembles topic metadata, retention, confidence, unresolved errors, siblings/snapshot
→ startSessionPrompt() renders a text briefing block (NOT JSON schema)
→ User copies briefing to external AI
→ App transitions to FocusMode (SessionFlowState: focus)
Data created: FocusDraft saved to localStorage (key cairn-focus-session), containing config for the session. No store mutation occurs yet.

2. User receives content from the AI tutor
This happens entirely outside the app. The user pastes the briefing into an external AI chat. The AI teaches interactively. The app has no visibility into this conversation — it only sees the study timer running in FocusMode.

Data created: None in the app. The teaching conversation lives in the external AI. Information lost: The entire tutoring transcript is not captured by the app.

3. User answers questions / makes mistakes
Again, happens in the external AI. The app's FocusMode provides a visual checklist of unresolved errors, but checking boxes is local-only — it doesn't mutate the store. Real error tracking comes from the AI's post-session JSON report.

4. Session completes

FocusMode: user clicks "End Session"
→ App transitions to import phase (SessionFlowState: import)
→ AddFlow renders with sessionWrapUpPrompt
→ User pastes the wrap-up prompt into the AI conversation
→ AI produces session-log JSON
→ User pastes JSON into AddFlow
5. Session data is committed

Pasted JSON → ingest()
  → detectSchema → parseJson → validateAgainst (Ajv) → checkIntegrity
  → buildPreview → user confirms
  → commit:
    → cloneStore(store)
    → mergeSession(draft, studySession):
        For each topic in topics_covered:
          → push ErrorLogEntry[] to topic.error_log
          → construct ReviewEvent { kind: study_review, source: session }
          → applyEvent(topic, event):
              → append to review_history
              → strength += strengthIncrement(confidence)
              → conf = event.confidence_reported
              → last_reviewed = event.date
              → if not_started → promote to learning
    → commitSession appends a SessionRecord with measured_minutes
    → saveStore(next) → localStorage
    → setStore(next) → React state
Data created:

Per covered topic: 1 ReviewEvent, 0+ ErrorLogEntry objects
1 SessionRecord (real timer duration)
Topic fields mutated: strength, conf, last_reviewed, status (if seeded), review_history, error_log
6. User starts another session
Same flow as step 1. The session briefing now includes updated retention, confidence, error counts — but only what the engine can derive from persisted events. There is no "learner profile" or "session plan" persisted between sessions.

7. User creates/receives an exam

AddFlow or AddExam → user copies examPrompt (or coldAssessmentPrompt)
→ pastes into external AI with exam details/marked paper
→ AI produces Exam JSON
→ user pastes back into app
→ ingest() pipeline: parse → validate → integrity → preview → confirm
8. Exam is committed

mergeExam(draft, exam):
  → push exam to draft.exams[]
  → For each linked_topic_id:
    → use breakdown[] if present, else uniform score (smeared)
    → derive kind: test_pass if ≥80%, else test_fail
    → construct ReviewEvent { kind: test_pass|test_fail, source: exam, test: { score, out_of, actual_retention } }
    → push errors to topic.error_log
    → applyEvent(topic, event):
        → append to review_history
        → strength += strengthIncrement(actual_retention) [continuous]
        → conf = confidence_reported
        → last_reviewed = event.date
        → if non-smeared test: compute drift, push to drift_history, tuneKFactor
        → if not_started → promote to learning
Data created:

Exam stored in store.exams[]
Per linked topic: 1 ReviewEvent (with test block), 0+ ErrorLogEntry objects
Topic fields mutated: strength, conf, last_reviewed, k_factor (if tuned), drift_history, review_history, error_log
9. User views their progress/dashboard
All dashboard data is recomputed live from the event log on every render. No cached aggregates.

C. Data Model — Complete Entity Reference
Store (top-level)
Field	Type	Persisted
schema_version	string ("3.2.0")	✅
courses	Course[]	✅
exams	Exam[]	✅
sessions	SessionRecord[]	✅
Course
Field	Type	Required
schema_version	string	✅
course_id	string (pattern: course_*)	✅
title	string	✅
created_at	ISO 8601 string	✅
source	'ai_generated' | 'manual'	✅
sections	Section[] (min 1)	✅
Section
Field	Type	Required
section_id	string (pattern: section_*)	✅
title	string	✅
order	number	✅
topics	Topic[] (min 1)	✅
Topic — the core aggregate
Field	Type	Required	Written by	Derived?
topic_id	string (pattern: topic_*)	✅	course creation	persisted
title	string	✅	course creation	persisted
status	TopicStatus	✅	learner (manual) + auto-seed on first event	persisted
conf	Confidence (1–5)	✅	every event	persisted
strength	number (monotonically grows)	✅	every event via strengthIncrement	persisted
k_factor	number (clamped 4.2–16.8)	✅	tests only (drift tuning)	persisted
cards	number	✅	direct field (not event-sourced)	persisted
last_reviewed	string | null	✅	every event	persisted
mastered_at	string | null	✅	first arrival at mastered (never cleared)	persisted
drift_history	number[] (max 5)	✅	tests only	persisted
review_history	ReviewEvent[]	✅	all ingestion	persisted
error_log	ErrorLogEntry[]	✅	sessions + exams	persisted
prerequisites	string[]	❌ optional	course creation	persisted
ReviewEvent — the atomic fact
Field	Type	Required
event_id	string	✅
date	ISO 8601 string	✅
kind	'study_review' | 'test_pass' | 'test_fail'	✅
source	'session' | 'exam' | 'manual_review'	✅
source_id	string	✅
confidence_reported	Confidence (1–5)	✅
test	TestEvidence	Required if test kind, forbidden otherwise
smeared	boolean	❌ (true = uniform fallback, no breakdown)
fanout	number	❌ (linked_topic_ids.length, for future damping)
notes	string	❌
assessment	AssessmentEvidence	❌
TestEvidence
Field	Type	Required
score	number (≥0)	✅
out_of	number (>0)	✅
actual_retention	number (0–1, = score/out_of)	✅ (computed on ingestion)
AssessmentEvidence (Performance layer — all optional)
Field	Type	Range
difficulty	Difficulty	0–5
novelty	Novelty	0–4
independence	Independence	0–3
transfer_level	TransferLevel	0–3
performance_quality	PerformanceQuality	0–5
quality_rationale	string	max 1000 chars
cold	boolean	—
predicted_success	number	0–1
predicted_at	ISO 8601 string	—
assessed_by	string	max 200 chars
ErrorLogEntry
Field	Type	Required
error_id	string	✅
date	ISO 8601 string	✅
source	'session' | 'exam'	✅
source_id	string	✅
error_type	'conceptual' | 'procedural' | 'careless' | 'knowledge_gap'	✅
description	string	✅
resolved	boolean	✅
resolved_date	string | null	✅
Exam (ingestion object, also stored in store.exams[])
Field	Type	Required
schema_version	string	✅
exam_id	string	✅
title	string	✅
date	ISO 8601 string	✅
linked_topic_ids	string[] (min 1)	✅
score	number (≥0)	✅
max_score	number (>0)	✅
confidence_reported	Confidence	❌
breakdown	ExamBreakdownEntry[]	❌
cold	boolean	❌
StudySession (ingestion object — NOT stored directly)
Field	Type	Required
schema_version	string	✅
session_id	string	✅
course_id	string	✅
date	ISO 8601 string	✅
duration_minutes	number	✅ (but value is DISCARDED — app timer is authoritative)
topics_covered	SessionTopicEntry[] (min 1)	✅
SessionRecord (duration side-channel)
Field	Type	Required
session_id	string	✅
topic_id	string	✅
course_id	string	✅
created_at	ISO 8601 string	✅
completed_at	ISO 8601 string	✅
duration_minutes	number (measured by app timer)	✅
intent	SessionIntent	✅
scope	SessionScope	✅
timer_mode	'count_up' | 'pomodoro'	✅
pomodoro_config	{ work_minutes, break_minutes, long_break_minutes }	❌
What is NOT in the data model
Concept	Exists?	Notes
Learning objectives	❌	Not represented. Topics are the finest unit.
Questions (individual)	❌	Not stored. Exams have scores, not question-level items.
Question attempts	❌	Not stored. Only aggregate scores per topic.
Mark scheme	❌	Not represented.
Past paper identity	❌	No distinction between AI-generated exam, past paper, diagnostic.
Exam type	❌	All exams are identical structurally (Exam).
Recommendations	❌	Not persisted. Session intents exist but are not recommendations.
User profile/preferences	❌	No learner profile.
Subtopics	❌	Sections → Topics, no further nesting.
Learning path	❌	Prerequisites exist but there's no "recommended order" engine.
Session plan	❌	No plan persisted for what a session should teach.
Session outcomes	❌	Not explicitly tracked — decomposed into events and lost.
D. AI Tutor — Current Inputs, Outputs, Responsibilities
Architecture: AI is EXTERNAL
The app never calls an AI API. The "AI tutor" is a separate service (e.g. ChatGPT) that the user interacts with by:

Copying a prompt from the app
Pasting it into the AI
Pasting the AI's JSON response back into the app
Four prompt templates exist:
1. coursePrompt(store) — Course creation
Receives: List of all existing topic IDs + titles (for cross-course prerequisite linking)
Returns: Course JSON with sections/topics, all initialised to not_started, strength 0, k_factor 8.4
2. sessionPrompt(courseId, topics) — Session logging (standalone)
Receives: Course ID, topic list (id → title)
Returns: StudySession JSON: per-topic confidence, notes, errors, assessment evidence
3. startSessionPrompt(ctx, intent, scope) — Live session briefing
Receives (via SessionContext):
Topic title, section, course
Learner state: retention %, confidence, overconfident flag, status
Unresolved error descriptions (remediate sessions always include these)
Related topics (ranked siblings with retention/error data)
Course snapshot (section mastery counts, top weaknesses)
Returns: Free-text teaching (NOT JSON). The session is interactive.
Wrap-up: sessionWrapUpPrompt then requests the session-log JSON from the same conversation.
4. examPrompt(store) / coldAssessmentPrompt(store) — Exam result logging
Receives: Full cross-course topic list (id → title → course)
Returns: Exam JSON with linked_topic_ids, score, max_score, optional breakdown, optional cold flag, optional assessment evidence
What the tutor does NOT receive:
Historical review events
Mastery scores or health
Level information
Strength values or k_factor
Previous session transcripts
Previous exam scores
Error resolution history
Performance layer metrics
Badge information
What the tutor controls:
Confidence ratings (self-reported by the tutor's assessment)
Error classification and descriptions
Assessment evidence (difficulty, novelty, independence, transfer, quality)
Which topics were covered
Where learner state lives:
State	Lives in	AI sees?
Retention %	Engine (derived)	✅ (via briefing)
Confidence	Store (last event)	✅ (via briefing)
Overconfident flag	Engine (derived)	✅ (via briefing)
Topic status	Store	✅ (via briefing)
Unresolved errors	Store	✅ (via briefing)
Strength	Store	❌
k_factor	Store	❌
Health score	Engine (derived)	❌
Level	Engine (derived)	❌
Sibling retention/errors	Engine (derived)	✅ (section/course scope)
Historical events	Store	❌
Performance metrics	Engine (derived)	❌
IMPORTANT

The AI tutor is stateless between sessions. It receives a briefing at session start but has no memory of previous sessions unless the user maintains the same AI conversation thread. The app assumes nothing about AI continuity.

E. Sessions — How They Currently Work
Session lifecycle:
Setup (StartSession.tsx): User picks topic, intent, scope, timer mode
Briefing generated: buildSessionContext + startSessionPrompt produce a text block
User copies briefing to external AI
Focus mode (FocusMode.tsx): Timer runs, ambient UI, error checklist (visual only)
Session ends: User clicks "End Session"
Import (AddFlow.tsx): sessionWrapUpPrompt generated; user pastes it into AI; AI returns JSON; user pastes JSON back
Commit: commitSession merges the session and records the SessionRecord
What the system understands about sessions:
Question	Answer
What the session intends to teach	✅ SessionIntent (remediate, retention, new_content, adaptive) — stored in SessionRecord
What the learner was expected to demonstrate	❌ No explicit expected outcomes
Whether the learner demonstrated it	❌ Only post-hoc confidence + errors; no objective check
Whether the learner is ready to move on	❌ No readiness logic
Whether the session should trigger an assessment	❌ No trigger logic
Whether errors affect future sessions	✅ Via unresolvedErrors in the next session's briefing
Session scope determines briefing content:
Scope	Includes
clean_slate	Topic title only
topic	+ learner state + unresolved errors
section	+ related topics (ranked siblings)
course	+ course snapshot (section mastery + top weaknesses)
Intent affects AI instructions:
Intent	Focus	Sibling weights
remediate	Error correction, retrieval before explanation	errors 3×
retention	Recall testing, patch faded knowledge	retention 3×
new_content	Extend beyond current knowledge	proximity 3×
adaptive	Full picture, focus on weakest areas	balanced
F. Assessments — How They Currently Work
Exam creation
Exams are created by pasting AI-generated JSON through the standard ingestion pipeline. There is no in-app exam creation UI — the user describes the exam to an external AI, which produces the JSON.

Exam types
The system does NOT distinguish between:

Past papers
AI-generated exams
Diagnostic assessments
Custom exams
Topic tests
Full-subject assessments
All are represented identically as Exam objects.

How questions are represented
They are not. The system has no concept of individual exam questions. An exam has:

score / max_score (aggregate)
linked_topic_ids (which topics the exam covers)
breakdown[] (optional: per-TOPIC marks, NOT per-question)
How marks/mark schemes work
No mark scheme is represented
No question-level marks
Per-topic marks exist ONLY if the AI provides a breakdown[] array
Without breakdown, the overall score is applied uniformly to all linked topics (marked smeared)
How exams affect learner state
Each linked topic receives one ReviewEvent:

kind: test_pass if ≥80% of per-topic marks, else test_fail
strength increment: continuous function of actual_retention (score/out_of)
k_factor tuning: drift measured against predicted retention, kFactor adjusted via running average (only for non-smeared test events)
lapseFactor: failed tests multiply a cumulative penalty that reduces effective strength (and thus retention)
How the dashboard displays exams
Exams.tsx renders exam cards showing:

Score as percentage
Per-topic effect: "boosted" (≥80%) or "flagged weak" (<80%)
Per-topic errors from breakdown
Grouped by course
Cold assessments
A coldAssessmentPrompt exists that instructs the AI to present items without hints, notes, or topic labels. The cold: true flag is stored and propagated to AssessmentEvidence.cold on each event. Cold events feed into coldPerformance() — a separate composite metric in the Performance layer.

G. Mastery/Progress — How It Is Currently Calculated
Topic status ladder (learner-controlled)
not_started → learning → practising → mastered
Status transitions are manually triggered by the learner via the UI, with two automatic rules:

First event on a not_started topic promotes it to learning (seeding strength = 1.0)
First promotion to mastered stamps mastered_at (never cleared)
IMPORTANT

The system does NOT automatically advance topics through the ladder. The learner decides when a topic is "practising" or "mastered". The math never demotes.

Retention: R(t) = e^(−t / (k · s_eff))
t = fractional days since last_reviewed
k = k_factor (starts at 8.4, tuned by test drift)
s_eff = effectiveStrength(topic) = max(S_EFF_MIN, strength × lapseFactor)
lapseFactor = cumulative multiplicative penalty from failed tests (recovers via passed tests)
Returns null if never reviewed or not_started
A topic is due when R < 0.70
Health composite (0–100):

health = 0.30 × retentionScore + 0.25 × errorScore + 0.20 × calibrationScore
       + 0.15 × confidenceScore + 0.10 × cardScore
Sub-scores:

retentionScore = R × 100 (0 if null)
errorScore = step function by active error count: 0→100, 1→70, 2→40, ≥3→0
calibrationScore = 100 × (1 − |OCI|), floored at 0; 100 if no tests
confidenceScore = (conf/5) × 100
cardScore = min(100, cards × 20)
Only surfaced for practising/mastered topics.

Overconfidence Index (OCI):
OCI = mean over tests of [ (confidence/5) − (score/out_of) ]
Levels (0–5, derived, never stored):
Level = number of HEALTH_BANDS [25, 45, 62, 78, 90] the topic's health clears
Capped at 3 without a passed test (UNVALIDATED_CAP)
Capped at 4 unless status is mastered
topicLevelHighWater = historical maximum (ratchet, non-decreasing)
EXP (retrievable):
EXP = Σ retention across all started topics
Ceiling = count of started topics. Not weighted by importance.

Velocity:
topics reaching mastered in last 4 weeks / 4
Undefined until ≥2 topics have ever been mastered.

What contributes to mastery:
Factor	Contributes?	How?
Sessions	✅	Increase strength (confidence-weighted)
Exams	✅	Increase strength (continuous), tune k_factor, push drift
Manual reviews	✅	Increase strength (confidence-weighted)
Errors	✅	Reduce errorScore in health composite
Cards	✅	Contribute to cardScore in health composite
Time decay	✅	Reduces retention → reduces health → reduces level
Status promotion	✅	Learner-set; gates level 5
Passed tests	✅	Gates level > 3; recover lapse penalty
What does NOT contribute:
Knowledge decay is not considered — there is no time-based demoting.
Historical evidence is retained (review_history is append-only), but there is no explicit "mastery evidence" assessment.
No distinction between practice performance and assessment performance in the core mastery model (though the Performance layer is a parallel read-only signal).
No prerequisite-gated mastery — prerequisites are diagnostic only.
H. Errors — How They Are Currently Tracked
Error creation
Errors are created during session/exam ingestion from the AI's JSON output. Each error is an ErrorLogEntry:

error_type: conceptual | procedural | careless | knowledge_gap
description: free text from the AI
source: session | exam
source_id: links to the originating session/exam
resolved: boolean flag
resolved_date: ISO timestamp or null
Error storage
Errors are stored directly on the topic they belong to in topic.error_log[]. They are NOT event-sourced — resolving an error flips the resolved flag directly (via useStore.toggleError), not via a ReviewEvent.

Error lifecycle:
Question	Answer
Is the error stored?	✅ In topic.error_log[]
Linked to a topic?	✅ By storage location
Linked to a question?	❌ No question-level granularity
Linked to a learning objective?	❌ No learning objectives exist
Classified?	✅ By error_type (4 categories)
Repeated errors detected?	❌ No matching/deduplication logic
Errors resolved?	✅ Via resolved toggle
Does the tutor see previous errors?	✅ Unresolved error descriptions in session briefing
Dashboard shows errors?	✅ In topic detail + error count affects health
Errors influence recommendations?	✅ Indirectly via errorScore in health, and via remediate intent
Error → health impact:
Active (unresolved) error count directly feeds errorScore:

0 errors → 100
1 error → 70
2 errors → 40
≥3 errors → 0
This has 25% weight in the health composite.

What is missing:
No error classification beyond the 4 types (no severity, no recurrence detection)
No error patterns — repeated errors on the same concept are not linked
No error resolution verification — marking resolved doesn't create evidence that the error was actually fixed
Resolving an error is not recorded in review_history, so it doesn't appear in trends/feed
I. Dashboard — Where Its Information Comes From
Overview page (Overview.tsx)
Displayed Metric	Source Function	Underlying Data
Health ring (global)	globalHealth()	Mean health of all active topics (derived from retention, errors, calibration, confidence, cards)
Overall mastery %	overallMastery()	mastered topics / total topics
Study streak	studyStreak()	Consecutive days with a source:session event (today/yesterday grace)
Weekly volume	weeklyVolume()	Sessions in last 7 days, hours from SessionRecord.duration_minutes (or 30-min proxy)
EXP bar	retrievable()	Σ retention over started topics
EXP trend sparkline	expTrend()	7-day EXP history via forward-replay
Due reviews	globalDueQueue()	Topics where R < 0.70, most-decayed first, section-spread
Weak topics	weakTopics()	Lowest health first (excl. not_started/mastered)
Activity feed	activityFeed()	Sessions reconstructed by source_id; exams from store.exams
Streak calendar	activitySeries()	Sessions per day (dedup by source_id)
Course Dashboard (CourseDashboard.tsx)
Displayed Metric	Source Function
Course health ring	courseHealth()
Average retention	averageRetention()
Velocity	velocity()
Projection (finish date range)	projectFinish()
Due queue	dueQueue()
Activity heatmap	activitySeries()
Topic matrix	Direct from course.sections.topics
Topic Detail (TopicDetail.tsx)
Displayed	Source
Level + high-water	topicLevelHighWater()
Health score	health()
Retention % + decay curve	retentionPct() + SVG rendering
OCI	overconfidenceIndex()
Badges	badges()
Review history	Direct from topic.review_history
Error log	Direct from topic.error_log
Status control	Direct, dispatches promoteTopic()
Performance page (Performance.tsx)
Displayed	Source
Independent performance by tier	independentPerformance()
Performance by difficulty	performanceByDifficulty()
Performance by novelty	performanceByNovelty()
Transfer ability + trend	transferAbility()
Cold performance	coldPerformance()
Performance health	performanceHealth()
Quality score	performanceQuality()
Novel task success	novelTaskSuccess()
Calibration error	calibrationError()
NOTE

Everything on the dashboard is derived live. No pre-computed aggregates are stored. The dashboard reconstructs all metrics from review_history, error_log, and store.exams/store.sessions on every render.

J. Gaps — What The Current Architecture Cannot Represent Or Do
Assessment Gaps
Question	Can the system answer it?
What is this assessment testing?	❌ Only linked_topic_ids; no learning objectives, no question content
Which topics does it cover?	✅ Via linked_topic_ids
Is it a past paper or AI-generated?	❌ No exam type field
What evidence does each question provide?	❌ No question-level data at all
What is the mark scheme?	❌ Not represented
Progression Gaps
Question	Can the system answer it?
Should the learner continue to the next session?	❌ No readiness logic
Should they practise?	Partially — isDue identifies decayed topics
Should they sit an assessment?	❌ No trigger logic (but ready_to_test badge is a signal)
Should they remediate an error?	Partially — remediate intent exists, but no auto-recommendation
Error Gaps
Question	Can the system answer it?
Which errors are currently active?	✅ error_log.filter(!resolved)
Which are urgent?	❌ No urgency/priority scoring
Which are recurring?	❌ No recurrence detection
Which are foundational?	❌ No link to prerequisites (though prerequisite instability exists separately)
Which have been resolved?	✅ resolved flag
Learner State Gaps
Question	Can the system answer it?
What does the tutor know before a session?	✅ Retention, confidence, overconfident flag, unresolved errors, siblings (scope-dependent)
What does the app know?	✅ Full event history, all derived metrics
What information is lost between sessions?	❌ The entire tutoring transcript, what was taught, what questions were asked, how the learner reasoned
Assessment Results Gaps
Question	Can the system answer it?
Question-level performance → topics?	❌ No question-level data
Marks → mark-scheme criteria?	❌ No mark scheme
Past paper ≠ AI-generated?	❌ No type distinction
K. Relevant Files — By Area
Data Model
File	Role
types.ts
All TypeScript interfaces and type definitions
schemas.ts
JSON Schema (Ajv) validation schemas
prompts.ts
AI prompt templates
Core Infrastructure
File	Role
pipeline.ts
Ingest → validate → preview → commit
merge.ts
Decompose ingestion objects into events
validate.ts
JSON parsing + Ajv schema validation
integrity.ts
Referential integrity checks
storage.ts
localStorage read/write + migrations
detect.ts
Duck-type schema detection
errorTranslation.ts
Ajv error → user-friendly messages
transfer.ts
Full backup/restore
migrations.ts
Data migration (lapse contamination fix)
focusDraft.ts
Transient focus-session localStorage helper
Engine (Business Logic)
File	Role
recalculate.ts
Single recalculation path: applyEvent, promote
retention.ts
R(t) = e^(−t / (k·s)), isDue, projectedDue
stability.ts
Lapse factor + effective strength
metrics.ts
Health composite, OCI, badges
leveling.ts
Levels 0–5, high-water ratchet
course.ts
Course-level aggregations
overview.ts
Global aggregations, streaks, feed
progress.ts
EXP, trend, workLogged
performance.ts
Performance layer (cold, transfer, calibration)
performance-view.ts
Performance view-models for dashboard
session.ts
Session briefing generation
exams.ts
Exam view construction
history.ts
Retention/activity time series
replay.ts
Historical state reconstruction
prerequisites.ts
Prerequisite graph diagnostics
State Management
File	Role
useStore.ts
React hook: state, dispatch, commit, undo
constants.ts
All tunable parameters
UI (Key Routes)
File	Role
App.tsx
Root component, session flow state machine
Overview.tsx
Global dashboard
CourseDashboard.tsx
Per-course dashboard
TopicDetail.tsx
Topic deep-dive drawer
Exams.tsx
Exam results list
Performance.tsx
Performance metrics view
StartSession.tsx
Session setup modal
FocusMode.tsx
Ambient study timer
AddFlow.tsx
Multi-step ingestion modal
QuickAdd.tsx
Universal paste inbox
Settings.tsx
Data management
L. Architectural Risks
1. localStorage ceiling
All data lives in a single localStorage key. As review_history grows (every session/exam/review appends events to every covered topic), this will eventually hit the ~5–10MB localStorage limit. There is no pruning, archiving, or overflow strategy.

2. No question-level granularity
The system cannot represent individual exam questions, their content, marks, or topic associations. This makes the envisioned past-paper ingestion workflow impossible without schema additions — there is nowhere to store questions, mark schemes, or per-question results.

3. No exam type distinction
All exams are structurally identical. A past paper, an AI-generated practice test, and a formal assessment produce the same data. The system cannot weight evidence differently by source, which matters for learner progression decisions.

4. All derived metrics recomputed every render
The derive-don't-store philosophy is elegant but means every route renders trigger full recalculations over the entire event history. As event count grows, this will create performance issues. The replay module (forward-replay for historical reconstruction) is already computationally expensive.

5. AI boundary is blurred in the assessment domain
The AI currently owns error classification, confidence assessment, and assessment evidence — but the app has no way to validate these judgements. A poorly calibrated AI produces systematically wrong strength gains and health scores. The cold flag and independence rating are especially trust-dependent.

6. Session transcript is lost
The teaching conversation between the user and the external AI is never captured. This means the app cannot learn what was taught, how the learner responded, or what reasoning was demonstrated. All session evidence is reduced to confidence + errors + assessment dimensions.

7. Error resolution creates no evidence
Toggling resolved on an error is a direct flag mutation, not an event in review_history. This means:

No audit trail of when errors were resolved
No verification that the resolution stuck
Error resolution doesn't appear in trends or the activity feed
Health improves immediately on resolution with no proof
8. Mastery is entirely self-assessed
The status ladder (learning → practising → mastered) is manually controlled by the learner. The only enforcement is that level 5 requires mastered status and level > 3 requires a passed test. A learner could mark everything as mastered without any test evidence.

Past-Paper Ingestion Compatibility Analysis
The envisioned workflow:


Past paper + mark scheme
→ external AI analyses attachments
→ AI returns structured JSON
→ user pastes JSON into app
→ app validates/stores
→ student sits paper
→ student is presented with mark scheme
→ student self-marks
→ question-level results stored
→ results feed topic/error/learner analysis
What the current architecture already supports:
✅ External AI returns JSON → user pastes → app validates → stores (the entire ingestion pipeline) ✅ Exam-level results feed topic/error analysis (via the existing mergeExam path) ✅ AJV schema validation with user-friendly error messages ✅ Per-topic breakdown with ExamBreakdownEntry ✅ Error entries attached to exam results

What the current architecture CANNOT do:
❌ Store questions individually — no Question entity exists ❌ Store mark schemes — no MarkScheme or MarkCriterion entity ❌ Present a mark scheme for self-marking — no UI or data structure for this ❌ Store question-level results — only per-topic aggregates ❌ Distinguish past papers from other exams — no exam_type field ❌ "Student sits paper" within the app — the app has no exam-taking UI ❌ Connect question-level performance to topics — questions don't exist as entities ❌ Interpret past-paper performance differently — all exams are identical

Schema additions required:
The Exam type would need extension or a new entity set for:

PastPaper / ExamTemplate (the paper itself, with questions and mark scheme, BEFORE the student sits it)
Question (individual questions with text, marks available, topic association)
MarkScheme / MarkCriterion (per-question marking criteria)
QuestionAttempt / QuestionResult (student's answer + marks awarded per question)
exam_type field to distinguish past papers from AI-generated assessments
The ingestion pipeline is well-suited to extension (adding a new SchemaName is straightforward), and the validate → preview → confirm UX pattern would work for paper ingestion. But the data model needs significant additions.

Architectural Boundary Analysis
What the APPLICATION currently owns:
Responsibility	Status
Persistence (localStorage)	✅ Owns fully
Schema validation (Ajv)	✅ Owns fully
State transitions (commit, promote, toggle)	✅ Owns fully
Mark calculation (test_pass/fail from ≥80%)	✅ Owns fully
Strength/retention/health math	✅ Owns fully
Level calculation	✅ Owns fully
Event decomposition	✅ Owns fully
Timer (authoritative duration)	✅ Owns fully
Learner-state storage	✅ Owns fully
What the AI currently owns:
Responsibility	Status
Teaching (interactive tutoring)	✅ External AI
Error classification	✅ AI produces error_type + description
Confidence assessment	✅ AI provides confidence_reported
Assessment evidence	✅ AI provides difficulty/novelty/independence/transfer/quality
Course structure generation	✅ AI produces sections/topics from syllabus
Document interpretation	✅ AI interprets exam papers/syllabi
Where the boundary is blurred:
Confidence: The AI reports confidence, but it's labelled as the "learner's" confidence. Is the AI reporting what the learner said, or what the AI infers? The system trusts it either way.
Assessment evidence: The AI's difficulty/novelty/independence/transfer/quality ratings are stored verbatim and feed into Performance layer calculations. If the AI systematically over- or under-rates, there's no correction mechanism.
Error classification: The AI classifies errors as conceptual/procedural/careless/knowledge_gap. The app has no way to validate this.
Cold flag: Whether an assessment was truly "cold" (unaided, unfamiliar) depends on AI honesty. The cold flag significantly affects Performance layer metrics.
What NEITHER currently owns (gap):
Recommendation engine (no "what should I study next?" logic)
Session planning ("what should this session cover?")
Readiness assessment ("am I ready for an exam?")
Learning objective tracking
Question-level assessment
Past-paper management
Spaced repetition scheduling (topics are "due" but there's no scheduling/queue management)
Codebase Map

UI
 ├── Overview (global dashboard)
 ├── CourseDashboard (per-course)
 ├── TopicDetail (topic deep-dive)
 ├── Exams (exam results list)
 ├── Performance (performance metrics)
 ├── StartSession (pre-session setup)
 ├── FocusMode (study timer)
 ├── AddFlow (data ingestion)
 ├── QuickAdd (universal paste)
 ├── Settings (data management)
 ├── Auth (login)
 └── AppShell (navigation + layout)
Engine (pure functions, derive-don't-store)
 ├── recalculate (applyEvent, promote, strengthIncrement)
 ├── retention (R(t), isDue, projectedDue)
 ├── stability (lapseFactor, effectiveStrength)
 ├── metrics (health, OCI, badges, sub-scores)
 ├── leveling (topic levels 0-5, high-water)
 ├── course (courseHealth, velocity, projection, dueQueue)
 ├── overview (globalHealth, mastery, streaks, feed)
 ├── progress (EXP, trend, workLogged)
 ├── performance (cold, transfer, calibration, quality, novelty)
 ├── performance-view (view-models for dashboard)
 ├── session (briefing generation)
 ├── exams (exam view construction)
 ├── history (time series)
 ├── replay (historical reconstruction)
 └── prerequisites (dependency diagnostics)
AI Integration (prompts only — external execution)
 ├── coursePrompt (syllabus → course JSON)
 ├── sessionPrompt (standalone session logging)
 ├── startSessionPrompt + sessionWrapUpPrompt (live session flow)
 ├── examPrompt (exam result logging)
 └── coldAssessmentPrompt (cold assessment)
Core (infrastructure)
 ├── pipeline (ingest → commit)
 ├── merge (decompose to events)
 ├── validate (Ajv + parse)
 ├── integrity (referential checks)
 ├── storage (localStorage)
 ├── detect (schema detection)
 ├── errorTranslation (user-friendly errors)
 ├── transfer (backup/restore)
 ├── migrations (data fixes)
 └── focusDraft (session draft persistence)
Data Model
 ├── Store { courses[], exams[], sessions[] }
 ├── Course → Section[] → Topic[]
 ├── Topic → ReviewEvent[] + ErrorLogEntry[]
 ├── ReviewEvent → TestEvidence? + AssessmentEvidence?
 ├── Exam (stored in store.exams[])
 └── SessionRecord (stored in store.sessions[])
Key Relationships

