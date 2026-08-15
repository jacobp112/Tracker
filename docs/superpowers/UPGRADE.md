Now that you have fully mapped the current codebase, I want you to move to the **architecture/design phase**.

Do not implement anything yet.

Your task is to design how Cairn/Tracker should evolve from the current system into a learning system that can make informed decisions about:

* what the learner should study,
* when they should move on,
* when they should sit an assessment,
* what assessments actually mean,
* what errors need remediation,
* and what the learner should do next.

The design must be **general-purpose across GCSEs, A-levels, and other subjects**. Do not design something that is overly tailored to mathematics.

The existing architecture, particularly the local-first/event-derived model, should be respected where sensible rather than discarded unnecessarily.

---

# 1. First principles

The central product principle should become:

> **The application should maintain the learner's state and make deterministic decisions from evidence; the external AI should teach, interpret documents, and produce structured observations, but should not become the source of truth for learner state.**

We currently have a strong local-first architecture, but the system lacks enough structured evidence to make good decisions.

We therefore need to determine what additional evidence the application needs to collect.

Do not simply add fields because they are convenient.

For every proposed entity or field, explain:

* what decision it enables,
* what evidence produces it,
* who owns it,
* whether it is persisted or derived,
* and whether it can become stale.

---

# 2. Design the assessment model properly

This is one of the most important changes.

The current `Exam` object is really an **exam result**, rather than an assessment itself.

We need to distinguish between:

### A. Assessment definition

The thing the learner is going to sit.

For example:

* AQA A-level Mathematics Paper 1
* GCSE Biology past paper
* AI-generated topic test
* Diagnostic assessment
* Custom revision test

### B. Assessment attempt

A particular time the learner sits that assessment.

### C. Assessment result

What the learner achieved.

These may or may not need to be separate persisted entities depending on your architectural recommendation, but the conceptual distinction must exist.

---

# 3. Past-paper workflow — HARD REQUIREMENT

The following workflow must be supported:

```text
USER HAS:
  Past paper PDF/image/document
  +
  Mark scheme PDF/image/document

        ↓

CAIRN PROVIDES:
  A carefully constructed prompt for an external AI
  with instructions for analysing the attachments

        ↓

EXTERNAL AI:
  Reads the past paper + mark scheme
  Identifies the assessment structure
  Identifies individual questions
  Identifies marks
  Identifies subparts
  Identifies mark-scheme criteria
  Identifies likely topic associations
  Produces structured JSON

        ↓

USER:
  Pastes the JSON into Cairn

        ↓

CAIRN:
  Detects schema
  Validates
  Performs integrity checks
  Shows preview
  User confirms

        ↓

CAIRN STORES:
  The assessment definition

        ↓

USER:
  Is presented with the assessment
  and/or instructed to sit the physical/external paper

        ↓

USER SITS:
  The actual past paper

        ↓

USER:
  Returns to Cairn

        ↓

CAIRN:
  Presents the relevant mark scheme
  Question by question

        ↓

USER:
  Self-marks their work

        ↓

CAIRN STORES:
  Question-level marks/results

        ↓

CAIRN:
  Maps performance to:
    questions
    mark-scheme criteria
    topics
    errors
    assessment evidence

        ↓

LEARNER STATE:
  Is updated from the resulting evidence
```

This workflow is fundamentally different from the current:

```text
Exam → aggregate score → smear score across topics
```

The new architecture should preserve the existing aggregate exam functionality where useful, but should make **question-level evidence the preferred source of truth whenever it exists**.

---

# 4. Past papers vs AI-generated exams

The system must explicitly distinguish assessment provenance.

At minimum, investigate a model capable of representing:

* `past_paper`
* `ai_generated`
* `diagnostic`
* `custom`

Do not blindly use these exact values if a better abstraction exists.

Explain:

### What changes based on provenance?

For example:

#### Past paper

Usually:

* externally authored
* fixed difficulty
* fixed mark scheme
* authentic exam conditions
* historically valid assessment
* potentially highly valuable evidence

#### AI-generated assessment

Usually:

* generated for the learner
* potentially adaptive
* difficulty may be estimated rather than authoritative
* question quality is less certain
* may be better for formative diagnosis than formal benchmarking

#### Diagnostic assessment

May deliberately sample breadth rather than assess mastery comprehensively.

The system should therefore not treat:

> "80% on an AI-generated practice test"

as automatically equivalent evidence to:

> "80% on an official past paper."

Design a principled evidence model rather than arbitrary multipliers.

---

# 5. Questions need to become first-class data

Design the minimum viable question model.

A question may contain:

* question ID
* question number/label
* parent question
* subpart
* question text or reference
* marks available
* topic IDs
* potentially multiple topic associations
* learning objective(s), if we introduce them
* mark scheme
* difficulty
* provenance
* metadata required for analysis

Be careful with storing large document text in localStorage.

Consider whether the actual paper/mark scheme should be stored locally, referenced, or represented in a compact structured form.

The user must ultimately be able to navigate the assessment and its mark scheme even if the original external AI conversation disappears.

---

# 6. Mark schemes

Design a general mark-scheme representation.

It must support the reality that marking schemes can contain:

* individual marks
* method marks
* accuracy marks
* follow-through marks
* alternative acceptable answers
* conditions
* qualitative criteria
* multiple criteria for one question
* subpart-specific criteria

Do NOT design this solely around mathematical mark schemes.

The system must also be capable of representing subjects such as:

* English
* History
* Biology
* Economics
* Computer Science
* Geography

where marking may be rubric/criterion based rather than simply "one mark per line".

Determine what should be stored structurally versus what should remain human-readable instructions.

---

# 7. Self-marking UX

Design the workflow for the learner after they sit the assessment.

The learner should be able to:

1. Open the assessment.
2. See each question/subquestion.
3. Record the marks they awarded themselves.
4. View the relevant mark-scheme criteria.
5. Understand why a mark is or isn't awarded.
6. Optionally record an error/reasoning issue.
7. Move through the paper efficiently.
8. Finish with an automatically calculated result.

Consider whether the UI should show:

* question
* marks available
* mark scheme
* learner mark
* percentage
* topic mapping
* error classification
* notes

Do not overwhelm the marking interface.

The primary task is:

> **"Mark my paper accurately and quickly."**

---

# 8. Question → topic mapping

This is critical.

The external AI should identify likely topic associations during past-paper ingestion.

However, the application must not blindly trust those associations.

Design a system where:

* AI proposes mappings.
* The application validates referenced topic IDs.
* The user can inspect/correct mappings.
* Multiple topics can be associated with a question where appropriate.
* A question can have a primary topic and secondary topics if useful.

Think carefully about how marks should contribute when a question spans multiple topics.

Avoid the current "smear the score uniformly across all linked topics" behaviour when question-level evidence exists.

Explain what should happen instead.

---

# 9. Learning objectives

The current system has no learning objectives.

Determine whether we actually need them.

Do not introduce learning objectives simply because they sound useful.

Ask:

> Can the system make sufficiently good recommendations from topics + questions + errors + assessment evidence?

If yes, keep learning objectives optional.

If learning objectives materially improve:

* question mapping,
* error diagnosis,
* assessment coverage,
* progression decisions,
* or recommendations,

then design the minimum viable representation.

It should remain subject-agnostic.

---

# 10. Session redesign

The current session model records what happened after the fact, but does not explicitly represent what the learner was supposed to achieve.

Design a better conceptual session lifecycle:

```text
Recommendation
    ↓
Session plan
    ↓
AI teaching / practice
    ↓
Learner interaction
    ↓
Session evidence
    ↓
Evaluation
    ↓
Updated learner state
    ↓
Next recommendation
```

Determine what needs to be stored for a session plan.

Potential examples:

* target topics
* target errors
* learning objectives
* intended activity
* expected evidence
* reason for session
* prerequisites
* assessment preparation
* estimated duration

But only introduce fields that materially enable decisions.

---

# 11. What should happen after a session?

This is a major product requirement.

After a session, Cairn should be able to answer:

> **"What should this learner do next?"**

Potential outcomes include:

```text
Continue learning
↓
Practise
↓
Remediate
↓
Review later
↓
Sit topic assessment
↓
Sit broader assessment
↓
Move to next topic
```

Design the decision engine that chooses between these.

It should use evidence such as:

* session outcome
* confidence
* errors
* error severity
* repeated errors
* retention
* assessment performance
* assessment provenance
* question-level performance
* prerequisite state
* time since last evidence
* topic importance/position in course
* previous attempts
* cold performance
* transfer performance
* calibration
* recent learning velocity

Do not simply create a giant weighted score.

We need interpretable decision rules or a hierarchical decision system where possible.

For example:

```text
UNRESOLVED CRITICAL ERROR?
    → remediate

FOUNDATIONAL PREREQUISITE WEAK?
    → prerequisite remediation

RECENTLY LEARNED BUT NOT VERIFIED?
    → retrieval/practice

SUFFICIENT PRACTICE + STABLE RETENTION?
    → assessment

ASSESSMENT PASSED WITH GOOD EVIDENCE?
    → progress

ASSESSMENT FAILED?
    → diagnose → remediate → reassess
```

This is only illustrative. Design the actual system.

---

# 12. Recommendation engine

Design a recommendation engine that produces explicit recommended actions.

A recommendation should answer:

```text
WHAT should I do?
WHY should I do it?
HOW urgent is it?
WHEN should I do it?
WHAT evidence caused this recommendation?
```

For example:

```text
Remediate:
  "Quadratic inequalities"

Reason:
  "You made the same conceptual error in two recent attempts."

Urgency:
  HIGH

Recommended:
  TODAY

Estimated duration:
  25 minutes
```

Recommendations should be derived rather than manually stored where possible.

If recommendations are persisted, explain why.

---

# 13. Error urgency

We specifically need to answer:

> **Which errors need cleaning up today, tomorrow, next week, or can wait?**

Design an urgency model.

Do NOT make urgency simply equal to age.

Consider factors such as:

### Severity

How damaging is the error?

### Recurrence

How many times has the learner made it?

### Recency

How recently did it occur?

### Foundationality

Does it underpin other topics?

### Assessment proximity

Is an assessment approaching?

### Topic importance

Is the topic central to the course?

### Current retention

Will the learner forget the underlying concept soon?

### Resolution confidence

Has the error actually been demonstrated as fixed?

### Consequence

Does the error cause downstream mistakes?

We need an interpretable urgency classification such as:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

and/or a temporal recommendation:

```text
TODAY
WITHIN 48 HOURS
THIS WEEK
NEXT REVIEW CYCLE
```

Explain the difference between **severity** and **urgency**.

They should not necessarily be the same thing.

---

# 14. Error resolution must become evidence-based

The current system has:

```text
resolved: boolean
```

This is insufficient.

A learner checking "resolved" does not prove an error is fixed.

Design an improved lifecycle:

```text
Detected
↓
Active
↓
Remediation attempted
↓
Verification required
↓
Verified resolved
```

Potential verification evidence:

* successful retrieval
* successful similar question
* successful independent question
* successful cold question
* successful exam question
* repeated success over time

Do not require all of these.

Determine what evidence should be sufficient.

The system should distinguish:

> "I marked this error resolved"

from:

> "The system has evidence that this error has been resolved."

---

# 15. What gets sent to the AI tutor?

This needs to become much more deliberate.

The tutor should not receive the entire database.

Design a **Tutor Context** that is generated by the application.

It should contain only information relevant to the current teaching task.

For example:

```text
Current objective
Target topics
Relevant learner state
Relevant unresolved errors
Recent evidence
Known misconceptions
Prerequisites
Reason for session
Expected outcome
Assessment context
Recommended teaching strategy
```

The application remains the source of truth.

The AI receives a curated snapshot.

Explain exactly what should and should not be included.

---

# 16. What should the AI return?

Design a structured session outcome schema.

It should allow the AI to report things such as:

* topics actually covered
* concepts demonstrated
* learner confidence
* observed errors
* error classifications
* evidence of understanding
* questions attempted
* question outcomes
* suggested follow-up
* assessment evidence
* uncertainty

Critically:

> AI recommendations should be treated as observations/recommendations, not authoritative changes to learner state.

The application should decide how those observations affect the learner model.

---

# 17. Assessment evidence model

The current `AssessmentEvidence` is promising but needs to be integrated into the larger architecture.

Determine how evidence should distinguish:

* practice
* guided practice
* independent practice
* cold retrieval
* past-paper assessment
* AI-generated assessment
* diagnostic assessment
* transfer task

Think about evidence quality.

For example, a learner getting a question right after being shown the method is not equivalent to independently solving a cold question.

Design a coherent evidence hierarchy.

---

# 18. Readiness to assess

Design a readiness engine.

Cairn should eventually be able to say:

> "You are ready to sit this assessment."

or:

> "You should not sit this assessment yet."

The decision should consider:

* coverage
* prerequisite health
* recent retrieval
* practice performance
* cold performance
* unresolved high-severity errors
* assessment history
* retention
* confidence calibration
* question-level evidence
* whether the assessment is a past paper or formative AI assessment

Do not make this a single arbitrary percentage threshold.

It should be explainable.

The user should be able to see **why** they are or aren't ready.

---

# 19. Past-paper evidence should be especially valuable

Think carefully about the evidence hierarchy.

Official past papers may provide unusually strong evidence because:

* they are externally authored,
* their difficulty is known,
* they reflect the actual specification,
* their mark schemes are authoritative,
* they represent authentic assessment conditions.

However, a past paper should only be considered strong evidence if the learner actually sat it under appropriate conditions.

Therefore consider metadata such as:

* timed/untimed
* open-book/closed-book
* assistance used
* hints used
* AI used
* mark scheme viewed beforehand
* sitting conditions
* cold/independent status

The system should be able to distinguish:

> "I scored 82% on a past paper independently under timed conditions"

from:

> "I scored 82% while revising with the mark scheme open."

These are not equivalent evidence.

---

# 20. Recommendations must explain themselves

Every recommendation shown to the user should be explainable.

Avoid:

> "Study Topic X."

Prefer:

> **Study Topic X**
>
> Your last two attempts contained the same conceptual error, and the prerequisite topic is currently below the recommended retention threshold.
>
> **Priority:** High
> **Recommended:** Today
> **Estimated time:** 25 min

The user should never feel that the system is arbitrarily telling them what to do.

---

# 21. Dashboard implications

Determine how the dashboard should evolve.

We likely need a central:

## "What should I do next?"

area.

It should surface the highest-value actions rather than simply displaying statistics.

Potential structure:

```text
NEXT ACTION
────────────────────
Remediate: X
Why: ...
Priority: HIGH
~25 min

THEN
────────────────────
Review: Y
Due: Tomorrow
~15 min

UPCOMING
────────────────────
Past paper: A
Readiness: 82%
Recommended: Friday
```

Also consider:

* urgent errors
* upcoming assessments
* readiness
* recently resolved errors awaiting verification
* topics ready to progress
* overdue reviews

Do not allow the dashboard to become cluttered.

---

# 22. Preserve the existing strengths

Do not throw away the current architecture unnecessarily.

The following are valuable and should be retained unless there is a compelling reason otherwise:

* local-first operation
* event-derived metrics
* Ajv validation
* ingestion pipeline
* preview → confirm workflow
* deterministic application-owned calculations
* retention model
* performance layer
* prerequisite graph
* external-AI workflow
* backup/restore
* schema migrations

The design should extend these rather than replacing them wholesale.

---

# 23. LocalStorage constraint

The current system stores everything in one localStorage key.

As part of this design, explicitly analyse whether the new assessment model will make this untenable.

Past papers can contain:

* many questions
* substantial mark schemes
* question text
* metadata
* attempts
* marking records

Do not simply assume localStorage can hold this indefinitely.

Design options such as:

* IndexedDB
* compact structured representations
* external document references
* hybrid storage

if appropriate.

However, do not introduce a backend merely because it is conventional.

The application is intentionally local-first.

---

# 24. Migration strategy

The current application already has users/data.

Design how the new model can coexist with existing data.

Existing records include:

* exams without questions
* exam results without assessment definitions
* sessions without explicit plans
* errors without recurrence identity
* review events without question evidence

Determine:

* what can be migrated,
* what must remain legacy,
* what should be inferred,
* what should explicitly remain unknown.

**Never invent historical evidence.**

For example, an old exam with only:

```text
82%
```

must not suddenly become a question-level assessment.

It should remain an aggregate historical result.

---

# 25. Schema/version strategy

Design the schema evolution.

The current schema is:

```text
3.2.0
```

Recommend the conceptual next version(s).

Explain:

* which new schemas/entities are required,
* which existing schemas change,
* how backward compatibility works,
* how migrations should behave.

Do not implement migrations yet.

---

# 26. Design deliverable

Your response should now contain:

## A. Target architecture

How the new system fits into the current architecture.

## B. Domain model

All proposed entities and relationships.

## C. Assessment model

Assessment definition → attempt → result.

## D. Past-paper ingestion model

Exact lifecycle from document → AI → JSON → validation → stored assessment.

## E. Mark scheme model

How marking criteria are represented across different subjects.

## F. Question model

Question/subquestion representation and topic mapping.

## G. Session model

Plan → teaching → evidence → outcome.

## H. Learner evidence model

How different forms of evidence contribute to learner state.

## I. Error model

Detection → urgency → remediation → verification.

## J. Recommendation engine

How "what should I do next?" is determined.

## K. Readiness engine

How assessment readiness is determined.

## L. Tutor context

Exactly what information the application sends to the external AI.

## M. Tutor output

Exactly what structured information the AI should return.

## N. Dashboard/UX

How the user experiences the new system.

## O. Storage architecture

Whether localStorage remains viable and what should change.

## P. Migration strategy

How existing 3.2.0 data survives.

## Q. Implementation phases

Break the work into sensible implementation phases.

For example:

```text
Phase 1 — Domain/schema foundation
Phase 2 — Past-paper ingestion
Phase 3 — Assessment sitting/self-marking
Phase 4 — Question-level evidence
Phase 5 — Error intelligence
Phase 6 — Session planning
Phase 7 — Recommendation engine
Phase 8 — Readiness engine
Phase 9 — Dashboard/UX
Phase 10 — Migration/hardening
```

But choose the actual phases yourself.

---

# Most important constraint

**Do not implement anything in this step.**

I want an architectural design document that is grounded in the actual codebase you just inspected.

Where there are competing design options:

1. Explain the options.
2. Give your recommendation.
3. Explain why.
4. Consider the consequences for the existing event-sourced architecture.

Do not over-engineer.

The objective is not to build an academic LMS.

The objective is to make Cairn exceptionally good at answering one question:

> **"Given everything this learner has done and everything we know about their current state, what is the highest-value thing they should do next?"**

And the assessment system must provide sufficiently granular, trustworthy evidence for that decision.

**Stop after producing the design. Do not modify the codebase.**
