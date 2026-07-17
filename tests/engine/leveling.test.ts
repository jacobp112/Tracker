import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, overallLevel, topicLevel } from '@/engine/leveling';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type ReviewEvent, type Store, type Topic } from '@/domain/types';

const NOW = new Date('2026-07-17T12:00:00Z');

function passEvent(): ReviewEvent {
  return {
    event_id: 'event_pass', date: NOW.toISOString(), kind: 'test_pass',
    source: 'exam', source_id: 'exam_1', confidence_reported: 5,
    test: { score: 10, out_of: 10, actual_retention: 1 },
  };
}

function failEvent(): ReviewEvent {
  // 7/10 is below the 80% pass mark — a genuine fail, but a near-miss so it
  // doesn't crater calibration; keeps health high enough to prove the cap bites.
  return {
    event_id: 'event_fail', date: NOW.toISOString(), kind: 'test_fail',
    source: 'exam', source_id: 'exam_2', confidence_reported: 3,
    test: { score: 7, out_of: 10, actual_retention: 0.7 },
  };
}

/** A topic maxed on every health input: recent, strong, calibrated, confident,
 *  fully carded, no errors. Overrides carve out the case under test. */
function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_x', title: 'X', status: 'mastered',
    conf: 5, strength: 5, k_factor: CONFIG.DECAY_K, cards: 5,
    last_reviewed: NOW.toISOString(), mastered_at: '2026-07-01T00:00:00Z',
    drift_history: [], review_history: [passEvent()], error_log: [],
    ...over,
  };
}

function storeOf(topics: Topic[]): Store {
  const course: Course = {
    schema_version: '2.0.0', course_id: 'course_1', title: 'C',
    created_at: '2026-07-01T09:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  return { ...emptyStore(), courses: [course] };
}

describe('topicLevel — banding and gates', () => {
  it('reaches the maximum level only for a validated, mastered, healthy topic', () => {
    expect(topicLevel(topic(), NOW)).toBe(MAX_LEVEL);
  });

  it('gates not_started to 0 regardless of otherwise-maxed numbers', () => {
    // Same maxed inputs, only the status differs — status wins.
    expect(topicLevel(topic({ status: 'not_started' }), NOW)).toBe(0);
  });

  it('caps an unvalidated topic below the top bands, however healthy', () => {
    // No test at all: health is still ~100, but nothing has vindicated it.
    const untested = topic({ review_history: [] });
    expect(topicLevel(untested, NOW)).toBe(CONFIG.LEVEL.UNVALIDATED_CAP);
  });

  it('does not treat a failed test as validation', () => {
    const failedOnly = topic({ review_history: [failEvent()] });
    expect(topicLevel(failedOnly, NOW)).toBe(CONFIG.LEVEL.UNVALIDATED_CAP);
  });

  it('reserves the top level for mastered — a validated practising topic stops one below', () => {
    const practising = topic({ status: 'practising' });
    expect(topicLevel(practising, NOW)).toBe(MAX_LEVEL - 1);
  });

  it('never exceeds MAX_LEVEL or drops below 0', () => {
    for (const status of ['not_started', 'learning', 'practising', 'mastered'] as const) {
      const lvl = topicLevel(topic({ status }), NOW);
      expect(lvl).toBeGreaterThanOrEqual(0);
      expect(lvl).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it('is monotonic in health — a weaker topic never outranks a stronger one', () => {
    const strong = topic({ status: 'practising' });
    const weak = topic({
      status: 'learning', conf: 1, cards: 0, strength: 0.2,
      last_reviewed: '2026-01-01T00:00:00Z', review_history: [],
      error_log: [
        { error_id: 'e1', date: NOW.toISOString(), source: 'session', source_id: 's1',
          error_type: 'conceptual', description: 'x', resolved: false, resolved_date: null },
      ],
    });
    expect(topicLevel(weak, NOW)).toBeLessThan(topicLevel(strong, NOW));
  });

  it('exports MAX_LEVEL as the band count, so there is no second source of truth', () => {
    expect(MAX_LEVEL).toBe(CONFIG.LEVEL.HEALTH_BANDS.length);
  });
});

describe('overallLevel — aggregate', () => {
  it('is 0 for an empty store', () => {
    expect(overallLevel(emptyStore(), NOW)).toBe(0);
  });

  it('is the rounded mean topic level, counting not-started 0s', () => {
    // One maxed (MAX_LEVEL) and one not_started (0): mean = MAX_LEVEL/2, rounded.
    const store = storeOf([
      topic({ topic_id: 'topic_a' }),
      topic({ topic_id: 'topic_b', status: 'not_started' }),
    ]);
    expect(overallLevel(store, NOW)).toBe(Math.round(MAX_LEVEL / 2));
  });

  it('does not reward an empty tracker with a nonzero level', () => {
    expect(overallLevel(storeOf([]), NOW)).toBe(0);
  });
});
