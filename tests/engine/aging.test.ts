import { describe, it, expect } from 'vitest';
import { queueResidenceDays, agingBoost } from '@/engine/maut';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type ReviewEvent, type Store, type Topic } from '@/domain/types';

/**
 * Phase 4 Task 1 — bounded priority aging (workflow §24, §36, §54.8).
 * Aging mitigates starvation; it is bounded and never a guarantee of selection.
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');
function t(id: string, o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [], ...o };
}
function storeOf(topics: Topic[], createdAt = '2026-08-01T00:00:00.000Z'): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C', created_at: createdAt,
    source: 'ai_generated', sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); return s;
}
const ev = (date: string): ReviewEvent => ({ event_id: 'e', date, kind: 'study_review',
  source: 'session', source_id: 's', confidence_reported: 3 });

describe('queueResidenceDays (§24)', () => {
  it('measures days since the last review event', () => {
    const topic = t('x', { review_history: [ev('2026-08-13T00:00:00.000Z')] });
    expect(queueResidenceDays(topic, storeOf([topic]), NOW)).toBeCloseTo(7, 5);
  });
  it('is 0 for a never-reviewed topic (not part of the retention-based starvation population)', () => {
    const topic = t('x', { status: 'not_started' });
    expect(queueResidenceDays(topic, storeOf([topic], '2026-01-01T00:00:00.000Z'), NOW)).toBe(0);
  });
  it('is never negative', () => {
    const topic = t('x', { review_history: [ev('2026-08-25T00:00:00.000Z')] }); // future
    expect(queueResidenceDays(topic, storeOf([topic]), NOW)).toBe(0);
  });
});

describe('agingBoost (§24, §36)', () => {
  const maxU = 0.8;
  it('is 0 at zero residence', () => expect(agingBoost(0, maxU)).toBe(0));
  it('is 0 when there is no utility scale', () => expect(agingBoost(100, 0)).toBe(0));
  it('increases monotonically with residence', () => {
    expect(agingBoost(20, maxU)).toBeGreaterThan(agingBoost(5, maxU));
  });
  it('is bounded by AGING_MAX_FRACTION·maxU and never exceeds it', () => {
    const cap = CONFIG.RECO.AGING_MAX_FRACTION * maxU;
    expect(agingBoost(1e9, maxU)).toBeLessThanOrEqual(cap);
    expect(agingBoost(1e9, maxU)).toBeCloseTo(cap, 6);
  });
});
