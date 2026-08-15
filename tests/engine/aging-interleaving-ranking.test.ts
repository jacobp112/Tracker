import { describe, it, expect } from 'vitest';
import { recommend } from '@/engine/recommend';
import { MS_PER_DAY } from '@/engine/retention';
import { emptyStore, type Course, type SessionRecord, type Store, type Topic } from '@/domain/types';

/**
 * Phase 4 Task 3 — U_final = aged·interleaved ranking + anti-starvation
 * invariants (workflow §24–26, §36–37, §54.8–54.9).
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');

function t(id: string, o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [], ...o };
}
/** last_reviewed placing predicted retention at ~targetR (strength 1, k 8.4). */
function reviewedFor(targetR: number): string {
  const days = -8.4 * 1 * Math.log(targetR);
  return new Date(NOW.getTime() - days * MS_PER_DAY).toISOString();
}
function session(topic_id: string, day: number): SessionRecord {
  const iso = new Date(NOW.getTime() - day * MS_PER_DAY).toISOString();
  return { session_id: `sess_${topic_id}_${day}`, topic_id, course_id: 'c', created_at: iso,
    completed_at: iso, duration_minutes: 30, intent: 'retention', scope: 'topic', timer_mode: 'count_up' };
}
/** Saturates the algebra domain via a mastered filler topic `a_fill` so the
 *  candidates themselves stay out of recent history (isolating interleaving from
 *  the u_vel novelty penalty). */
function storeOf(algebra: Topic[], geometry: Topic[], saturateAlgebra = false): Store {
  const fill = t('a_fill', { status: 'mastered', strength: 6, conf: 5, last_reviewed: reviewedFor(0.99) });
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C', created_at: '2026-06-01T00:00:00.000Z',
    source: 'ai_generated', sections: [
      { section_id: 'algebra', title: 'Algebra', order: 0, topics: [...algebra, fill] },
      { section_id: 'geometry', title: 'Geometry', order: 1, topics: geometry } ] };
  const s = emptyStore(); s.courses.push(c);
  if (saturateAlgebra) s.sessions.push(...[1, 2, 3, 4, 5].map((d) => session('a_fill', d)));
  return s;
}
const rank = (recs: { target: { id: string } }[], id: string) => recs.findIndex((r) => r.target.id === id);

describe('U_final ranking — anti-starvation invariants', () => {
  it('aging is bounded: an urgent review outranks a long-starved low-utility learn topic', () => {
    const urgent = t('urgent', { last_reviewed: reviewedFor(0.4) }); // deeply decayed → high u_mem
    const stale = t('stale', { status: 'not_started', last_reviewed: null }); // eligible ~80d (course created 2026-06-01)
    const recs = recommend(storeOf([urgent], [stale]), NOW);
    expect(rank(recs, 'urgent')).toBeLessThan(rank(recs, 'stale'));
  });

  it('domain recovery + non-exclusion: a saturated-domain topic is suppressed below an equal fresh-domain peer, but still present', () => {
    const alg = t('a1', { last_reviewed: reviewedFor(0.65) }); // due, not urgent
    const geo = t('g1', { last_reviewed: reviewedFor(0.65) }); // identical inputs, other domain
    const recs = recommend(storeOf([alg], [geo], true), NOW);
    expect(rank(recs, 'g1')).toBeLessThan(rank(recs, 'a1')); // geometry surfaces first
    expect(rank(recs, 'a1')).toBeGreaterThanOrEqual(0); // algebra NOT excluded
  });

  it('urgent exemption: an urgent review in a saturated domain is not suppressed, while a non-urgent same-domain peer is', () => {
    const urgentAlg = t('a_urgent', { last_reviewed: reviewedFor(0.4) }); // R<0.55 → exempt
    const normalAlg = t('a_normal', { last_reviewed: reviewedFor(0.65) }); // R>0.55 → suppressed
    const geo = t('g1', { last_reviewed: reviewedFor(0.65) });
    const recs = recommend(storeOf([urgentAlg, normalAlg], [geo], true), NOW);
    expect(rank(recs, 'a_urgent')).toBe(0); // urgent memory always surfaces
    expect(rank(recs, 'g1')).toBeLessThan(rank(recs, 'a_normal')); // non-urgent algebra suppressed below geometry
  });

  it('is deterministic across identical runs', () => {
    const store = storeOf([t('a1', { last_reviewed: reviewedFor(0.6) })], [t('g1', { last_reviewed: reviewedFor(0.55) })], true);
    expect(recommend(store, NOW).map((r) => r.target.id)).toEqual(recommend(store, NOW).map((r) => r.target.id));
  });
});
