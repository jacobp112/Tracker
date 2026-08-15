import { CONFIG } from '@/config/constants';
import type { Store, Topic, TopicStatus } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { patternStatus } from './errors';
import { health, shouldShowHealth } from './metrics';
import { topicCapability, type TopicCapabilityProfile } from './performance';
import { predictRetention } from './retention';

/**
 * Prerequisite-graph diagnostics — design 2026-08-10 §E. Pure and read-only:
 * these functions inspect the topic dependency graph to locate upstream
 * instability; they NEVER write to a topic or the store (design §6).
 */

/**
 * Mastery L(v) ∈ [0,1] — the recommendation engine's competency estimate
 * (workflow.md D1). Derived from the composite `health`, which is computable for
 * ANY status; we deliberately do NOT gate on `shouldShowHealth` (a presentation
 * rule), so a `learning` topic with real evidence gets credit instead of being
 * falsely treated as zero-mastery and hard-blocking its dependents (watch-item #2).
 */
export function mastery(topic: Topic, now: Date = new Date()): number {
  return Math.min(1, Math.max(0, health(topic, now) / 100));
}

export interface UpstreamTopic {
  topic: Topic;
  /** 1 = direct prerequisite, 2 = prerequisite-of-prerequisite, … (shallowest wins). */
  depth: number;
}

/**
 * The full ancestor chain of `root` in the prerequisite graph — direct and
 * transitive — in breadth-first order, each topic visited once at its shallowest
 * depth. Cycle-safe (a `seen` set seeded with the root; the graph is assumed a
 * DAG but a cycle cannot hang). Unresolvable prerequisite ids are skipped.
 */
export function upstreamPrerequisites(root: Topic, store: Store): UpstreamTopic[] {
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const seen = new Set<string>([root.topic_id]);
  const out: UpstreamTopic[] = [];

  let frontier: Array<{ id: string; depth: number }> = [];
  for (const id of root.prerequisites ?? []) {
    if (!seen.has(id)) { seen.add(id); frontier.push({ id, depth: 1 }); }
  }

  while (frontier.length > 0) {
    const next: Array<{ id: string; depth: number }> = [];
    for (const { id, depth } of frontier) {
      const t = byId.get(id);
      if (!t) continue; // unresolvable id — skip (already marked seen, won't revisit)
      out.push({ topic: t, depth });
      for (const pid of t.prerequisites ?? []) {
        if (!seen.has(pid)) { seen.add(pid); next.push({ id: pid, depth: depth + 1 }); }
      }
    }
    frontier = next;
  }

  return out;
}

/**
 * Foundationality — the INVERSE of {@link upstreamPrerequisites}. All topics that
 * (transitively) depend on `topicId`, i.e. list it directly or indirectly as a
 * prerequisite. Breadth-first over the reversed edge set, each visited once;
 * cycle-safe. Read-only. Used by the error-urgency engine (design §I.3): an error
 * in a topic that underpins many downstream topics is more damaging.
 */
export function downstreamDependents(topicId: string, store: Store): Topic[] {
  const all = allTopics(store).map(({ topic }) => topic);
  const byId = new Map(all.map((t) => [t.topic_id, t]));
  // Reversed adjacency: prerequisite id -> ids that depend on it.
  const dependents = new Map<string, string[]>();
  for (const t of all) {
    for (const pid of t.prerequisites ?? []) {
      (dependents.get(pid) ?? dependents.set(pid, []).get(pid)!).push(t.topic_id);
    }
  }

  const seen = new Set<string>([topicId]);
  const out: Topic[] = [];
  let frontier = (dependents.get(topicId) ?? []).filter((id) => !seen.has(id));
  frontier.forEach((id) => seen.add(id));

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const t = byId.get(id);
      if (t) out.push(t);
      for (const d of dependents.get(id) ?? []) {
        if (!seen.has(d)) { seen.add(d); next.push(d); }
      }
    }
    frontier = next;
  }
  return out;
}

export type PrerequisiteBlockingGap =
  | 'unconsolidated_status'
  | 'unresolved_error'
  | 'retrieval'
  | 'application'
  | 'independence'
  | 'weak_health';

export interface PrerequisiteHealth {
  topic_id: string;
  title: string;
  depth: number;
  status: TopicStatus;
  /** Knowledge Health, or null when not surfaced (not practising/mastered). */
  health: number | null;
  /** Predicted retention 0–1, or null when never reviewed. */
  retention: number | null;
  unstable: boolean;
  /** True ONLY when the prerequisite presents a genuine blocking weakness (active errors, unconsolidated status, decayed retention, weak health) that warrants curriculum interruption. */
  isBlocking: boolean;
  /** Capability profile of the prerequisite (Tier 2 #11). */
  capability?: TopicCapabilityProfile;
  /** Specific capability gap if unstable. */
  blockingGap?: PrerequisiteBlockingGap;
}

export interface PrerequisiteReport {
  topic_id: string;
  upstream: PrerequisiteHealth[];
  unstableCount: number;
  blockingCount: number;
}

/**
 * Diagnostic evidence for a topic's upstream dependency chain (design §6, §E, Tier 2 #11).
 * For each ancestor, evaluates status, unresolved error patterns, memory retention,
 * application quality, and independent capability to identify specific blocking gaps.
 * READ-ONLY: never writes to a topic or store state.
 */
export function prerequisiteInstability(topic: Topic, store: Store, now: Date = new Date()): PrerequisiteReport {
  const upstream = upstreamPrerequisites(topic, store).map(({ topic: pre, depth }): PrerequisiteHealth => {
    const h = shouldShowHealth(pre) ? health(pre, now) : null;
    const r = predictRetention(pre, now);
    const cap = topicCapability(pre, now);

    const activeErrors = store.error_patterns.filter(
      (p) => p.topic_ids.includes(pre.topic_id) && patternStatus(p, store, now).status !== 'verified_resolved',
    );

    const isStructuralBlocker = topic.status === 'not_started' && pre.status === 'not_started';

    const targetHasFailuresOrErrors =
      topic.review_history.some((e) => e.kind === 'test_fail') ||
      topic.error_log.some((e) => !e.resolved) ||
      store.error_patterns.some((p) => p.topic_ids.includes(topic.topic_id) && patternStatus(p, store, now).status !== 'verified_resolved');

    const preHasFailures = pre.review_history.some((e) => e.kind === 'test_fail');
    const preHasActiveErrors = activeErrors.length > 0;

    const isCausalBlocker =
      (preHasActiveErrors && activeErrors.some((p) => p.severity === 'high')) ||
      (targetHasFailuresOrErrors && (preHasActiveErrors || preHasFailures)) ||
      (preHasActiveErrors && activeErrors.some((p) => p.topic_ids.includes(topic.topic_id)));

    let unstable = false;
    let isBlocking = false;
    let blockingGap: PrerequisiteBlockingGap | undefined;

    if (activeErrors.length > 0) {
      unstable = true;
      blockingGap = 'unresolved_error';
      isBlocking = isCausalBlocker;
    } else if (pre.status === 'not_started' || pre.status === 'learning') {
      unstable = true;
      blockingGap = 'unconsolidated_status';
      isBlocking = isStructuralBlocker || targetHasFailuresOrErrors;
    } else if (cap.retrieval.status === 'faded' || (r !== null && r < CONFIG.DUE_THRESHOLD)) {
      unstable = true;
      blockingGap = 'retrieval';
      isBlocking = false;
    } else if (h !== null && h < CONFIG.PERFORMANCE.PREREQ_UNSTABLE_HEALTH) {
      unstable = true;
      blockingGap = 'weak_health';
      isBlocking = false;
    } else if (cap.application.status === 'developing') {
      unstable = true;
      blockingGap = 'application';
      isBlocking = preHasFailures || (targetHasFailuresOrErrors && cap.application.hasApplicationEvidence);
    } else if (cap.independence.status === 'assisted_only') {
      unstable = true;
      blockingGap = 'independence';
      isBlocking = preHasFailures;
    }

    // Phase 2 (workflow §5–9): a TRANSITIVE ancestor (d>1) never hard-blocks on
    // status/capability alone — only a matching HIGH-severity error keeps it
    // blocking. This removes the deep-chain workflow-deadlock class while
    // preserving genuine causal gating; direct (d=1) blocking is untouched.
    if (depth > 1 && isBlocking) {
      isBlocking = activeErrors.some((p) => p.severity === 'high');
    }

    return {
      topic_id: pre.topic_id,
      title: pre.title,
      depth,
      status: pre.status,
      health: h,
      retention: r,
      unstable,
      isBlocking,
      capability: cap,
      blockingGap,
    };
  });
  return {
    topic_id: topic.topic_id,
    upstream,
    unstableCount: upstream.filter((u) => u.unstable).length,
    blockingCount: upstream.filter((u) => u.isBlocking).length,
  };
}
