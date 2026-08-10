import type { Store, Topic } from '@/domain/types';
import { allTopics } from '@/domain/types';

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
