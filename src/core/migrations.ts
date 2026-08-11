import { allTopics, type Exam, type Store } from '@/domain/types';
import { topicStateAsOf } from '@/engine/replay';

/**
 * Data migrations that touch persisted topic state (design 2026-08-09 §4).
 *
 * The only migration so far is v3.1.0: purge kFactor/drift_history contamination
 * left by uniform-fallback exams, which used to self-tune the curve on scores
 * smeared uniformly across every linked topic. Everything else in this rewrite
 * is a redeploy (derived live); this is the one place stored state changes.
 */

/** Max representable date — replay "everything" without a real clock. */
const FAR_FUTURE = new Date(8_640_000_000_000_000);

/**
 * A topic's exam score is smeared when the exam gave no per-topic breakdown for
 * it — or when the exam can't be resolved at all (cautious default: unverifiable
 * provenance must not drive self-tuning `k`).
 */
export function examTopicSmeared(exam: Exam | undefined, topicId: string): boolean {
  if (!exam) return true;
  if (!exam.breakdown) return true;
  return !exam.breakdown.some((b) => b.topic_id === topicId);
}

export interface RecomputeCounts {
  resolved: number;
  unresolved: number;
}

/**
 * v3.1.0 — purge kFactor/drift_history contamination from uniform-fallback exams.
 * Backfills `smeared` (and `fanout`) on exam-sourced test events by joining
 * source_id → store.exams[] (mergeExam stamps source_id = exam.exam_id), then
 * recomputes k forward under the new skip rule via the shared replay. Idempotent;
 * mutates `store` in place. Returns join counts so a caller/test can assert that
 * provenance actually resolved — an unresolved join silently reduces to "wipe
 * everything to DECAY_K," which would otherwise look like a successful purge.
 */
export function recomputeLapseContamination(store: Store): RecomputeCounts {
  let resolved = 0;
  let unresolved = 0;
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'exam' && (e.kind === 'test_pass' || e.kind === 'test_fail')) {
        const exam = store.exams.find((x) => x.exam_id === e.source_id);
        if (exam) {
          resolved += 1;
          e.fanout = exam.linked_topic_ids.length;
        } else {
          unresolved += 1;
        }
        e.smeared = examTopicSmeared(exam, topic.topic_id);
      }
    }
    const replayed = topicStateAsOf(topic, FAR_FUTURE);
    topic.k_factor = replayed.k_factor;
    topic.drift_history = replayed.drift_history;
  }
  return { resolved, unresolved };
}
