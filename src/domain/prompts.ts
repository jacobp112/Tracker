import type { Store } from './types';
import { allTopics } from './types';

/**
 * AI prompt templates — Document 1 v0.2 §8 (course) and Document 4 v0.3 §3
 * (session, exam), extended 2026-08-11 for the Performance layer's assessment
 * contract (design 2026-08-10 §16).
 *
 * These MUST stay in lockstep with the schemas in `schemas.ts`: a prompt that
 * omits fields the schema accepts leaves the corresponding feature unreachable
 * (that is exactly how the Performance layer shipped inert until this file was
 * updated), and a prompt that emits a withdrawn shape fails validation on
 * arrival. `tests/domain/prompts.test.ts` pins this seam.
 */

/**
 * The shared assessment rubric injected into the session and exam prompts. One
 * source so the two never drift. Note it deliberately EXCLUDES prediction fields
 * (`predicted_success`/`predicted_at`): a prediction emitted in the same pass as
 * the outcome is hindsight, which calibration correctly discards — genuine
 * foresight needs a predict-first interaction the app does not have yet.
 */
const ASSESSMENT_RUBRIC = `an OPTIONAL object rating HOW the attempt went, beyond raw confidence. Include ONLY the dimensions that fit what was assessed — a recall drill has difficulty but no transfer; omit anything that doesn't apply rather than inventing it. All fields are optional integers:
    - difficulty (0-5): 0 recall/recognition · 1 direct application · 2 multi-step but familiar · 3 unfamiliar application · 4 non-routine/substantial reasoning · 5 exceptionally challenging.
    - novelty (0-4): 0 essentially identical to what was practised · 1 minor variation · 2 familiar knowledge in a different presentation · 3 genuinely unfamiliar · 4 highly novel (the learner had to determine the approach). Independent of difficulty.
    - independence (0-3): 0 needed the full solution/explanation · 1 substantial hinting/scaffolding · 2 a minor hint/prompt · 3 completely independent. Judge honestly — a correct answer reached with help is NOT independent.
    - transfer_level (0-3): 0 could not apply it beyond the original context · 1 transferred with prompting · 2 transferred independently · 3 independently transferred AND generalised/adapted it. Independent of novelty.
    - performance_quality (0-5): overall quality across whatever dimensions fit the subject (correctness, reasoning, method selection, clarity, communication) — not correctness alone.
    - quality_rationale: one short sentence justifying performance_quality. Optional.
  Do NOT include any prediction field — a judgement made after seeing the outcome is not a prediction. Omit the whole assessment object for a topic you cannot judge this way.`;

export function coursePrompt(store: Store): string {
  const existing = allTopics(store)
    .map(({ topic, course }) => `${topic.topic_id} → ${topic.title} (${course.title})`)
    .join('\n');
  const crossCourseBlock = existing
    ? `\n\nEXISTING topics already in the tracker — you MAY cite any of these topic_ids as a prerequisite when this new course genuinely builds on that already-tracked material. Do NOT redefine them; only reference their ids.\n${existing}`
    : '';
  const crossCourseClause = existing
    ? ' When this course builds on material from another already-tracked course, you may also cite that course\'s topic_id.'
    : '';

  return `You are converting a course syllabus into a structured JSON object for a study tracker. Output only valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.

Schema (v3.2.0):
- Root: {schema_version, course_id, title, created_at, source, sections[]}
- schema_version: always "3.2.0".
- course_id: generate as course_ followed by a random 10-character alphanumeric string.
- created_at: ISO 8601 UTC, now.
- source: always "ai_generated".
- Each section: {section_id, title, order, topics[]}. section_id follows the same random-suffix pattern with prefix section_. order is 0-indexed.
- Each topic: {topic_id, title, status, conf, strength, k_factor, cards, last_reviewed, drift_history, review_history, error_log, prerequisites}.
  - topic_id: prefix topic_.
  - status: always "not_started" for a fresh syllabus.
  - conf: always 1. (Confidence is a 1-5 scale, not a percentage.)
  - strength: always 0.
  - k_factor: always 8.4.
  - cards: always 0.
  - last_reviewed: always null.
  - drift_history, review_history, error_log: always empty arrays [].
  - prerequisites: OPTIONAL array of topic_id values this topic depends on — the upstream concepts to master first. Reference topic_ids you define in THIS course.${crossCourseClause} Use [] or omit if none. This lets the tracker trace whether errors in a topic stem from shaky foundations upstream.

Break the syllabus into sections matching its natural structure (chapters/weeks/units), and topics matching individual concepts/skills within each section — granular enough that a topic represents something masterable in a single study session, not an entire chapter. Where the syllabus implies a dependency (B builds on A), record it in B's prerequisites.${crossCourseBlock}

Here is the syllabus: [PASTE SYLLABUS HERE]`;
}

/** Document 4 §3.1 — the app injects the active course id and topic list. */
export function sessionPrompt(courseId: string, topics: Array<{ topic_id: string; title: string }>): string {
  const list = topics.map((t) => `${t.topic_id} → ${t.title}`).join('\n');
  return `You are logging a completed study session into a tracker. Output only valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.

Schema (v3.2.0), Study Session:
- Root: {schema_version, session_id, course_id, date, duration_minutes, topics_covered[]}
- schema_version: "3.2.0". session_id: session_ + 10 random alphanumeric chars. date: ISO 8601 UTC now. course_id: "${courseId}".
- Each topics_covered[] entry: {topic_id, confidence_reported, notes, errors[], assessment}
  - topic_id: must be one of the topic IDs from the course below.
  - confidence_reported: integer 1-5 (1 = could not recall it, 3 = shaky but getting there, 5 = fluent and confident). This is NOT a percentage — 80 is invalid.
  - notes: short freetext, <= 500 chars, optional.
  - errors[]: for each mistake, {error_type, description} where error_type is one of conceptual | procedural | careless | knowledge_gap. Empty array if none.
  - assessment: ${ASSESSMENT_RUBRIC}

Only include topics actually covered this session. Be honest with confidence AND with the assessment — inflated numbers corrupt the learner's review schedule, and overstating independence or difficulty makes practice look stronger than it was.

Course topics (id → title):
${list}

Session transcript / summary: [LEARNER OR AI PASTES SESSION CONTENT]`;
}

/** Document 4 §3.2 — the full cross-course topic list is injected. */
export function examPrompt(store: Store): string {
  const list = allTopics(store)
    .map(({ topic, course }) => `${topic.topic_id} → ${topic.title} (${course.title})`)
    .join('\n');

  return `You are converting exam/test results into JSON for a study tracker. Output only valid JSON matching this exact schema — no fences, no commentary, no extra fields.

Schema (v3.2.0), Exam:
- Root: {schema_version, exam_id, title, date, linked_topic_ids[], score, max_score, confidence_reported, cold, breakdown[]}
- schema_version: "3.2.0". exam_id: exam_ + 10 random alphanumeric chars.
- linked_topic_ids: every topic this exam tested — may span multiple courses.
- confidence_reported: integer 1-5, how confident the learner felt sitting it (not a percentage). Optional, but without it this exam contributes nothing to calibration.
- cold: OPTIONAL boolean. Set true ONLY if this was sat cold — unaided, on unfamiliar items, with no notes, hints, or topic labels. Applies to every linked topic unless a per-topic assessment.cold overrides it. (For a normal revised exam, omit it.)
- breakdown[] (include if you can attribute marks to topics): each {topic_id, points_earned, points_possible, confidence_reported, errors[], assessment}, errors as {error_type, description}. Per-topic confidence_reported is optional and overrides the exam-level value.
  - assessment: ${ASSESSMENT_RUBRIC}
- If you cannot break marks down by topic, omit breakdown — the tracker will apply the overall score to all linked topics.
- Do NOT report whether a topic passed or failed; the tracker derives that from the marks.

Available topics across all courses (id → title):
${list}

Exam details: [USER PASTES SCORES / MARKED PAPER]`;
}

/**
 * Cold-assessment prompt (design §7) — the entry the app had no way to produce.
 * A cold assessment measures performance on unfamiliar material with no support,
 * so it must be RUN cold, then reported as an exam with `cold: true`. The UI
 * entry point that surfaces this prompt is deferred to the UI reintegration
 * (AddFlow is in the stashed redesign); the template itself lives here so it is
 * ready and stays in lockstep with the schema.
 */
export function coldAssessmentPrompt(store: Store): string {
  const list = allTopics(store)
    .map(({ topic, course }) => `${topic.topic_id} → ${topic.title} (${course.title})`)
    .join('\n');

  return `You are running a COLD assessment and reporting the result as JSON for a study tracker. Run it cold: present items WITHOUT telling the learner which topic each belongs to, give NO hints, worked steps, or feedback until the end, allow NO notes or resources, and require an independent attempt. Prefer items and phrasings the learner has not seen before. This measures how well they use knowledge unaided on unfamiliar material — inflating it defeats its purpose.

Output only valid JSON matching this exact schema — no fences, no commentary, no extra fields.

Schema (v3.2.0), Exam (cold):
- Root: {schema_version, exam_id, title, date, linked_topic_ids[], score, max_score, cold, breakdown[]}
- schema_version: "3.2.0". exam_id: exam_ + 10 random alphanumeric chars. title: e.g. "Cold check — <area>". date: ISO 8601 UTC now.
- cold: true.  (This is what marks the result cold — do not set it false here.)
- linked_topic_ids: the topics the items actually tested.
- score / max_score: total marks earned / available.
- breakdown[]: per topic {topic_id, points_earned, points_possible, assessment}, where assessment is ${ASSESSMENT_RUBRIC}
  Since this was sat unaided, independence should be 3 for genuinely independent items; novelty and difficulty should reflect how unfamiliar and hard each item was.
- Do NOT report pass/fail; the tracker derives it from the marks.

Available topics (id → title):
${list}

Cold assessment items and the learner's responses: [PASTE THE COLD ASSESSMENT + RESPONSES]`;
}
