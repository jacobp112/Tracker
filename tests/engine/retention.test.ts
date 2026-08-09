import { describe, it, expect } from 'vitest';
import { predictRetention, elapsedDays } from '@/engine/retention';
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';

function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_a', title: 'A', status: 'practising', conf: 3,
    strength: 1, k_factor: CONFIG.DECAY_K, cards: 0,
    last_reviewed: null, mastered_at: null, drift_history: [],
    review_history: [], error_log: [], ...over,
  };
}

describe('elapsedDays', () => {
  it('is fractional, not floored', () => {
    const from = new Date('2026-08-08T00:00:00Z');
    const to = new Date('2026-08-08T12:00:00Z');
    expect(elapsedDays(from, to)).toBeCloseTo(0.5, 6);
  });
});

describe('predictRetention with fractional t', () => {
  it('decays within the same day (s=1, k=8.4, 12h → e^(-0.5/8.4))', () => {
    const reviewed = new Date('2026-08-08T00:00:00Z');
    const now = new Date('2026-08-08T12:00:00Z');
    const t = topic({ last_reviewed: reviewed.toISOString(), strength: 1 });
    expect(predictRetention(t, now)).toBeCloseTo(Math.exp(-0.5 / (CONFIG.DECAY_K * 1)), 6);
  });
  it('still returns 1 for t <= 0 (reviewed same instant / backdated)', () => {
    const reviewed = new Date('2026-08-08T12:00:00Z');
    const t = topic({ last_reviewed: reviewed.toISOString() });
    expect(predictRetention(t, reviewed)).toBe(1);
  });
});
