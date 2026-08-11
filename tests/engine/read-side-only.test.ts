import { describe, expect, it } from 'vitest';
import { allTopics, type ReviewEvent, type Store, type Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';
import { predictRetention, projectedDue } from '@/engine/retention';
import { health, overconfidenceIndex, badges, topicVelocity } from '@/engine/metrics';
import { topicLevel, topicLevelHighWater, overallLevel } from '@/engine/leveling';
import { globalHealth, overallMastery, studyStreak, weeklyVolume, globalDueQueue, allCourseRefs } from '@/engine/overview';
import { courseHealth, weakTopics } from '@/engine/course';
import { retrievable } from '@/engine/progress';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const iso = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

let seq = 0;
function ev(over: Partial<ReviewEvent> & { day: number }): ReviewEvent {
  seq += 1;
  const { day, ...rest } = over;
  return {
    event_id: `event_${seq}`, date: iso(day), kind: 'study_review',
    source: 'session', source_id: `src_${seq}`, confidence_reported: 4, ...rest,
  } as ReviewEvent;
}

/** A store exercising retention, tests (OCI/level), errors, sessions (streak/volume),
 *  AND assessment blocks + prerequisites on top — the fields Phase 1–5 added. */
function richStore(): Store {
  const t1: Topic = {
    topic_id: 'topic_1', title: 'One', status: 'mastered', conf: 5, strength: 8,
    k_factor: 8.4, cards: 4, last_reviewed: iso(2), mastered_at: iso(20), drift_history: [0.1, -0.05],
    prerequisites: ['topic_2'],
    review_history: [
      ev({ day: 20, kind: 'test_pass', source: 'exam', test: { score: 9, out_of: 10, actual_retention: 0.9 },
        assessment: { difficulty: 4, novelty: 3, independence: 3, transfer_level: 3, performance_quality: 5, cold: true, predicted_success: 0.8, predicted_at: iso(21) } }),
      ev({ day: 10, kind: 'study_review', source: 'session', confidence_reported: 5,
        assessment: { difficulty: 3, independence: 2, performance_quality: 4 } }),
      ev({ day: 2, kind: 'test_fail', source: 'exam', confidence_reported: 3, test: { score: 5, out_of: 10, actual_retention: 0.5 },
        assessment: { difficulty: 5, novelty: 4, independence: 3 } }),
    ],
    error_log: [
      { error_id: 'error_1', date: iso(2), source: 'exam', source_id: 'src_x', error_type: 'conceptual', description: 'x', resolved: false, resolved_date: null },
    ],
  };
  const t2: Topic = {
    topic_id: 'topic_2', title: 'Two', status: 'practising', conf: 3, strength: 2,
    k_factor: 8.4, cards: 1, last_reviewed: iso(6), mastered_at: null, drift_history: [],
    review_history: [
      ev({ day: 6, kind: 'study_review', source: 'session', confidence_reported: 3 }),
    ],
    error_log: [],
  };
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C', created_at: iso(40), source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [t1, t2] }],
  });
  return s;
}

/** Deep-clone the store, then remove every added field (assessment on events,
 *  prerequisites on topics). The result is a "pre-Performance-layer" store. */
function stripAdditions(store: Store): Store {
  const clone: Store = structuredClone(store);
  for (const { topic } of allTopics(clone)) {
    delete (topic as { prerequisites?: unknown }).prerequisites;
    for (const e of topic.review_history) delete (e as { assessment?: unknown }).assessment;
  }
  return clone;
}

/** Serialize every existing knowledge/retention/level/aggregate metric. */
function knowledgeSnapshot(store: Store): string {
  const refs = allCourseRefs(store);
  return JSON.stringify({
    perTopic: allTopics(store).map(({ topic }) => ({
      id: topic.topic_id,
      retention: predictRetention(topic, NOW),
      due: projectedDue(topic, NOW)?.date.toISOString() ?? null,
      health: health(topic, NOW),
      oci: overconfidenceIndex(topic),
      velocity: topicVelocity(topic),
      level: topicLevel(topic, NOW),
      highWater: topicLevelHighWater(topic, NOW),
      badges: badges(topic).map((b) => b.id),
    })),
    global: {
      globalHealth: globalHealth(store, NOW),
      mastery: overallMastery(store),
      overallLevel: overallLevel(store, NOW),
      retrievable: retrievable(store, NOW),
      streak: studyStreak(store, NOW),
      volume: weeklyVolume(store, NOW),
      courseHealth: courseHealth(refs, NOW),
      weakTopics: weakTopics(refs, NOW).map((r) => r.topic.topic_id),
      dueQueue: globalDueQueue(store, 10, NOW).map((r) => r.topic.topic_id),
    },
  });
}

describe('read-side-only invariant (design §A)', () => {
  it('produces non-trivial knowledge metrics for the rich store (guards against a vacuous test)', () => {
    const snap = JSON.parse(knowledgeSnapshot(richStore()));
    expect(snap.perTopic[0].health).toBeGreaterThan(0);
    expect(snap.perTopic[0].retention).not.toBeNull();
  });

  it('assessment blocks and prerequisites change NO existing metric (byte-for-byte)', () => {
    const s = richStore();
    expect(knowledgeSnapshot(s)).toBe(knowledgeSnapshot(stripAdditions(s)));
  });
});
