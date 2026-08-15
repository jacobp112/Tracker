import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ASSESSMENT_DEF_SCHEMA } from '@/domain/schemas';
import type { AssessmentDefinition } from '@/domain/assessment';
import type { AssessmentRef, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import type { AssessmentRepo } from './assessment-store';
import type { FriendlyError } from './errorTranslation';
import { parseJson } from './validate';

/**
 * Past-paper ingestion (design §D, Phase 7). A PARALLEL pipeline to the study
 * pipeline — same shape (parse → validate → integrity → preview → confirm) — but
 * definitions persist to IndexedDB (via commitAssessmentDef), never the
 * localStorage Store. Its own Ajv instance keeps it fully decoupled from the
 * course/session/exam SchemaName machinery.
 */

const ajv = new Ajv({ allErrors: true, strict: false, verbose: true });
addFormats(ajv);
const validateDef = ajv.compile(ASSESSMENT_DEF_SCHEMA);

const TOL = 0.001; // marks/weights are floats; compare with a small tolerance

export interface AssessmentPreview {
  summary: string;
  detail: string[];
}

export type AssessmentIngestResult =
  | { ok: true; value: AssessmentDefinition; preview: AssessmentPreview }
  | { ok: false; errors: FriendlyError[] };

/**
 * Integrity for a definition (design §D step 5): question ids unique, parent
 * references resolve, every proposed topic mapping resolves against the tracker,
 * per-question topic weights sum to 1, and marks reconcile (criteria→question,
 * subparts→parent, leaves→max_marks). AI proposals are validated, never trusted.
 */
function checkAssessmentIntegrity(def: AssessmentDefinition, store: Store): FriendlyError[] {
  const errors: FriendlyError[] = [];
  const topicIds = new Set(allTopics(store).map(({ topic }) => topic.topic_id));
  const byId = new Map(def.questions.map((q) => [q.question_id, q]));
  const seen = new Set<string>();
  const childrenMarks = new Map<string, number>();

  def.questions.forEach((q, i) => {
    if (seen.has(q.question_id)) errors.push({ path: `/questions/${i}/question_id`, message: `Two questions share the id '${q.question_id}'.` });
    seen.add(q.question_id);

    if (q.parent_question_id && !byId.has(q.parent_question_id)) {
      errors.push({ path: `/questions/${i}/parent_question_id`, message: `Question '${q.label}' references a parent '${q.parent_question_id}' that isn't in this paper.` });
    }
    if (q.parent_question_id) childrenMarks.set(q.parent_question_id, (childrenMarks.get(q.parent_question_id) ?? 0) + q.marks_available);

    q.topic_mappings.forEach((m, j) => {
      if (!topicIds.has(m.topic_id)) {
        errors.push({ path: `/questions/${i}/topic_mappings/${j}`, message: `Question '${q.label}' maps to topic '${m.topic_id}', which isn't in your tracker.` });
      }
    });
    if (q.topic_mappings.length > 0) {
      const sum = q.topic_mappings.reduce((a, m) => a + m.weight, 0);
      if (Math.abs(sum - 1) > TOL) {
        errors.push({ path: `/questions/${i}/topic_mappings`, message: `Question '${q.label}' topic weights sum to ${sum.toFixed(2)}, not 1.` });
      }
    }
    if (Math.abs(q.mark_scheme.total_marks - q.marks_available) > TOL) {
      errors.push({ path: `/questions/${i}/mark_scheme`, message: `Question '${q.label}' mark scheme totals ${q.mark_scheme.total_marks} marks but the question is worth ${q.marks_available}.` });
    }
  });

  for (const [pid, sum] of childrenMarks) {
    const parent = byId.get(pid);
    if (parent && Math.abs(parent.marks_available - sum) > TOL) {
      errors.push({ path: '/questions', message: `Question '${parent.label}' is worth ${parent.marks_available} marks but its subparts total ${sum}.` });
    }
  }

  const leafSum = def.questions
    .filter((q) => !childrenMarks.has(q.question_id))
    .reduce((a, q) => a + q.marks_available, 0);
  if (Math.abs(leafSum - def.max_marks) > TOL) {
    errors.push({ path: '/max_marks', message: `Question marks total ${leafSum}, but the paper's max_marks is ${def.max_marks}.` });
  }

  return errors;
}

function buildPreview(def: AssessmentDefinition): AssessmentPreview {
  const mapped = def.questions.filter((q) => q.topic_mappings.length > 0).length;
  const unmapped = def.questions.length - mapped;
  return {
    summary: `${def.title} — ${def.questions.length} questions, ${def.max_marks} marks, ${mapped} mapped${unmapped ? ` (${unmapped} unmapped)` : ''}`,
    detail: def.questions.map((q) => `${q.label} · ${q.marks_available} marks · ${q.topic_mappings.map((m) => m.topic_id).join(', ') || 'unmapped'}`),
  };
}

export function ingestAssessmentDef(input: string, store: Store): AssessmentIngestResult {
  const parsed = parseJson(input);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };

  if (!validateDef(parsed.value)) {
    const errs: FriendlyError[] = (validateDef.errors ?? []).map((e) => ({
      path: e.instancePath,
      message: `${e.instancePath || 'The assessment'} ${e.message ?? 'is invalid'}.`,
    }));
    return { ok: false, errors: errs.length ? errs : [{ path: '', message: "This assessment definition didn't match the expected shape." }] };
  }

  const def = parsed.value as AssessmentDefinition;
  const integrity = checkAssessmentIntegrity(def, store);
  if (integrity.length > 0) return { ok: false, errors: integrity };

  return { ok: true, value: def, preview: buildPreview(def) };
}

/** The compact reference kept in the localStorage Store (design §O) so the
 *  synchronous hot path can reason about this assessment without IndexedDB. Only
 *  CONFIRMED-mapping topics — those the assessment actually certifies. */
export function toAssessmentRef(def: AssessmentDefinition): AssessmentRef {
  const topic_ids = [
    ...new Set(def.questions.flatMap((q) => q.topic_mappings.filter((m) => m.confirmed).map((m) => m.topic_id))),
  ];
  return {
    assessment_id: def.assessment_id,
    title: def.title,
    provenance: def.provenance,
    topic_ids,
    max_marks: def.max_marks,
    created_at: def.created_at,
  };
}

/** Commit a validated definition to the assessment repo (IndexedDB). */
export async function commitAssessmentDef(def: AssessmentDefinition, repo: AssessmentRepo): Promise<void> {
  await repo.putDefinition(def);
}

/** The carefully-constructed prompt for the external AI (design §D step 2). */
export function pastPaperIngestPrompt(store: Store): string {
  const list = allTopics(store).map(({ topic, course }) => `${topic.topic_id} → ${topic.title} (${course.title})`).join('\n');
  return `You are converting a PAST PAPER plus its MARK SCHEME into a structured JSON assessment definition for a study tracker. Read both documents. Output only valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.

Schema (AssessmentDefinition, v4.0.0):
- Root: {schema_version:"4.0.0", assessment_id, title, provenance:"past_paper", created_at (ISO 8601 now), max_marks, questions[], source_note?}
- assessment_id: "assessment_" + 10 random alphanumeric chars.
- Each question: {question_id ("question_"+random), assessment_id (same as root), label ("3", "3(b)", "3(b)(ii)"), parent_question_id? (for subparts), order (0-indexed), marks_available, stem_ref? (a SHORT reference — never the full question text), topic_mappings[], mark_scheme, difficulty? (0-5), provenance:"past_paper"}.
- topic_mappings[]: {topic_id, role ("primary"|"secondary"), weight (0-1; the weights for one question MUST sum to 1), proposed_by:"ai", confirmed:false}. Map each question to the tracked topic(s) it assesses. If you genuinely cannot map a question, give it an empty array [] rather than guessing.
- mark_scheme: {total_marks (= the question's marks_available), criteria[], guidance?}. Each criterion: {criterion_id ("criterion_"+random), marks, kind ("point"|"method"|"accuracy"|"follow_through"|"rubric_band"|"quality"|"alternative"), label (e.g. "M1", "AO2 band 3"), descriptor (what earns it), conditions?, alternatives?, band? ({level, min_marks, max_marks} for rubric marks)}. Use rubric_band for essay/extended-answer marking, discrete kinds for per-mark schemes.

Marks MUST reconcile: each mark_scheme.total_marks equals its question's marks_available; a parent question's marks equal the sum of its subparts; and the leaf questions' marks sum to max_marks.

Only reference topic_ids from this list — never invent one:
${list}

Past paper and mark scheme: [PASTE THE PAPER AND MARK SCHEME]`;
}
