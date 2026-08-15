import { CONFIG } from '@/config/constants';
import type { Store, Topic } from '@/domain/types';
import { upstreamPrerequisites, mastery } from './prerequisites';
import { patternStatus, calculateSignatureSimilarity } from './errors';

/**
 * Distance-attenuated, bounded, evidence-driven soft gating — workflow.md §11.
 *
 * Replaces binary prerequisite gating with a continuous factor `G_soft ∈ [FLOOR, 1]`:
 * a remote, weakly-related ancestor reduces a target's utility a little; it never
 * drives it to zero and never deadlocks progression (§7, §53). Pure and read-only;
 * cycle-safe via `upstreamPrerequisites`.
 */

export interface AncestorCausalImpact {
  topicId: string;
  title: string;
  /** shortest-path distance d (ancestor → target). */
  distance: number;
  /** mastery L(v_i) ∈ [0,1]. */
  mastery: number;
  /** depth attenuation α(d) = γ^(d-1). */
  attenuation: number;
  /** misconception similarity S_err ∈ [0,1]. */
  errorSimilarity: number;
  /** causal impact C = (1−L)·α·S_err. */
  causalImpact: number;
}

function activePatterns(topicId: string, store: Store, now: Date) {
  return store.error_patterns.filter(
    (p) => p.topic_ids.includes(topicId) && patternStatus(p, store, now).status !== 'verified_resolved',
  );
}

/**
 * S_err — max signature similarity between the ancestor's and the target's active
 * error patterns (Jaccard, `calculateSignatureSimilarity`; workflow D2). When either
 * side has no active patterns, `S_ERR_UNEVIDENCED` (0) — soft gating is
 * evidence-driven, so an ancestor without misconception overlap does not dampen.
 */
function errorSimilarity(ancestorId: string, targetId: string, store: Store, now: Date): number {
  const anc = activePatterns(ancestorId, store, now);
  const tgt = activePatterns(targetId, store, now);
  if (anc.length === 0 || tgt.length === 0) return CONFIG.RECO.S_ERR_UNEVIDENCED;
  let max = 0;
  for (const a of anc) for (const t of tgt) max = Math.max(max, calculateSignatureSimilarity(a, t));
  return max;
}

/**
 * `G_soft(v_j) = max(FLOOR, ∏_{topK} [1 − (1−L)·α(d)·S_err])`.
 *
 * Only the top-K ancestors by causal impact contribute, so a dense DAG cannot
 * compound into an unbounded penalty (§54.4). Returns the factor and the
 * contributing ancestors for the explanation trace (§49).
 */
export function calculateSoftGating(
  target: Topic,
  store: Store,
  now: Date = new Date(),
): { score: number; topBlockers: AncestorCausalImpact[] } {
  const ancestors = upstreamPrerequisites(target, store).map(({ topic: anc, depth }): AncestorCausalImpact => {
    const L = mastery(anc, now);
    const attenuation = Math.pow(CONFIG.RECO.GAMMA_DEPTH, depth - 1);
    const errorSim = errorSimilarity(anc.topic_id, target.topic_id, store, now);
    return {
      topicId: anc.topic_id,
      title: anc.title,
      distance: depth,
      mastery: L,
      attenuation,
      errorSimilarity: errorSim,
      causalImpact: (1 - L) * attenuation * errorSim,
    };
  });

  const topBlockers = ancestors
    .sort((a, b) => b.causalImpact - a.causalImpact)
    .slice(0, CONFIG.RECO.SOFT_GATE_TOP_K);

  const product = topBlockers.reduce((acc, a) => acc * (1 - a.causalImpact), 1);
  return { score: Math.max(CONFIG.RECO.SOFT_GATE_FLOOR, product), topBlockers };
}
