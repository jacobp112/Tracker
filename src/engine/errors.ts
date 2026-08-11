import { CONFIG } from '@/config/constants';
import type { ErrorLogEntry, ErrorPattern, ErrorType, Store, Topic } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { evidenceTier } from './performance';
import { downstreamDependents } from './prerequisites';
import { predictRetention } from './retention';

/**
 * Error intelligence — design §I. Pure and read-only over the store. Nothing here
 * is stored: pattern lifecycle status, severity-driven urgency, and match
 * candidates are all DERIVED live, so they self-heal and never go stale.
 *
 * Severity vs urgency (§I.3): SEVERITY is intrinsic, slow-moving damage (stored on
 * the pattern, AI-proposed, editable). URGENCY is *when to act* — derived here from
 * severity + recurrence + foundationality + retention + resolution status via
 * interpretable ordered rules, NOT a weighted score.
 */

/* ── Semantic pattern matching (design §I.1, mid-turn clarification) ────
 * Identity is the normalised SEMANTIC signature + context (error_type/topic), not
 * exact string equality. A close-but-not-equal signature is surfaced as
 * `ambiguous` for learner confirmation rather than silently merged. */

const MATCH_HIGH = 0.8;
const MATCH_AMBIGUOUS = 0.4;

export interface PatternCandidate {
  /** Structured signature the tutor proposed (or the app normalised). */
  signature: string;
  error_type: ErrorType;
  topic_id?: string;
}

export type MatchConfidence = 'high' | 'ambiguous';

/** Normalise a signature to a semantic token set — lowercase, split on any
 *  non-alphanumeric run. Prose punctuation/casing never affects identity. */
function tokens(signature: string): Set<string> {
  return new Set(
    signature.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Best existing pattern for an observed error, by semantic signature overlap
 * within the SAME error_type (context gate — identical words under a different
 * error_type are a different mistake). Topic overlap breaks ties. Returns null
 * when nothing is semantically close; `high` (auto-acceptable) or `ambiguous`
 * (surface for confirmation) otherwise. The caller — never this function — owns
 * assigning the resulting pattern_id.
 */
export function matchPattern(
  patterns: readonly ErrorPattern[],
  candidate: PatternCandidate,
): { pattern: ErrorPattern; confidence: MatchConfidence } | null {
  const cand = tokens(candidate.signature);
  let best: { pattern: ErrorPattern; score: number } | null = null;
  for (const p of patterns) {
    if (p.error_type !== candidate.error_type) continue; // context gate
    const score = jaccard(cand, tokens(p.signature));
    const topicBonus = candidate.topic_id && p.topic_ids.includes(candidate.topic_id) ? 0.0001 : 0;
    const effective = score + topicBonus;
    if (!best || effective > best.score) best = { pattern: p, score: effective };
  }
  if (!best || best.score < MATCH_AMBIGUOUS) return null;
  return { pattern: best.pattern, confidence: best.score >= MATCH_HIGH ? 'high' : 'ambiguous' };
}

/* ── Derived lifecycle status (design §I.2) ───────────────────────── */

export type DerivedErrorStatus = 'active' | 'verification_pending' | 'verified_resolved' | 'regressed';

/** Minimum evidence tier that VERIFIES a resolution. Independence is the gate
 *  (≥4); a high-severity pattern demands cold-independent (≥5) — design §I.2. */
function verifyingTier(severity: ErrorPattern['severity']): number {
  return severity === 'high' ? 5 : 4;
}

function patternTopics(pattern: ErrorPattern, store: Store): Topic[] {
  const wanted = new Set(pattern.topic_ids);
  return allTopics(store).filter(({ topic }) => wanted.has(topic.topic_id)).map((r) => r.topic);
}

function occurrencesOf(pattern: ErrorPattern, store: Store): ErrorLogEntry[] {
  const ids = new Set(pattern.occurrence_ids);
  const out: ErrorLogEntry[] = [];
  for (const { topic } of allTopics(store)) {
    for (const e of topic.error_log) {
      if (ids.has(e.error_id) || (e.pattern_id && e.pattern_id === pattern.pattern_id)) out.push(e);
    }
  }
  return out;
}

type Tick = { t: number; kind: 'occurrence' | 'remediation' | 'success' };

/**
 * Lifecycle status, folded over a chronological timeline of occurrences,
 * remediation signals, and *qualifying* successes. A qualifying success is a
 * passed test on a pattern topic at or above the verifying tier — so a
 * non-independent success can never verify a resolution (the independence gate),
 * and a high-severity pattern needs cold-independent evidence.
 */
export function patternStatus(
  pattern: ErrorPattern,
  store: Store,
  now: Date = new Date(),
): { status: DerivedErrorStatus; reasons: string[] } {
  const topics = patternTopics(pattern, store);
  const topicIds = new Set(topics.map((t) => t.topic_id));
  const minTier = verifyingTier(pattern.severity);
  const ticks: Tick[] = [];

  for (const e of occurrencesOf(pattern, store)) {
    ticks.push({ t: new Date(e.date).getTime(), kind: 'occurrence' });
    // A learner-marked-resolved occurrence is a (weak) remediation signal.
    if (e.resolved && e.resolved_date) ticks.push({ t: new Date(e.resolved_date).getTime(), kind: 'remediation' });
  }
  // A remediate-intent session on a pattern topic is a remediation signal.
  for (const s of store.sessions) {
    if (s.intent === 'remediate' && topicIds.has(s.topic_id)) {
      ticks.push({ t: new Date(s.completed_at).getTime(), kind: 'remediation' });
    }
  }
  // Qualifying successes: passed tests on a pattern topic at/above the verifying tier.
  for (const t of topics) {
    for (const ev of t.review_history) {
      if (ev.kind === 'test_pass' && evidenceTier(ev) >= minTier) {
        ticks.push({ t: new Date(ev.date).getTime(), kind: 'success' });
      }
    }
  }

  // Chronological; at equal time, occurrence → remediation → success.
  const order = { occurrence: 0, remediation: 1, success: 2 };
  ticks.sort((a, b) => a.t - b.t || order[a.kind] - order[b.kind]);

  let state: DerivedErrorStatus | undefined;
  for (const tick of ticks) {
    if (tick.t > now.getTime()) continue; // never read the future
    if (tick.kind === 'occurrence') state = state === 'verified_resolved' ? 'regressed' : 'active';
    else if (tick.kind === 'remediation') { if (state === 'active' || state === 'regressed') state = 'verification_pending'; }
    else if (tick.kind === 'success') { if (state === 'verification_pending') state = 'verified_resolved'; }
  }

  const status = state ?? 'active';
  const reasons: string[] = [];
  if (status === 'verified_resolved') reasons.push(`verified by independent success (tier ≥ ${minTier})`);
  else if (status === 'verification_pending') reasons.push('remediation attempted — awaiting independent proof');
  else if (status === 'regressed') reasons.push('recurred after being verified resolved');
  else reasons.push('active — not yet remediated');
  return { status, reasons };
}

/* ── Urgency (design §I.3) — interpretable, ordered rules ──────────── */

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';
export type UrgencyWhen = 'today' | 'within_48h' | 'this_week' | 'next_cycle';

export interface ErrorUrgency {
  level: UrgencyLevel;
  when: UrgencyWhen;
  reasons: string[];
}

const WHEN_FOR: Record<UrgencyLevel, UrgencyWhen> = {
  critical: 'today',
  high: 'within_48h',
  medium: 'this_week',
  low: 'next_cycle',
};

/**
 * Urgency for a pattern — NOT age, NOT a weighted score (design §13/§I.3). Ordered
 * rules over severity, recurrence, foundationality, retention decay, and the
 * derived resolution status. A verified-resolved pattern is never urgent; every
 * verdict lists the concrete reasons that produced it.
 */
export function errorUrgency(pattern: ErrorPattern, store: Store, now: Date = new Date()): ErrorUrgency {
  const status = patternStatus(pattern, store, now).status;
  if (status === 'verified_resolved') {
    return { level: 'low', when: 'next_cycle', reasons: ['verified resolved — no action needed'] };
  }

  const topics = patternTopics(pattern, store);
  const recurrence = new Set([
    ...pattern.occurrence_ids,
    ...occurrencesOf(pattern, store).map((e) => e.error_id),
  ]).size;
  const foundational = topics.some((t) => downstreamDependents(t.topic_id, store).length > 0);
  const decaying = topics.some((t) => {
    const r = predictRetention(t, now);
    return r !== null && r < CONFIG.DUE_THRESHOLD;
  });
  const highSeverity = pattern.severity === 'high';

  const reasons: string[] = [];
  if (recurrence >= 2) reasons.push(`recurred ${recurrence} times`);
  if (highSeverity) reasons.push('high-severity error');
  if (foundational) reasons.push('topic underpins downstream topics');
  if (decaying) reasons.push('underlying concept is decaying below the review threshold');
  if (status === 'regressed') reasons.push('regressed after a prior fix');

  let level: UrgencyLevel;
  if (highSeverity && (recurrence >= 2 || foundational)) level = 'critical';
  else if (recurrence >= 2 || highSeverity || decaying) level = 'high';
  else if (pattern.severity === 'medium') level = 'medium';
  else level = 'low';

  if (reasons.length === 0) reasons.push('single low-severity occurrence');
  return { level, when: WHEN_FOR[level], reasons };
}
