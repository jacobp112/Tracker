import type { Store } from './types';
import { allTopics } from './types';

/**
 * AI prompt templates — Document 1 v0.2 §8 (course) and Document 4 v0.3 §3
 * (session, exam, auto-repair).
 *
 * These must stay in lockstep with the schemas in `schemas.ts`: a prompt that
 * emits the withdrawn v0.1 shape produces JSON that fails validation on arrival
 * (Document 4 v0.3 changelog).
 */

export const COURSE_PROMPT = `You are converting a course syllabus into a structured JSON object for a study tracker. Output only valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.

Schema (v2.0.0):
- Root: {schema_version, course_id, title, created_at, source, sections[]}
- schema_version: always "2.0.0".
- course_id: generate as course_ followed by a random 10-character alphanumeric string.
- created_at: ISO 8601 UTC, now.
- source: always "ai_generated".
- Each section: {section_id, title, order, topics[]}. section_id follows the same random-suffix pattern with prefix section_. order is 0-indexed.
- Each topic: {topic_id, title, status, conf, strength, k_factor, cards, last_reviewed, drift_history, review_history, error_log}.
  - topic_id: prefix topic_.
  - status: always "not_started" for a fresh syllabus.
  - conf: always 1. (Confidence is a 1-5 scale, not a percentage.)
  - strength: always 0.
  - k_factor: always 8.4.
  - cards: always 0.
  - last_reviewed: always null.
  - drift_history, review_history, error_log: always empty arrays [].

Break the syllabus into sections matching its natural structure (chapters/weeks/units), and topics matching individual concepts/skills within each section — granular enough that a topic represents something masterable in a single study session, not an entire chapter.

Here is the syllabus: [PASTE SYLLABUS HERE]`;

/** Document 4 §3.1 — the app injects the active course id and topic list. */
export function sessionPrompt(courseId: string, topics: Array<{ topic_id: string; title: string }>): string {
  const list = topics.map((t) => `${t.topic_id} → ${t.title}`).join('\n');
  return `You are logging a completed study session into a tracker. Output only valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.

Schema (v2.0.0), Study Session:
- Root: {schema_version, session_id, course_id, date, duration_minutes, topics_covered[]}
- schema_version: "2.0.0". session_id: session_ + 10 random alphanumeric chars. date: ISO 8601 UTC now. course_id: "${courseId}".
- Each topics_covered[] entry: {topic_id, confidence_reported, notes, errors[]}
  - topic_id: must be one of the topic IDs from the course below.
  - confidence_reported: integer 1-5 (1 = could not recall it, 3 = shaky but getting there, 5 = fluent and confident). This is NOT a percentage — 80 is invalid.
  - notes: short freetext, <= 500 chars, optional.
  - errors[]: for each mistake, {error_type, description} where error_type is one of conceptual | procedural | careless | knowledge_gap. Empty array if none.

Only include topics actually covered this session. Be honest with confidence — inflated numbers corrupt the learner's review schedule.

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

Schema (v2.0.0), Exam:
- Root: {schema_version, exam_id, title, date, linked_topic_ids[], score, max_score, confidence_reported, breakdown[]}
- schema_version: "2.0.0". exam_id: exam_ + 10 random alphanumeric chars.
- linked_topic_ids: every topic this exam tested — may span multiple courses.
- confidence_reported: integer 1-5, how confident the learner felt sitting it (not a percentage). Optional, but without it this exam contributes nothing to calibration.
- breakdown[] (include if you can attribute marks to topics): each {topic_id, points_earned, points_possible, confidence_reported, errors[]}, errors as {error_type, description}. Per-topic confidence_reported is optional and overrides the exam-level value.
- If you cannot break marks down by topic, omit breakdown — the tracker will apply the overall score to all linked topics.
- Do NOT report whether a topic passed or failed; the tracker derives that from the marks.

Available topics across all courses (id → title):
${list}

Exam details: [USER PASTES SCORES / MARKED PAPER]`;
}
/** Document 4 §3.4 — running. `pace_sec_per_km` is intentionally omitted; the
 *  app computes it on ingestion (Document 1 §5.1). */
export const RUNNING_PROMPT = `You are logging a run into a tracker. Output only valid JSON matching this schema — no fences, no commentary, no extra fields.

{schema_version: "2.0.0", activity_id: "activity_" + 10 random alphanumeric characters, date: "YYYY-MM-DD", distance_km: number, duration_seconds: integer, type: one of "easy" | "tempo" | "long" | "interval" | "race", notes: optional string}

Do NOT include pace_sec_per_km — the tracker computes it from distance and duration.

Run details: [PASTE YOUR RUN HERE]`;

/** Document 4 §3.4 — lifting. Sets stay as an array (Document 1 §5.2). */
export const LIFTING_PROMPT = `You are logging a lifting session. Output only valid JSON matching this schema — no fences, no commentary, no extra fields.

{schema_version: "2.0.0", session_id: "session_" + 10 random alphanumeric characters, date: "YYYY-MM-DD", exercises: [{exercise_name, sets: [{set_number, reps, weight_kg, rpe}]}]}

Weights are in kg. rpe (1-10) is optional. Keep each set as its own entry — do not collapse sets into a total.

Session details: [PASTE YOUR WORKOUT HERE]`;

/*
 * The auto-repair prompt (Document 4 §3.3) is deliberately NOT here. Auto-repair
 * is deferred (Document 4 E2-S5) and the app makes no AI calls, so a repair
 * prompt in the codebase would be dead code drifting out of sync with the
 * schemas. The template is specified in Document 4 §3.3; if it is ever picked
 * up, `ingest()` is already the single entry point a repair loop would call.
 */
