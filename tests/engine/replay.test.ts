import { describe, expect, it } from 'vitest';
import { topicStateAsOf } from '@/engine/replay';
import { CONFIG } from '@/config/constants';
import type { ReviewEvent, Topic } from '@/domain/types';

function review(id: string, date: string, conf: 1 | 2 | 3 | 4 | 5): ReviewEvent {
  return {
    event_id: id, date, kind: 'study_review',
    source: 'session', source_id: `s_${id}`, confidence_reported: conf,
  };
}

/** A topic whose CURRENT state is the product of two study reviews. */
function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 't1', title: 'T', status: 'learning',
    conf: 4, strength: 0, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: null, mastered_at: null, drift_history: [],
    review_history: [
      review('e1', '2026-06-01T10:00:00Z', 3),
      review('e2', '2026-06-10T10:00:00Z', 5),
    ],
    error_log: [],
    ...over,
  };
}

describe('topicStateAsOf', () => {
  it('is not_started before the first event', () => {
    const s = topicStateAsOf(topic(), new Date('2026-05-01T00:00:00Z'));
    expect(s.status).toBe('not_started');
    expect(s.strength).toBe(0);
    expect(s.last_reviewed).toBeNull();
  });

  it('reflects only the first event mid-history', () => {
    const s = topicStateAsOf(topic(), new Date('2026-06-05T00:00:00Z'));
    expect(s.review_history).toHaveLength(1);
    expect(s.last_reviewed).toBe('2026-06-01T10:00:00Z');
    // seeded 1.0 on first promotion, then +CONF_MID for the conf-3 review
    expect(s.strength).toBeCloseTo(CONFIG.SEED_STRENGTH + CONFIG.STRENGTH_GAIN.CONF_MID, 5);
  });

  it('at/after the last event equals a full forward replay', () => {
    const s = topicStateAsOf(topic(), new Date('2026-06-30T00:00:00Z'));
    expect(s.review_history).toHaveLength(2);
    // seed + CONF_MID (conf 3) + CONF_HIGH (conf 5)
    expect(s.strength).toBeCloseTo(
      CONFIG.SEED_STRENGTH + CONFIG.STRENGTH_GAIN.CONF_MID + CONFIG.STRENGTH_GAIN.CONF_HIGH,
      5,
    );
    expect(s.conf).toBe(5);
    expect(s.last_reviewed).toBe('2026-06-10T10:00:00Z');
  });

  it('does not mutate the input topic', () => {
    const t = topic();
    const before = JSON.stringify(t);
    topicStateAsOf(t, new Date('2026-06-05T00:00:00Z'));
    expect(JSON.stringify(t)).toBe(before);
  });
});
