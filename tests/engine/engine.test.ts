import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/config/constants';
import { dueQueue, projectFinish, velocity, weakTopics, type TopicRef } from '@/engine/course';
import { health, shouldShowHealth } from '@/engine/metrics';
import { applyEvent, promote, strengthIncrement } from '@/engine/recalculate';
import { isDue, predictRetention, projectedDue } from '@/engine/retention';
import type { Confidence, ReviewEvent, Section, Topic, TopicStatus } from '@/domain/types';

const NOW = new Date('2026-07-16T12:00:00Z');

function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_a',
    title: 'A topic',
    status: 'practising',
    conf: 3,
    strength: 1,
    k_factor: CONFIG.DECAY_K,
    cards: 0,
    last_reviewed: '2026-07-13T12:00:00Z',
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
    ...over,
  };
}

function section(id: string): Section {
  return { section_id: id, title: id, order: 0, topics: [] };
}

function ref(t: Topic, sectionId = 'section_1'): TopicRef {
  return { topic: t, section: section(sectionId) };
}

describe('E3-S2 — retention guards (Document 2 §2)', () => {
  it('returns null (not 0) for a never-reviewed topic — the UI shows "—"', () => {
    expect(predictRetention(topic({ last_reviewed: null }), NOW)).toBeNull();
  });

  it('returns null for a Not Started topic even if it has a review date', () => {
    expect(predictRetention(topic({ status: 'not_started' }), NOW)).toBeNull();
  });

  it('returns 1.0 when reviewed today (t ≤ 0)', () => {
    expect(predictRetention(topic({ last_reviewed: NOW.toISOString() }), NOW)).toBe(1);
  });

  it('returns 0 when strength ≤ 0', () => {
    expect(predictRetention(topic({ strength: 0 }), NOW)).toBe(0);
  });

  it('a never-reviewed topic is not "due" — it has not started decaying', () => {
    expect(isDue(topic({ last_reviewed: null }), NOW)).toBe(false);
  });

  it('DECAY_K is calibrated so strength 1 → retention ≈ 0.70 at ~3 days (§1)', () => {
    // The stated calibration of the default constant — worth pinning.
    const t = topic({ strength: 1, k_factor: CONFIG.DECAY_K, last_reviewed: '2026-07-13T12:00:00Z' });
    expect(predictRetention(t, NOW)).toBeCloseTo(0.7, 2);
  });
});

describe('E3-S2 — projected due date (Document 2 §2.1)', () => {
  it('t_due = −k·s·ln(0.70): k=7, s=1.3 → 3.25 days after review', () => {
    const t = topic({ k_factor: 7.0, strength: 1.3, last_reviewed: '2026-07-07T12:00:00Z' });
    const p = projectedDue(t, NOW)!;
    const days = (p.date.getTime() - new Date(t.last_reviewed!).getTime()) / 86_400_000;
    expect(days).toBeCloseTo(3.25, 2);
  });

  it('reports overdue rather than presenting a past date as upcoming', () => {
    const t = topic({ k_factor: 7.0, strength: 1.3, last_reviewed: '2026-07-07T12:00:00Z' });
    expect(projectedDue(t, NOW)!.overdue).toBe(true);
  });

  it('is null when retention is undefined — never a fabricated date', () => {
    expect(projectedDue(topic({ last_reviewed: null }), NOW)).toBeNull();
    expect(projectedDue(topic({ strength: 0 }), NOW)).toBeNull();
  });
});

describe('E3-S3 — strength increments (Document 2 §3)', () => {
  it.each<[ReviewEvent['kind'], Confidence, number]>([
    ['test_pass', 3, 1.5],
    ['test_fail', 3, 0.15],
    ['study_review', 1, 0.3],
    ['study_review', 2, 0.3],
    ['study_review', 3, 0.6],
    ['study_review', 4, 1.0],
    ['study_review', 5, 1.0],
  ])('%s at confidence %i → +%f', (kind, conf, expected) => {
    expect(strengthIncrement(kind, conf)).toBe(expected);
  });
});

describe('E3-S3 — applyEvent', () => {
  const event: ReviewEvent = {
    event_id: 'event_1',
    date: '2026-07-16T12:00:00Z',
    kind: 'study_review',
    source: 'session',
    source_id: 'session_1',
    confidence_reported: 4,
  };

  it('grows strength, stamps the review date, and appends history', () => {
    const before = topic({ strength: 1, review_history: [] });
    const after = applyEvent(before, event, NOW);
    expect(after.strength).toBe(2.0); // 1 + 1.0 (conf 4)
    expect(after.last_reviewed).toBe(event.date);
    expect(after.review_history).toHaveLength(1);
  });

  it('never mutates the input topic (pure — keeps commits atomic)', () => {
    const before = topic({ strength: 1 });
    const snapshot = structuredClone(before);
    applyEvent(before, event, NOW);
    expect(before).toEqual(snapshot);
  });

  it('strength only ever grows, even on a failed test', () => {
    const before = topic({ strength: 2 });
    const after = applyEvent(
      before,
      { ...event, kind: 'test_fail', test: { score: 1, out_of: 20, actual_retention: 0.05 } },
      NOW,
    );
    expect(after.strength).toBeGreaterThan(before.strength);
  });

  it('seeds strength and promotes on the first event against a Not Started topic (§7)', () => {
    const before = topic({ status: 'not_started', strength: 0, last_reviewed: null });
    const after = applyEvent(before, event, NOW);
    expect(after.status).toBe('learning');
    expect(after.strength).toBeGreaterThan(0);
  });

  /**
   * Document 2 §4.1: drift is measured against what the curve predicted "just
   * before the event" — measuring after would compare the test to a curve the
   * test itself already moved.
   */
  it('measures drift against the pre-event curve', () => {
    const before = topic({
      k_factor: 7.0,
      strength: 1.3,
      last_reviewed: '2026-07-07T12:00:00Z',
      drift_history: [],
    });
    const testEv: ReviewEvent = {
      ...event,
      date: '2026-07-16T12:00:00Z',
      kind: 'test_fail',
      test: { score: 6, out_of: 20, actual_retention: 0.3 },
    };
    const after = applyEvent(before, testEv, NOW);

    // predicted ≈ 0.372 at t=9 → drift ≈ 0.30 − 0.372 = −0.072
    expect(after.drift_history).toHaveLength(1);
    expect(after.drift_history[0]).toBeCloseTo(-0.072, 3);
  });

  it('does not tune kFactor before DRIFT_MIN samples exist', () => {
    const before = topic({ k_factor: 7.0, strength: 1.3, last_reviewed: '2026-07-07T12:00:00Z' });
    const after = applyEvent(
      before,
      { ...event, kind: 'test_fail', test: { score: 6, out_of: 20, actual_retention: 0.3 } },
      NOW,
    );
    expect(after.k_factor).toBe(7.0);
  });
});

describe('E3-S3 — promote (Document 2 §7)', () => {
  it('seeds strength to 1.0 and stamps last_reviewed on first promotion', () => {
    const before = topic({ status: 'not_started', strength: 0, last_reviewed: null });
    const after = promote(before, 'learning', NOW);
    expect(after.strength).toBe(CONFIG.SEED_STRENGTH);
    expect(after.last_reviewed).toBe(NOW.toISOString());
  });

  it('does not overwrite an existing strength on promotion', () => {
    const before = topic({ status: 'not_started', strength: 2.5, last_reviewed: null });
    expect(promote(before, 'learning', NOW).strength).toBe(2.5);
  });

  it('stamps mastered_at on first arrival at Mastered', () => {
    const after = promote(topic({ status: 'practising' }), 'mastered', NOW);
    expect(after.mastered_at).toBe(NOW.toISOString());
  });

  it('never clears mastered_at on demotion — §10 asks who EVER mastered', () => {
    const wasMastered = topic({ status: 'mastered', mastered_at: '2026-07-01T00:00:00Z' });
    const demoted = promote(wasMastered, 'practising', NOW);
    expect(demoted.mastered_at).toBe('2026-07-01T00:00:00Z');
  });
});

describe('E3-S5 — health surfacing (Document 2 §6)', () => {
  it.each<[TopicStatus, boolean]>([
    ['not_started', false],
    ['learning', false],
    ['practising', true],
    ['mastered', true],
  ])('%s → surfaced: %s', (status, expected) => {
    expect(shouldShowHealth(topic({ status }))).toBe(expected);
  });

  it('a topic with no tests scores full calibration (no evidence of miscalibration)', () => {
    // conf 5, fresh review, no errors, no cards, no tests:
    // 0.30·100 + 0.25·100 + 0.20·100 + 0.15·100 + 0.10·0 = 90
    const t = topic({ conf: 5, cards: 0, last_reviewed: NOW.toISOString() });
    expect(health(t, NOW)).toBe(90);
  });
});

describe('E3-S5 — weak ranking (Document 2 §9)', () => {
  it('excludes Not Started and Mastered', () => {
    const refs = [
      ref(topic({ topic_id: 'topic_ns', status: 'not_started' })),
      ref(topic({ topic_id: 'topic_m', status: 'mastered' })),
      ref(topic({ topic_id: 'topic_p', status: 'practising' })),
    ];
    expect(weakTopics(refs, NOW).map((r) => r.topic.topic_id)).toEqual(['topic_p']);
  });

  it('sorts lowest health first', () => {
    const healthy = topic({ topic_id: 'topic_hi', conf: 5, last_reviewed: NOW.toISOString() });
    const weak = topic({ topic_id: 'topic_lo', conf: 1, strength: 0.2, last_reviewed: '2026-07-01T12:00:00Z' });
    expect(weakTopics([ref(healthy), ref(weak)], NOW)[0]!.topic.topic_id).toBe('topic_lo');
  });

  it('breaks health ties by lowest retention', () => {
    // Identical but for review date → identical health inputs except retention.
    const fresher = topic({ topic_id: 'topic_fresh', last_reviewed: '2026-07-15T12:00:00Z' });
    const staler = topic({ topic_id: 'topic_stale', last_reviewed: '2026-07-10T12:00:00Z' });
    const ranked = weakTopics([ref(fresher), ref(staler)], NOW);
    expect(ranked[0]!.topic.topic_id).toBe('topic_stale');
  });
});

describe('E3-S5 — velocity & projection (Document 2 §10)', () => {
  it('is undefined with fewer than 2 topics ever mastered (low-data guard)', () => {
    const refs = [ref(topic({ mastered_at: '2026-07-01T00:00:00Z', status: 'mastered' }))];
    expect(velocity(refs, NOW).defined).toBe(false);
  });

  it('counts topics mastered within the 4-week window', () => {
    const refs = [
      ref(topic({ topic_id: 'topic_1', status: 'mastered', mastered_at: '2026-07-10T00:00:00Z' })),
      ref(topic({ topic_id: 'topic_2', status: 'mastered', mastered_at: '2026-07-12T00:00:00Z' })),
    ];
    const v = velocity(refs, NOW);
    expect(v.defined).toBe(true);
    if (v.defined) expect(v.topicsPerWeek).toBe(2 / CONFIG.VELOCITY_WINDOW_WEEKS);
  });

  it('says "Course complete" when nothing remains', () => {
    const refs = [
      ref(topic({ topic_id: 'topic_1', status: 'mastered', mastered_at: '2026-07-10T00:00:00Z' })),
      ref(topic({ topic_id: 'topic_2', status: 'mastered', mastered_at: '2026-07-12T00:00:00Z' })),
    ];
    expect(projectFinish(refs, NOW)).toEqual({ state: 'complete' });
  });

  it('says "not enough data" rather than fabricating a date', () => {
    const refs = [ref(topic({ topic_id: 'topic_1', status: 'practising' }))];
    expect(projectFinish(refs, NOW).state).toBe('not_enough_data');
  });

  /**
   * The divide-by-zero guard: two topics mastered long ago satisfies the
   * "ever mastered" gate, but the 4-week rate is 0 — which would project an
   * infinite date. E3-S5 forbids Infinity.
   */
  it('does not divide by zero when all mastery predates the window', () => {
    const refs = [
      ref(topic({ topic_id: 'topic_1', status: 'mastered', mastered_at: '2026-01-01T00:00:00Z' })),
      ref(topic({ topic_id: 'topic_2', status: 'mastered', mastered_at: '2026-01-02T00:00:00Z' })),
      ref(topic({ topic_id: 'topic_3', status: 'practising' })),
    ];
    const p = projectFinish(refs, NOW);
    expect(p.state).toBe('not_enough_data');
  });

  it('returns a range, never a single date', () => {
    const refs = [
      ref(topic({ topic_id: 'topic_1', status: 'mastered', mastered_at: '2026-07-10T00:00:00Z' })),
      ref(topic({ topic_id: 'topic_2', status: 'mastered', mastered_at: '2026-07-12T00:00:00Z' })),
      ref(topic({ topic_id: 'topic_3', status: 'practising' })),
    ];
    const p = projectFinish(refs, NOW);
    expect(p.state).toBe('range');
    if (p.state === 'range') {
      expect(p.best.getTime()).toBeLessThan(p.worst.getTime());
      expect(Number.isFinite(p.best.getTime())).toBe(true);
    }
  });
});

describe('E3-S5 — due queue (Document 2 §11)', () => {
  const decayed = (id: string, sectionId: string, strength: number) =>
    ref(topic({ topic_id: id, strength, last_reviewed: '2026-07-01T12:00:00Z' }), sectionId);

  it('sorts most-decayed first', () => {
    const refs = [decayed('topic_hi', 'section_1', 2), decayed('topic_lo', 'section_2', 0.5)];
    expect(dueQueue(refs, 5, NOW)[0]!.topic.topic_id).toBe('topic_lo');
  });

  it('spreads sections — avoids two consecutive topics from the same one', () => {
    const refs = [
      decayed('topic_a1', 'section_a', 0.5),
      decayed('topic_a2', 'section_a', 0.6),
      decayed('topic_b1', 'section_b', 0.7),
    ];
    const sections = dueQueue(refs, 3, NOW).map((r) => r.section.section_id);
    expect(sections).toEqual(['section_a', 'section_b', 'section_a']);
  });

  it('falls back to most-decayed when every candidate shares the last section', () => {
    const refs = [decayed('topic_a1', 'section_a', 0.5), decayed('topic_a2', 'section_a', 0.6)];
    expect(dueQueue(refs, 5, NOW)).toHaveLength(2);
  });

  it('excludes topics that are not due', () => {
    const fresh = ref(topic({ topic_id: 'topic_fresh', last_reviewed: NOW.toISOString() }));
    expect(dueQueue([fresh], 5, NOW)).toHaveLength(0);
  });
});
