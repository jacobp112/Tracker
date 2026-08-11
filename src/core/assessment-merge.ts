import type { AssessmentAttempt, AssessmentDefinition, SittingConditions } from '@/domain/assessment';
import type { AssessmentEvidence, Difficulty, Independence, ReviewEvent, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { applyEvent } from '@/engine/recalculate';
import { makeId, testKind } from './merge';

/**
 * Question-level evidence decomposition (design §D step 12 / §F / §H) — the bridge
 * that makes assessments a richer SOURCE of the existing ReviewEvent substrate.
 *
 * A marked attempt becomes ONE un-smeared `test` event PER mapped topic: each
 * question's marks are attributed to its topics by weight, so a question spanning
 * topics splits proportionally rather than being smeared uniformly. Because the
 * events are `smeared:false`, they drive k-tuning through the same single
 * recalculation path (applyEvent) as any real exam — no parallel learning state.
 */

/** Sitting conditions → evidence dimensions (design §19). Independence is
 *  all-or-nothing here: ANY assistance, AI use, or mark-scheme peeking disqualifies
 *  it. Never inferred from correctness. */
export function sittingToAssessment(c: SittingConditions): { cold: boolean; independence: Independence } {
  const independent = !c.assistance_used && !c.ai_used && !c.mark_scheme_seen;
  return { cold: c.cold, independence: independent ? 3 : 0 };
}

export interface DecomposedEvent {
  topic_id: string;
  event: ReviewEvent;
}

interface Accrual {
  earned: number;
  possible: number;
  difficulties: number[];
}

/**
 * Weighted per-topic events for a marked attempt. Only CONFIRMED topic mappings
 * weight evidence (design §F) — an unconfirmed AI proposal contributes nothing
 * until the learner accepts it. A topic with no confirmed mapping produces no
 * event (explicit unknown over invented attribution).
 */
export function decomposeAttempt(def: AssessmentDefinition, attempt: AssessmentAttempt): DecomposedEvent[] {
  const awarded = new Map(attempt.question_results.map((r) => [r.question_id, r.marks_awarded]));
  const accrual = new Map<string, Accrual>();

  for (const q of def.questions) {
    const earnedQ = awarded.get(q.question_id) ?? 0;
    for (const m of q.topic_mappings) {
      if (!m.confirmed) continue; // only confirmed mappings weight evidence (§F)
      const a = accrual.get(m.topic_id) ?? { earned: 0, possible: 0, difficulties: [] };
      a.earned += m.weight * earnedQ;
      a.possible += m.weight * q.marks_available;
      if (q.difficulty !== undefined) a.difficulties.push(q.difficulty);
      accrual.set(m.topic_id, a);
    }
  }

  const base = sittingToAssessment(attempt.conditions);
  const out: DecomposedEvent[] = [];
  for (const [topic_id, a] of accrual) {
    if (a.possible <= 0) continue;
    const assessment: AssessmentEvidence = { cold: base.cold, independence: base.independence };
    if (a.difficulties.length > 0) {
      assessment.difficulty = Math.round(a.difficulties.reduce((x, y) => x + y, 0) / a.difficulties.length) as Difficulty;
    }
    out.push({
      topic_id,
      event: {
        event_id: makeId('event'),
        date: attempt.sat_at,
        kind: testKind(a.earned, a.possible),
        source: 'exam',
        source_id: def.assessment_id,
        // Overridden with the topic's own conf in mergeAttempt; a per-attempt
        // confidence is not collected, so no calibration signal is invented.
        confidence_reported: 3,
        test: { score: a.earned, out_of: a.possible, actual_retention: a.earned / a.possible },
        smeared: false, // real per-topic evidence — this is the whole point
        provenance: def.provenance,
        assessment_ref: { assessment_id: def.assessment_id, attempt_id: attempt.attempt_id },
        assessment,
      },
    });
  }
  return out;
}

/**
 * Apply a marked attempt to the study store through the single recalculation path.
 * Mutates a draft (like mergeExam); the caller adopts it atomically. Confidence is
 * taken from each topic's current conf (mirroring mergeExam's fallback — never
 * fabricating a calibration signal).
 */
export function mergeAttempt(draft: Store, def: AssessmentDefinition, attempt: AssessmentAttempt): void {
  const byId = new Map(allTopics(draft).map(({ topic }) => [topic.topic_id, topic]));
  for (const { topic_id, event } of decomposeAttempt(def, attempt)) {
    const topic = byId.get(topic_id);
    if (!topic) continue; // mappings validated at ingest; a since-deleted topic is skipped
    Object.assign(topic, applyEvent(topic, { ...event, confidence_reported: topic.conf }));
  }
}

/* ── Derived result (design §C — the "result" is a view, not stored) ── */

export interface AttemptTopicResult {
  topic_id: string;
  earned: number;
  possible: number;
  pct: number;
}

export interface AttemptResult {
  total_earned: number;
  total_possible: number;
  pct: number;
  per_topic: AttemptTopicResult[];
}

export function buildAttemptResult(def: AssessmentDefinition, attempt: AssessmentAttempt): AttemptResult {
  const awarded = new Map(attempt.question_results.map((r) => [r.question_id, r.marks_awarded]));
  const hasChild = new Set(def.questions.map((q) => q.parent_question_id).filter((p): p is string => p !== undefined));
  const leaves = def.questions.filter((q) => !hasChild.has(q.question_id));

  const total_earned = leaves.reduce((a, q) => a + (awarded.get(q.question_id) ?? 0), 0);
  const total_possible = def.max_marks;

  const per_topic = decomposeAttempt(def, attempt).map(({ topic_id, event }) => ({
    topic_id,
    earned: event.test!.score,
    possible: event.test!.out_of,
    pct: Math.round((event.test!.score / event.test!.out_of) * 100),
  }));

  return {
    total_earned,
    total_possible,
    pct: total_possible === 0 ? 0 : Math.round((total_earned / total_possible) * 100),
    per_topic,
  };
}
