/**
 * Assessment domain (design §C/§E/§F). These entities live in IndexedDB, NOT in
 * the localStorage `Store` — they can be large (many questions, mark-scheme prose,
 * marking records) and must stay off the synchronous hot path. Only compact
 * references and the decomposed ReviewEvents reach the study substrate.
 */
import type { AssessmentProvenance, Difficulty, ErrorSeverity } from './types';

/* ── Mark scheme (design §E) — subject-general ────────────────────── */

export type MarkCriterionKind =
  | 'point' | 'method' | 'accuracy' | 'follow_through' // discrete-mark subjects
  | 'rubric_band' | 'quality' | 'alternative'; // rubric/criterion subjects

export interface MarkCriterion {
  criterion_id: string;
  marks: number;
  kind: MarkCriterionKind;
  /** Short label: "M1", "AO2 band 3", "identifies cause". */
  label: string;
  /** Human-readable: what earns it. The app never auto-adjudicates this. */
  descriptor: string;
  conditions?: string;
  alternatives?: string[];
  /** Rubric-only: a banded mark range the learner picks within. */
  band?: { level: number; min_marks: number; max_marks: number };
}

export interface MarkScheme {
  total_marks: number;
  criteria: MarkCriterion[];
  guidance?: string;
}

/* ── Question + topic mapping (design §F) ─────────────────────────── */

export type TopicMappingRole = 'primary' | 'secondary';

export interface TopicMapping {
  topic_id: string;
  role: TopicMappingRole;
  /** 0–1; Σ weights over a question == 1. Weighted attribution, never smear. */
  weight: number;
  proposed_by: 'ai' | 'user';
  /** AI proposals must be confirmed before they weight evidence (§8). */
  confirmed: boolean;
}

export interface Question {
  question_id: string;
  assessment_id: string;
  /** "3", "3(b)", "3(b)(ii)" — human ordering. */
  label: string;
  parent_question_id?: string;
  order: number;
  marks_available: number;
  /** SHORT reference/prompt, not the full paper text (design §O). */
  stem_ref?: string;
  topic_mappings: TopicMapping[];
  mark_scheme: MarkScheme;
  difficulty?: Difficulty;
  learning_objective_ids?: string[];
  provenance: AssessmentProvenance;
}

export interface AssessmentDefinition {
  schema_version: string;
  assessment_id: string;
  title: string;
  provenance: AssessmentProvenance;
  created_at: string;
  max_marks: number;
  questions: Question[];
  /** Where it came from (short note; never the full document). */
  source_note?: string;
}

/* ── Attempt = sitting + marking = the "result" (design §C) ───────── */

/** Sitting conditions — learner-recorded, NEVER inferred (design §19). They set
 *  the evidence tier of the events this attempt decomposes into. */
export interface SittingConditions {
  timed: boolean;
  closed_book: boolean;
  cold: boolean;
  assistance_used: boolean;
  ai_used: boolean;
  mark_scheme_seen: boolean;
}

export interface QuestionResult {
  question_id: string;
  marks_awarded: number;
  criteria_awarded?: Array<{ criterion_id: string; marks: number }>;
  /** Error occurrences flagged while marking this question. */
  error_ids?: string[];
  notes?: string;
  proposed_error_signature?: string;
  proposed_error_severity?: ErrorSeverity;
}

export interface AssessmentAttempt {
  schema_version: string;
  attempt_id: string;
  assessment_id: string;
  sat_at: string;
  conditions: SittingConditions;
  question_results: QuestionResult[];
  status: 'in_progress' | 'marked';
}
