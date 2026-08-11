import { describe, expect, it } from 'vitest';
import { emptyStore, type ReviewEvent, type Store, type Topic } from '@/domain/types';
import { health } from '@/engine/metrics';
import { predictRetention } from '@/engine/retention';
import { performanceByDifficulty, performanceByNovelty } from '@/engine/performance';
import { allReviewEvents, performanceSummary, unstablePrerequisites } from '@/engine/performance-view';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const iso = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

/** A pre-3.2.0 store: events with NO assessment block, topics with NO prerequisites. */
function historicalStore(): Store {
  const events: ReviewEvent[] = [
    { event_id: 'event_1', date: iso(5), kind: 'test_pass', source: 'exam', source_id: 'src_1',
      confidence_reported: 4, test: { score: 8, out_of: 10, actual_retention: 0.8 } },
    { event_id: 'event_2', date: iso(2), kind: 'study_review', source: 'session', source_id: 'src_2', confidence_reported: 4 },
  ];
  const topic: Topic = {
    topic_id: 'topic_1', title: 'One', status: 'practising', conf: 4, strength: 4,
    k_factor: 8.4, cards: 2, last_reviewed: iso(2), mastered_at: null, drift_history: [],
    review_history: events, error_log: [],
  };
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C', created_at: iso(30), source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [topic] }] });
  return s;
}

describe('historical (pre-assessment) data', () => {
  it('still drives the existing knowledge metrics', () => {
    const topic = historicalStore().courses[0]!.sections[0]!.topics[0]!;
    expect(predictRetention(topic, NOW)).not.toBeNull();
    expect(health(topic, NOW)).toBeGreaterThan(0);
  });

  it('degrades every performance metric to an honest null/empty (no throw)', () => {
    const store = historicalStore();
    const events = allReviewEvents(store);
    const summary = performanceSummary(events);
    expect(summary.performanceHealth).toBeNull();
    expect(summary.cold).toBeNull();
    expect(summary.independent).toBeNull();
    expect(summary.transfer).toBeNull();
    expect(summary.quality).toBeNull();
    expect(summary.novelTaskSuccess).toBeNull();
    expect(summary.calibration).toBeNull();
    expect(performanceByDifficulty(events)).toEqual([]);
    expect(performanceByNovelty(events)).toEqual([]);
    expect(unstablePrerequisites(store, NOW)).toEqual([]);
  });
});
