import { describe, it, expect } from 'vitest';
import { sectionOf, domainRecencyCount, interleavingMultiplier } from '@/engine/maut';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type SessionRecord, type Store, type Topic } from '@/domain/types';

/**
 * Phase 4 Task 2 — bounded domain interleaving (workflow §25–26, §37).
 * domainId = section_id (D6). Suppression saturates so a domain is never
 * permanently excluded.
 */

function t(id: string): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
}
function storeOf(): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C', created_at: '2026-08-01T00:00:00.000Z',
    source: 'ai_generated', sections: [
      { section_id: 'algebra', title: 'Algebra', order: 0, topics: [t('a1'), t('a2')] },
      { section_id: 'geometry', title: 'Geometry', order: 1, topics: [t('g1')] } ] };
  const s = emptyStore(); s.courses.push(c); return s;
}
function session(topic_id: string, completed_at: string): SessionRecord {
  return { session_id: `sess_${topic_id}_${completed_at}`, topic_id, course_id: 'c', created_at: completed_at,
    completed_at, duration_minutes: 30, intent: 'retention', scope: 'topic', timer_mode: 'count_up' };
}

describe('interleavingMultiplier (§25, §37)', () => {
  it('is 1 with no recent same-domain sessions', () => expect(interleavingMultiplier(0)).toBe(1));
  it('applies β per same-domain session', () => {
    expect(interleavingMultiplier(1)).toBeCloseTo(CONFIG.RECO.INTERLEAVE_BETA, 6);
    expect(interleavingMultiplier(3)).toBeCloseTo(Math.pow(CONFIG.RECO.INTERLEAVE_BETA, 3), 6);
  });
  it('saturates at β^K and never reaches 0 (a domain is never permanently excluded)', () => {
    const floor = Math.pow(CONFIG.RECO.INTERLEAVE_BETA, CONFIG.RECO.INTERLEAVE_WINDOW_K);
    expect(interleavingMultiplier(99)).toBeCloseTo(floor, 6);
    expect(interleavingMultiplier(99)).toBeGreaterThan(0);
  });
});

describe('sectionOf / domainRecencyCount (§25, D6)', () => {
  it('resolves a topic to its section id', () => {
    expect(sectionOf('a1', storeOf())).toBe('algebra');
    expect(sectionOf('g1', storeOf())).toBe('geometry');
  });
  it('counts only the last K sessions in the given section', () => {
    const s = storeOf();
    // 6 algebra sessions; only the last K=5 count.
    for (let i = 0; i < 6; i++) s.sessions.push(session('a1', `2026-08-1${i}T00:00:00.000Z`));
    s.sessions.push(session('g1', '2026-08-19T00:00:00.000Z'));
    // newest K: [g1(19), a1(15), a1(14), a1(13), a1(12)] → algebra count 4, geometry 1
    expect(domainRecencyCount('algebra', s)).toBe(4);
    expect(domainRecencyCount('geometry', s)).toBe(1);
  });
});
