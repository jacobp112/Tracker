import { describe, expect, it } from 'vitest';
import { CONFIG } from '@/config/constants';
import {
  badges,
  calibrationScore,
  cardScore,
  confidenceScore,
  errorScore,
  health,
  overconfidenceIndex,
  retentionScore,
  topicVelocity,
} from '@/engine/metrics';
import { isDue, predictRetention } from '@/engine/retention';
import { pushDrift, tuneKFactor } from '@/engine/recalculate';
import type { ReviewEvent, Topic } from '@/domain/types';

/**
 * Document 2 §12 — "Worked example (real numbers)", encoded as a test.
 * Document 4 E3-S3 makes this a hard acceptance criterion: "every intermediate
 * value matched".
 *
 * The topic: "Algebraic fractions" — strength 1.3, kFactor 7.0, reviewed 9 days
 * ago, confidence 4, activeErrors 2, cards 1, one test scoring 11/20 at
 * confidence 4, three reviews in total.
 */

const NOW = new Date('2026-07-16T12:00:00Z');
const REVIEWED = new Date('2026-07-07T12:00:00Z'); // exactly 9 days before NOW

function testEvent(): ReviewEvent {
  return {
    event_id: 'event_test01',
    date: '2026-07-07T12:00:00Z',
    kind: 'test_fail', // 11/20 = 0.55 < 0.80 pass mark
    source: 'exam',
    source_id: 'exam_worked01',
    confidence_reported: 4,
    test: { score: 11, out_of: 20, actual_retention: 0.55 },
  };
}

function studyEvent(id: string): ReviewEvent {
  return {
    event_id: id,
    date: '2026-07-01T12:00:00Z',
    kind: 'study_review',
    source: 'session',
    source_id: 'session_worked1',
    confidence_reported: 4,
  };
}

function algebraicFractions(): Topic {
  return {
    topic_id: 'topic_worked001',
    title: 'Algebraic fractions',
    status: 'practising',
    conf: 4,
    strength: 1.3,
    k_factor: 7.0,
    cards: 1,
    last_reviewed: REVIEWED.toISOString(),
    mastered_at: null,
    drift_history: [],
    // "velocity = 1.3 / 3 reviews" — three reviews, one of them the test.
    review_history: [studyEvent('event_s1'), studyEvent('event_s2'), testEvent()],
    error_log: [
      {
        error_id: 'error_1',
        date: '2026-07-01T12:00:00Z',
        source: 'session',
        source_id: 'session_worked1',
        error_type: 'conceptual',
        description: 'Cancelled across a sum.',
        resolved: false,
        resolved_date: null,
      },
      {
        error_id: 'error_2',
        date: '2026-07-01T12:00:00Z',
        source: 'session',
        source_id: 'session_worked1',
        error_type: 'procedural',
        description: 'Lost a sign flipping the divisor.',
        resolved: false,
        resolved_date: null,
      },
    ],
  };
}

describe('Document 2 §12 worked example — retention', () => {
  it('t = 9, k·s = 9.1 → R = e^(−0.989) = 0.372 → 37%', () => {
    const topic = algebraicFractions();
    expect(topic.k_factor * topic.strength).toBeCloseTo(9.1, 10);

    const r = predictRetention(topic, NOW)!;
    expect(r).toBeCloseTo(0.372, 3);
    expect(Math.round(r * 100)).toBe(37);
  });

  it('is below DUE_THRESHOLD (0.70), so it is due for review', () => {
    expect(isDue(algebraicFractions(), NOW)).toBe(true);
  });
});

describe('Document 2 §12 worked example — OCI', () => {
  it('one test: (4/5) − (11/20) = 0.80 − 0.55 = +0.25 → overconfident', () => {
    expect(overconfidenceIndex(algebraicFractions())).toBeCloseTo(0.25, 10);
  });
});

describe('Document 2 §12 worked example — health sub-scores', () => {
  const topic = algebraicFractions();

  it('retentionScore = 37.2', () => {
    expect(retentionScore(topic, NOW)).toBeCloseTo(37.2, 1);
  });

  it('errorScore = 40 (2 active errors)', () => {
    expect(errorScore(topic)).toBe(40);
  });

  it('calibrationScore = 100 × (1 − 0.25) = 75', () => {
    expect(calibrationScore(topic)).toBeCloseTo(75, 10);
  });

  it('confidenceScore = (4/5) × 100 = 80', () => {
    expect(confidenceScore(topic)).toBe(80);
  });

  it('cardScore = min(100, 1 × 20) = 20', () => {
    expect(cardScore(topic)).toBe(20);
  });

  it('health = 11.16 + 10 + 15 + 12 + 2 = 50 (mid band, amber)', () => {
    expect(health(topic, NOW)).toBe(50);
  });
});

describe('Document 2 §12 worked example — badges', () => {
  it('velocity = 1.3 / 3 ≈ 0.43', () => {
    expect(topicVelocity(algebraicFractions())).toBeCloseTo(0.4333, 3);
  });

  it('fires Slow growth (≥3 reviews, velocity < 0.5)', () => {
    expect(badges(algebraicFractions()).map((b) => b.id)).toContain('slow_growth');
  });

  it('does NOT fire Under-carded — that needs cards = 0, and cards = 1', () => {
    expect(badges(algebraicFractions()).map((b) => b.id)).not.toContain('under_carded');
  });

  it('fires Brittle fluency (confidence 4 ≥ 4 and the latest test missed 80%)', () => {
    expect(badges(algebraicFractions()).map((b) => b.id)).toContain('brittle_fluency');
  });
});

describe('Document 2 §12 worked example — self-tuning', () => {
  /**
   * "Suppose the next test shows actual retention 0.30 while the curve predicted
   * 0.37 → drift = −0.07. After three such negative samples averaging below
   * −0.10, kFactor drops to 7.0 × 0.9 = 6.3 (still above K_MIN 4.2)."
   */
  it('a single −0.07 drift sample does not tune — DRIFT_MIN is 3', () => {
    const history = pushDrift([], -0.07);
    expect(history).toEqual([-0.07]);
    expect(tuneKFactor(7.0, history)).toBe(7.0);
  });

  it('drift within the ±0.10 band does not tune, even at 3 samples', () => {
    // mean = −0.07, inside DRIFT_BAND → no change.
    expect(tuneKFactor(7.0, [-0.07, -0.07, -0.07])).toBe(7.0);
  });

  it('three samples averaging below −0.10 drop kFactor to 7.0 × 0.9 = 6.3', () => {
    expect(tuneKFactor(7.0, [-0.12, -0.11, -0.13])).toBeCloseTo(6.3, 10);
  });

  it('the tuned kFactor stays above K_MIN (4.2)', () => {
    expect(tuneKFactor(7.0, [-0.12, -0.11, -0.13])).toBeGreaterThan(CONFIG.K_MIN);
  });

  it('positive drift beyond the band lengthens the curve', () => {
    expect(tuneKFactor(7.0, [0.2, 0.2, 0.2])).toBeCloseTo(7.7, 10);
  });

  it('clamps to K_MIN and K_MAX', () => {
    expect(tuneKFactor(CONFIG.K_MIN, [-0.5, -0.5, -0.5])).toBe(CONFIG.K_MIN);
    expect(tuneKFactor(CONFIG.K_MAX, [0.5, 0.5, 0.5])).toBe(CONFIG.K_MAX);
  });

  it('keeps only the most recent DRIFT_WINDOW (5) samples', () => {
    let h: number[] = [];
    for (const d of [-0.01, -0.02, -0.03, -0.04, -0.05, -0.06]) h = pushDrift(h, d);
    expect(h).toEqual([-0.02, -0.03, -0.04, -0.05, -0.06]);
  });
});
