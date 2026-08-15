import { allTopics, type Store, type Topic } from '@/domain/types';

/**
 * Prerequisite-graph geometry (workflow.md §4). Pure and read-only.
 *
 * The DAG's directed edges run ancestor → descendant: an edge (p → t) exists
 * when `p ∈ t.prerequisites`. Real shortest-path distance is preserved here
 * rather than approximated by a direct/transitive flag (§4.1, §35.2, §47).
 */

/** Reverse adjacency: ancestorId → ids that list it as a prerequisite. */
function childrenMap(store: Store): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const { topic } of allTopics(store)) {
    for (const pid of topic.prerequisites ?? []) {
      (children.get(pid) ?? children.set(pid, []).get(pid)!).push(topic.topic_id);
    }
  }
  return children;
}

/**
 * Shortest directed distance from ancestor `fromId` down to descendant `toId`.
 * `0` when they are the same node, `null` when `toId` is not reachable downstream
 * of `fromId`. Breadth-first, so the first time `toId` is reached is its shortest
 * distance.
 */
export function shortestPathDistance(fromId: string, toId: string, store: Store): number | null {
  if (fromId === toId) return 0;
  const children = childrenMap(store);
  const seen = new Set<string>([fromId]);
  let frontier = [fromId];
  let dist = 0;
  while (frontier.length > 0) {
    dist++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of children.get(id) ?? []) {
        if (child === toId) return dist;
        if (!seen.has(child)) { seen.add(child); next.push(child); }
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * All descendants of `topicId`, each once at its shortest distance. The
 * distance-tagged form of the reverse reach used by foundational-risk utility
 * (workflow.md §16), which discounts remote downstream effects by distance.
 */
export function downstreamWithDistance(
  topicId: string,
  store: Store,
): Array<{ topic: Topic; distance: number }> {
  const byId = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic]));
  const children = childrenMap(store);
  const seen = new Set<string>([topicId]);
  const out: Array<{ topic: Topic; distance: number }> = [];
  let frontier = [topicId];
  let dist = 0;
  while (frontier.length > 0) {
    dist++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of children.get(id) ?? []) {
        if (!seen.has(child)) {
          seen.add(child);
          next.push(child);
          const t = byId.get(child);
          if (t) out.push({ topic: t, distance: dist });
        }
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * Within-course curriculum order key per topic_id (workflow.md D9a). `section.order`
 * major, topic array position minor, as an ascending integer that RESETS per course
 * so the key is course-relative — a single global counter would make the first
 * course systematically outrank later ones in any cross-course tiebreak (watch-item
 * #1). Formal balanced cross-course interleaving is Phase 4's domain interleaving.
 */
export function curriculumIndex(store: Store): Map<string, number> {
  const idx = new Map<string, number>();
  for (const course of store.courses) {
    let within = 0;
    const sections = [...course.sections].sort((a, b) => a.order - b.order);
    for (const section of sections) {
      for (const topic of section.topics) idx.set(topic.topic_id, within++);
    }
  }
  return idx;
}
