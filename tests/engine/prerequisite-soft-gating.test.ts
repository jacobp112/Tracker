import { describe, it, expect } from 'vitest';
import { prerequisiteInstability } from '@/engine/prerequisites';
import { recommend } from '@/engine/recommend';
import { curriculumPosition } from '@/engine/planning';
import { calculateSoftGating } from '@/engine/gating';
import { CONFIG } from '@/config/constants';
import { emptyStore, type Course, type ErrorPattern, type ReviewEvent, type Store, type Topic } from '@/domain/types';

/**
 * Phase 2 Tasks 2–3 — bounded transitive blocking + soft-gating invariants
 * (workflow §5–9, §47, §53). A weak REMOTE ancestor must not hard-block or
 * high-priority-preempt; only a direct competency failure or a causal
 * high-severity error keeps blocking.
 */

const NOW = new Date('2026-08-20T00:00:00.000Z');
function t(id: string, prerequisites: string[] = [], o: Partial<Topic> = {}): Topic {
  return { topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null, drift_history: [],
    review_history: [], error_log: [], prerequisites, ...o };
}
const failEvent: ReviewEvent = { event_id: 'f', date: '2026-08-18T00:00:00.000Z', kind: 'test_fail',
  source: 'session', source_id: 's', confidence_reported: 2, test: { score: 2, out_of: 10, actual_retention: 0.2 } };
const passEvent: ReviewEvent = { event_id: 'p', date: '2026-08-18T00:00:00.000Z', kind: 'test_pass',
  source: 'exam', source_id: 'x', confidence_reported: 5, test: { score: 10, out_of: 10, actual_retention: 1 } };
function highPattern(id: string, topicIds: string[]): ErrorPattern {
  return { pattern_id: id, signature: 'sig', error_type: 'conceptual', topic_ids: topicIds,
    severity: 'high', occurrence_ids: [`occ_${id}`], first_seen: '2026-08-01T00:00:00Z', last_seen: '2026-08-10T00:00:00Z' };
}
function storeOf(topics: Topic[], patterns: ErrorPattern[] = []): Store {
  const c: Course = { schema_version: '4.0.0', course_id: 'c', title: 'C',
    created_at: '2026-08-01T00:00:00Z', source: 'ai_generated',
    sections: [{ section_id: 's', title: 'S', order: 0, topics }] };
  const s = emptyStore(); s.courses.push(c); s.error_patterns.push(...patterns); return s;
}
const target = (s: Store, id: string) => s.courses[0]!.sections[0]!.topics.find((x) => x.topic_id === id)!;

describe('bounded transitive blocking (workflow §5–9)', () => {
  it('a weak REMOTE ancestor (d=2) does not hard-block a target with its own failures', () => {
    const A = t('A', [], { status: 'learning', last_reviewed: null, strength: 0 });
    const B = t('B', ['A'], { status: 'learning', last_reviewed: null, strength: 0 });
    const C = t('C', ['B'], { status: 'practising', review_history: [failEvent] });
    const s = storeOf([A, B, C]);
    const report = prerequisiteInstability(target(s, 'C'), s, NOW);
    const remoteA = report.upstream.find((u) => u.topic_id === 'A')!;
    const directB = report.upstream.find((u) => u.topic_id === 'B')!;
    expect(remoteA.depth).toBe(2);
    expect(remoteA.isBlocking).toBe(false); // transitive: soft, not hard
    expect(directB.isBlocking).toBe(true); // direct: still hard-blocks
  });

  it('a transitive CAUSAL blocker (d=2, high-severity error) yields a MEDIUM prereq rec, not high', () => {
    // A carries a high-severity error and sits two hops upstream of the (clean)
    // started topic C, behind a not_started intermediate B. A must surface as a
    // this-week nudge, never a high-priority preemption of active reviews.
    const A = t('A', [], { status: 'practising' });
    const B = t('B', ['A'], { status: 'not_started', last_reviewed: null, strength: 0 });
    const C = t('C', ['B'], { status: 'practising' });
    const s = storeOf([A, B, C], [highPattern('p1', ['A'])]);
    const recs = recommend(s, NOW);
    const pre = recs.find((r) => r.action === 'prerequisite' && r.target.id === 'A');
    expect(pre?.priority).toBe('medium');
    expect(pre?.when).toBe('this_week');
    expect(recs.some((r) => r.action === 'prerequisite' && r.priority === 'high')).toBe(false);
  });
});

describe('soft-gating invariants (workflow §47, §53)', () => {
  it('score stays within [FLOOR, 1] for a deep chain', () => {
    const s = storeOf([t('A', [], { status: 'not_started', last_reviewed: null }),
      t('B', ['A']), t('C', ['B']), t('D', ['C']), t('E', ['D'])]);
    const g = calculateSoftGating(target(s, 'E'), s, NOW).score;
    expect(g).toBeGreaterThanOrEqual(CONFIG.RECO.SOFT_GATE_FLOOR);
    expect(g).toBeLessThanOrEqual(1);
  });

  it('allows downstream progress: a non-causal weak upstream leaves a not_started leaf eligible', () => {
    const s = storeOf([t('A', [], { status: 'not_started', last_reviewed: null }),
      t('B', ['A'], { status: 'mastered', strength: 4, conf: 5, review_history: [passEvent] }),
      t('E', ['B'], { status: 'not_started', last_reviewed: null })]);
    const pos = curriculumPosition(s, NOW);
    expect(pos.blockedTopics.map((b) => b.topicId)).not.toContain('E');
  });
});
