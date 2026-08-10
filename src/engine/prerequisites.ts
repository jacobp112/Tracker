import { CONFIG } from '@/config/constants';
import type { Store, Topic, TopicStatus } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { health, shouldShowHealth } from './metrics';
import { predictRetention } from './retention';

/**
 * Prerequisite-graph diagnostics — design 2026-08-10 §E. Pure and read-only:
 * these functions inspect the topic dependency graph to locate upstream
 * instability; they NEVER write to a topic or the store (design §6).
 */

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
}

export interface PrerequisiteReport {
  topic_id: string;
  upstream: PrerequisiteHealth[];
  unstableCount: number;
}

/** A prerequisite is unstable when upstream isn't consolidated (not_started /
 *  learning), or its surfaced health is weak, or it has decayed below the due
 *  threshold (design §E — proposed rule; thresholds are tunable). */
function isPrerequisiteUnstable(pre: Topic, h: number | null, r: number | null): boolean {
  if (pre.status === 'not_started' || pre.status === 'learning') return true;
  if (h !== null && h < CONFIG.PERFORMANCE.PREREQ_UNSTABLE_HEALTH) return true;
  if (r !== null && r < CONFIG.DUE_THRESHOLD) return true;
  return false;
}

/**
 * Diagnostic evidence for a topic's upstream dependency chain (design §6, §E).
 * For each ancestor, reports its Knowledge Health, retention, and an `unstable`
 * flag, so a repeatedly-failing downstream topic can point at unstable upstream
 * topics rather than assuming itself the root. READ-ONLY: never writes to a topic
 * or the store, never overwrites mastery.
 */
export function prerequisiteInstability(topic: Topic, store: Store, now: Date = new Date()): PrerequisiteReport {
  const upstream = upstreamPrerequisites(topic, store).map(({ topic: pre, depth }): PrerequisiteHealth => {
    const h = shouldShowHealth(pre) ? health(pre, now) : null;
    const r = predictRetention(pre, now);
    return {
      topic_id: pre.topic_id,
      title: pre.title,
      depth,
      status: pre.status,
      health: h,
      retention: r,
      unstable: isPrerequisiteUnstable(pre, h, r),
    };
  });
  return { topic_id: topic.topic_id, upstream, unstableCount: upstream.filter((u) => u.unstable).length };
}
