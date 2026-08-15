import { describe, expect, it } from 'vitest';
import { recommend } from '@/engine/recommend';
import { MS_PER_DAY, predictRetention } from '@/engine/retention';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * V2 — the review-priority tiers must be distinguishable by decay depth.
 *
 * Before the fix, `isDue` and `projectedDue().overdue` shared one threshold, so
 * every due topic was "overdue" and the `medium`/`this_week` review tier was
 * dead code — all reviews flooded `high`/`within_48h`. These specs pin that a
 * mildly-decayed topic lands in `medium` while a deeply-decayed one lands in
 * `high`.
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');

function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [], ...opts,
  };
}

/** last_reviewed placing `predictRetention` at ~targetR for a strength-1 topic
 *  (P = 1, so s = strength; t = −k·s·ln R). Lets the specs target a retention
 *  band without hard-coding timestamps. */
function reviewedFor(targetR: number, now: Date, strength = 1, k = 8.4): string {
  const t = -k * strength * Math.log(targetR);
  return new Date(now.getTime() - t * MS_PER_DAY).toISOString();
}

function storeWith(topics: Topic[]): Store {
  const course: Course = {
    schema_version: '3.3.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  return s;
}

describe('V2 — review priority reflects decay depth', () => {
  it('a mildly-decayed due topic (R just under threshold) is medium / this_week', () => {
    const a = topic('topic_a', { last_reviewed: reviewedFor(0.68, NOW) });
    // sanity: it is due but not severely overdue
    const r = predictRetention(a, NOW)!;
    expect(r).toBeLessThan(CONFIG.DUE_THRESHOLD);
    expect(r).toBeGreaterThan(CONFIG.DUE_THRESHOLD - CONFIG.OVERDUE_MARGIN);

    const rec = recommend(storeWith([a]), NOW).find((x) => x.action === 'review' && x.target.id === 'topic_a');
    expect(rec).toBeDefined();
    expect(rec!.priority).toBe('medium');
    expect(rec!.when).toBe('this_week');
  });

  it('a deeply-decayed due topic (R well under threshold) is high / within_48h', () => {
    const b = topic('topic_b', { last_reviewed: reviewedFor(0.40, NOW) });
    const r = predictRetention(b, NOW)!;
    expect(r).toBeLessThan(CONFIG.DUE_THRESHOLD - CONFIG.OVERDUE_MARGIN);

    const rec = recommend(storeWith([b]), NOW).find((x) => x.action === 'review' && x.target.id === 'topic_b');
    expect(rec).toBeDefined();
    expect(rec!.priority).toBe('high');
    expect(rec!.when).toBe('within_48h');
  });

  it('distributes two due topics into both bands rather than collapsing to high', () => {
    const a = topic('topic_a', { last_reviewed: reviewedFor(0.68, NOW) });
    const b = topic('topic_b', { last_reviewed: reviewedFor(0.40, NOW) });
    const recs = recommend(storeWith([a, b]), NOW).filter((x) => x.action === 'review');
    const byId = new Map(recs.map((r) => [r.target.id, r.priority]));
    expect(byId.get('topic_a')).toBe('medium');
    expect(byId.get('topic_b')).toBe('high');
  });
});
