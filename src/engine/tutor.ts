import type {
  ErrorPattern, ErrorSeverity, ErrorType, ExpectedEvidence, SessionIntent, SessionPlan, Store, Topic,
} from '@/domain/types';
import { allTopics } from '@/domain/types';
import { matchPattern } from './errors';
import { health, shouldShowHealth } from './metrics';
import { prerequisiteInstability } from './prerequisites';
import { retentionPct } from './retention';

/**
 * The tutor boundary — design §L (context out) and §M (observations in). The app
 * sends a CURATED snapshot and receives OBSERVATIONS; it never ships raw learner
 * state, and it — not the AI — decides how observations affect the model.
 */

/* ── §M: tutor observations → app-owned decisions ─────────────────── */

export interface ObservedError {
  error_type: ErrorType;
  description: string;
  /** Tutor's PROPOSED structured signature (semantic, not prose). */
  proposed_signature?: string;
  proposed_severity?: ErrorSeverity;
  topic_id?: string;
}

export type ErrorResolution =
  | { decision: 'link'; pattern_id: string }
  | { decision: 'confirm'; pattern_id: string }
  | { decision: 'create'; signature: string }
  | { decision: 'skip' };

/**
 * Decide what an observed error does to the pattern set. Semantic match (not
 * string equality): a high-confidence match auto-links; an ambiguous one is
 * surfaced for learner confirmation; a genuinely new signature creates a pattern;
 * and — never inventing recurrence — an observation with no proposed signature is
 * skipped (the occurrence is still logged elsewhere, just not clustered).
 */
export function resolveObservedError(
  patterns: readonly ErrorPattern[],
  observed: ObservedError,
): ErrorResolution {
  const sig = observed.proposed_signature;
  if (!sig) return { decision: 'skip' };
  const m = matchPattern(patterns, { signature: sig, error_type: observed.error_type, topic_id: observed.topic_id });
  if (!m) return { decision: 'create', signature: sig };
  return m.confidence === 'high'
    ? { decision: 'link', pattern_id: m.pattern.pattern_id }
    : { decision: 'confirm', pattern_id: m.pattern.pattern_id };
}

/* ── §L: curated tutor context ────────────────────────────────────── */

export interface TutorContext {
  objective: string;
  intent: SessionIntent;
  /** Only derived, presentational values — never raw strength/k/drift/history. */
  targets: Array<{ topic_id: string; title: string; status: string; retention: number | null; health: number | null }>;
  error_patterns: Array<{ pattern_id: string; signature: string; error_type: ErrorType; severity: ErrorSeverity }>;
  prerequisites: Array<{ topic_id: string; title: string; unstable: boolean }>;
  expected_outcome: string;
}

function describeExpected(ee: ExpectedEvidence): string {
  switch (ee.kind) {
    case 'independent_success': return `an independent success (evidence tier ≥ ${ee.min_tier ?? 4}) on the target topic`;
    case 'error_resolved': return 'the target error corrected and then demonstrated independently';
    case 'retrieval': return 'a genuine retrieval attempt on the target topic';
    case 'coverage': return 'the target topic started and its foundation confirmed';
  }
}

/**
 * Build the snapshot sent to the tutor from a plan. Includes the objective,
 * target topics (status/retention/health — the derived, presentational values),
 * the relevant error patterns, and prerequisite stability. Deliberately EXCLUDES
 * the raw event log and engine internals (strength/k_factor/drift), keeping the
 * app the source of truth.
 */
export function buildTutorContext(plan: SessionPlan, store: Store, now: Date = new Date()): TutorContext {
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const targets = plan.target_topic_ids.map((id) => byId.get(id)).filter((t): t is Topic => t !== undefined);

  const prereqs = new Map<string, { title: string; unstable: boolean }>();
  for (const t of targets) {
    for (const u of prerequisiteInstability(t, store, now).upstream) {
      prereqs.set(u.topic_id, { title: u.title, unstable: u.unstable });
    }
  }

  const patterns = (plan.target_pattern_ids ?? [])
    .map((pid) => store.error_patterns.find((p) => p.pattern_id === pid))
    .filter((p): p is ErrorPattern => p !== undefined);

  return {
    objective: plan.reason,
    intent: plan.intent,
    targets: targets.map((t) => {
      const r = retentionPct(t, now);
      return {
        topic_id: t.topic_id, title: t.title, status: t.status,
        retention: r === null ? null : Math.round(r),
        health: shouldShowHealth(t) ? health(t, now) : null,
      };
    }),
    error_patterns: patterns.map((p) => ({ pattern_id: p.pattern_id, signature: p.signature, error_type: p.error_type, severity: p.severity })),
    prerequisites: [...prereqs.entries()].map(([id, v]) => ({ topic_id: id, title: v.title, unstable: v.unstable })),
    expected_outcome: describeExpected(plan.expected_evidence),
  };
}
