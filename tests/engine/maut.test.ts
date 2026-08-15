import { describe, it, expect } from 'vitest';
import {
  memoryUrgency, foundationalRisk, curriculumVelocity, sessionFeasibility,
  deriveMAUTWeights, compositeUtility, type MAUTContext,
} from '@/engine/maut';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type Exam, type Store, type Topic } from '@/domain/types';

const NOW = new Date('2026-08-20T00:00:00.000Z');

function t(id: string, prerequisites: string[] = [], o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], prerequisites, ...o };
}
function storeOf(topics: Topic[], exams: Exam[] = []): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); s.exams.push(...exams); return s;
}
const ctx = (o: Partial<MAUTContext> = {}): MAUTContext => ({ timeRemainingMinutes: null, recentHistory: [], ...o });

describe('memoryUrgency (§15)', () => {
  it('is 0 for a never-reviewed topic', () => {
    expect(memoryUrgency(t('x', [], { status: 'not_started', last_reviewed: null }), NOW)).toBe(0);
  });
  it('is within [0,1] and rises as retention falls', () => {
    const fresh = t('a', [], { last_reviewed: '2026-08-19T00:00:00.000Z', strength: 3 });
    const decayed = t('b', [], { last_reviewed: '2026-07-10T00:00:00.000Z', strength: 1 });
    const uf = memoryUrgency(fresh, NOW); const ud = memoryUrgency(decayed, NOW);
    for (const u of [uf, ud]) { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); }
    expect(ud).toBeGreaterThan(uf);
  });
});

describe('sessionFeasibility (D5)', () => {
  it('is 1.0 when the task fits, or when T_rem is unknown', () => {
    expect(sessionFeasibility(15, 30)).toBe(1);
    expect(sessionFeasibility(15, null)).toBe(1);
    expect(sessionFeasibility(30, 30)).toBe(1);
  });
  it('decays smoothly below 1 for an oversized task', () => {
    const u = sessionFeasibility(60, 15);
    expect(u).toBeGreaterThan(0); expect(u).toBeLessThan(1);
    expect(sessionFeasibility(90, 15)).toBeLessThan(u); // more oversized → lower
  });
});

describe('curriculumVelocity (§17)', () => {
  it('is within [0,1], lower for higher mastery and for recently-studied topics', () => {
    const fresh = t('n', [], { status: 'not_started', last_reviewed: null });
    const mastered = t('m', [], { status: 'mastered', strength: 6, conf: 5, last_reviewed: '2026-08-19T00:00:00.000Z' });
    const uf = curriculumVelocity(fresh, [], NOW);
    const um = curriculumVelocity(mastered, [], NOW);
    const uRecent = curriculumVelocity(fresh, ['n'], NOW);
    for (const u of [uf, um, uRecent]) { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(1); }
    expect(uf).toBeGreaterThan(um);
    expect(uRecent).toBeLessThan(uf);
  });
});

describe('foundationalRisk (§16)', () => {
  it('is within [0,1] and higher when many weak downstream dependents exist', () => {
    const foundation = t('f');
    const deps = ['d1', 'd2', 'd3'].map((id) => t(id, ['f'], { status: 'not_started', last_reviewed: null }));
    const s = storeOf([foundation, ...deps]);
    const withDeps = foundationalRisk(foundation, s, NOW);
    const leaf = foundationalRisk(t('leaf'), storeOf([t('leaf')]), NOW);
    expect(withDeps).toBeGreaterThanOrEqual(0); expect(withDeps).toBeLessThanOrEqual(1);
    expect(leaf).toBe(0); // no downstream → no foundational risk
    expect(withDeps).toBeGreaterThan(leaf);
  });
});

describe('deriveMAUTWeights (§19–22, §54.6)', () => {
  it('base weights sum to 1', () => {
    const w = deriveMAUTWeights(storeOf([t('x')]), ctx(), NOW);
    expect(w.mem + w.found + w.vel + w.feas).toBeCloseTo(1, 9);
  });
  it('an imminent exam raises w_found relative to base', () => {
    const exam: Exam = { schema_version: '4.0.0', exam_id: 'e', title: 'E',
      date: '2026-08-22T00:00:00.000Z', linked_topic_ids: ['x'], score: 0, max_score: 100 };
    const w = deriveMAUTWeights(storeOf([t('x')], [exam]), ctx(), NOW);
    expect(w.found).toBeGreaterThan(CONFIG.RECO.MAUT_BASE_WEIGHTS.found);
    expect(w.mem + w.found + w.vel + w.feas).toBeCloseTo(1, 9);
  });
  it('exhaustion raises w_feas, and combined shifts stay non-negative and sum to 1', () => {
    const exam: Exam = { schema_version: '4.0.0', exam_id: 'e', title: 'E',
      date: '2026-08-21T00:00:00.000Z', linked_topic_ids: ['x'], score: 0, max_score: 100 };
    const w = deriveMAUTWeights(storeOf([t('x')], [exam]), ctx({ timeRemainingMinutes: 5 }), NOW);
    expect(w.feas).toBeGreaterThan(CONFIG.RECO.MAUT_BASE_WEIGHTS.feas);
    for (const v of Object.values(w)) expect(v).toBeGreaterThanOrEqual(0);
    expect(w.mem + w.found + w.vel + w.feas).toBeCloseTo(1, 9);
  });
});

describe('compositeUtility', () => {
  it('is within [0,1] and reports the dominant sub-utility', () => {
    const s = storeOf([t('x')]);
    const r = compositeUtility(t('x'), 15, s, ctx(), NOW);
    expect(r.utility).toBeGreaterThanOrEqual(0); expect(r.utility).toBeLessThanOrEqual(1);
    // dominant = the highest WEIGHTED contribution (what drove the composite).
    const contrib = {
      mem: r.weights.mem * r.subUtilities.memoryUrgency,
      found: r.weights.found * r.subUtilities.foundationalRisk,
      vel: r.weights.vel * r.subUtilities.curriculumVelocity,
      feas: r.weights.feas * r.subUtilities.sessionFeasibility,
    } as const;
    const expected = (['mem', 'found', 'vel', 'feas'] as const).reduce((a, b) => (contrib[b] > contrib[a] ? b : a));
    expect(r.dominantUtility).toBe(expected);
  });
});
