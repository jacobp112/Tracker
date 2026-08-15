import { describe, it, expect } from 'vitest';
import { calculateSoftGating } from '@/engine/gating';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type ErrorLogEntry, type ErrorPattern, type Store, type Topic } from '@/domain/types';

/**
 * Phase 2 Task 1 — distance-attenuated, bounded, evidence-driven soft gating
 * (workflow §11, §54.4). Because health-derived mastery floors ~0.45 for
 * evidence-free topics, tests assert attenuation/bounds/cap relationships and
 * use one deliberately near-zero-mastery ancestor to exercise the floor clamp.
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');

function t(id: string, prerequisites: string[] = [], o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'not_started', conf: 1, strength: 0, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [],
    error_log: [], prerequisites, ...o };
}
function pat(id: string, topicId: string, signature: string, severity: 'low' | 'medium' | 'high' = 'high'): ErrorPattern {
  return { pattern_id: id, signature, error_type: 'conceptual', topic_ids: [topicId],
    severity, occurrence_ids: [`occ_${id}`], first_seen: '2026-08-01T00:00:00Z', last_seen: '2026-08-10T00:00:00Z' };
}
function storeOf(topics: Topic[], patterns: ErrorPattern[] = []): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); s.error_patterns.push(...patterns); return s;
}
function chain(patterns: ErrorPattern[] = []): Store {
  return storeOf([t('A'), t('B', ['A']), t('C', ['B']), t('D', ['C']), t('E', ['D'])], patterns);
}
const target = (s: Store, id: string) => s.courses[0]!.sections[0]!.topics.find((x) => x.topic_id === id)!;
const SIG = 'sign error carrying negative';

describe('calculateSoftGating', () => {
  it('is 1.0 when there are no ancestors', () => {
    const s = storeOf([t('solo')]);
    expect(calculateSoftGating(target(s, 'solo'), s).score).toBe(1);
  });

  it('is 1.0 when ancestors carry no error evidence (S_err = 0)', () => {
    const s = chain();
    expect(calculateSoftGating(target(s, 'E'), s).score).toBe(1);
  });

  it('a remote (d=4) ancestor with a STRONG matching misconception is only mildly dampened', () => {
    const s = chain([pat('pa', 'A', SIG), pat('pe', 'E', SIG)]);
    const g = calculateSoftGating(target(s, 'E'), s).score;
    expect(g).toBeGreaterThan(0.8);
    expect(g).toBeLessThan(1);
  });

  it('a DIRECT (d=1) strong match dampens MORE than the same match at distance', () => {
    const s = chain([pat('pa', 'A', SIG), pat('pe', 'E', SIG)]);
    const remote = calculateSoftGating(target(s, 'E'), s).score;
    const ds = storeOf([t('P'), t('Q', ['P'])], [pat('pp', 'P', SIG), pat('pq', 'Q', SIG)]);
    const direct = calculateSoftGating(target(ds, 'Q'), ds).score;
    expect(direct).toBeLessThan(remote);
    expect(direct).toBeGreaterThanOrEqual(CONFIG.RECO.SOFT_GATE_FLOOR);
  });

  it('caps a dense DAG to the top-3 contributors and never drops below the floor', () => {
    const roots = Array.from({ length: 10 }, (_, i) => t(`r${i}`));
    const leaf = t('leaf', roots.map((r) => r.topic_id));
    const patterns = [pat('pl', 'leaf', 'shared misconception token'),
      ...roots.map((r, i) => pat(`pr${i}`, r.topic_id, 'shared misconception token'))];
    const s = storeOf([...roots, leaf], patterns);
    const res = calculateSoftGating(target(s, 'leaf'), s);
    expect(res.topBlockers.length).toBe(3);
    expect(res.score).toBeGreaterThanOrEqual(CONFIG.RECO.SOFT_GATE_FLOOR);
    expect(res.score).toBeLessThan(1);
  });

  it('clamps to the floor for a genuinely near-zero-mastery direct ancestor', () => {
    const errs: ErrorLogEntry[] = ['e1', 'e2', 'e3'].map((id) => ({ error_id: id, date: '2026-06-01T00:00:00Z',
      source: 'session', source_id: 's', error_type: 'conceptual', description: 'd', resolved: false, resolved_date: null }));
    const weakP = t('P', [], { status: 'learning', conf: 1, strength: 1, last_reviewed: '2026-06-01T00:00:00Z',
      error_log: errs, review_history: [{ event_id: 'tf', date: '2026-06-01T00:00:00Z', kind: 'test_fail',
        source: 'exam', source_id: 'x', confidence_reported: 5, test: { score: 0, out_of: 10, actual_retention: 0 } }] });
    const q = t('Q', ['P'], { status: 'practising' });
    const s = storeOf([weakP, q], [pat('pp', 'P', 'sign error negative'), pat('pq', 'Q', 'sign error negative')]);
    expect(calculateSoftGating(target(s, 'Q'), s, NOW).score).toBe(CONFIG.RECO.SOFT_GATE_FLOOR);
  });
});
