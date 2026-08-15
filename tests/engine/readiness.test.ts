import { describe, expect, it } from 'vitest';
import { assessReadiness } from '@/engine/readiness';
import type { Course, ErrorPattern, ReviewEvent, Store, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';

const NOW = new Date('2026-08-20T00:00:00.000Z');

function coldPass(i: number): ReviewEvent {
  return {
    event_id: `event_${i}`, date: `2026-08-1${i}T00:00:00.000Z`, kind: 'test_pass',
    source: 'exam', source_id: 'exam_1', confidence_reported: 4,
    test: { score: 9, out_of: 10, actual_retention: 0.9 },
    assessment: { independence: 3, cold: true }, // tier 5
  };
}

function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'mastered', conf: 4, strength: 5, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-19T00:00:00.000Z', mastered_at: '2026-08-10T00:00:00.000Z',
    drift_history: [], review_history: [], error_log: [], ...opts,
  };
}

function storeWith(topics: Topic[], patterns: ErrorPattern[] = []): Store {
  const course: Course = {
    schema_version: '3.3.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  s.error_patterns.push(...patterns);
  return s;
}

const ready = () => topic('topic_a', { review_history: [1, 2, 3, 4, 5].map(coldPass) });

describe('assessReadiness', () => {
  it('is READY when coverage, prerequisites, errors, retention and cold evidence all pass', () => {
    const r = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([ready()]), NOW);
    expect(r.verdict).toBe('ready');
    expect(r.blocking.every((c) => c.state === 'pass')).toBe(true);
  });

  it('always returns the full criteria checklist, whatever the verdict', () => {
    const r = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([ready()]), NOW);
    const ids = r.criteria.map((c) => c.id);
    expect(ids).toContain('coverage');
    expect(ids).toContain('prerequisites');
    expect(ids).toContain('no_critical_errors');
    expect(ids).toContain('retention');
    expect(ids).toContain('cold_performance');
  });

  it('is NOT_READY (never ready) when a target topic is not yet practising', () => {
    const r = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([topic('topic_a', { status: 'learning', review_history: [1, 2, 3, 4, 5].map(coldPass) })]), NOW);
    expect(r.verdict).toBe('not_ready');
    expect(r.criteria.find((c) => c.id === 'coverage')!.state).toBe('fail');
  });

  it('is INSUFFICIENT_EVIDENCE (not not_ready) when everything passes but there is no cold evidence yet', () => {
    const noEvidence = topic('topic_a', {
      review_history: [{ event_id: 'e1', date: '2026-08-18T00:00:00.000Z', kind: 'study_review', source: 'session', source_id: 's1', confidence_reported: 4 }],
    });
    const r = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([noEvidence]), NOW);
    expect(r.verdict).toBe('insufficient_evidence');
    expect(r.criteria.find((c) => c.id === 'cold_performance')!.state).toBe('unknown');
  });

  it('is NOT_READY when a prerequisite is unstable', () => {
    const upstream = topic('topic_up', { status: 'learning', strength: 1, mastered_at: null });
    const target = topic('topic_a', { review_history: [1, 2, 3, 4, 5].map(coldPass), prerequisites: ['topic_up'] });
    const r = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([upstream, target]), NOW);
    expect(r.verdict).toBe('not_ready');
    expect(r.criteria.find((c) => c.id === 'prerequisites')!.state).toBe('fail');
  });

  it('is NOT_READY when a target carries an unresolved high-severity error', () => {
    const t = topic('topic_a', {
      review_history: [1, 2, 3, 4, 5].map(coldPass),
      error_log: [
        { error_id: 'error_1', date: '2026-08-16T00:00:00.000Z', source: 'session', source_id: 's1', error_type: 'conceptual', description: 'd', resolved: false, resolved_date: null },
        { error_id: 'error_2', date: '2026-08-17T00:00:00.000Z', source: 'session', source_id: 's1', error_type: 'conceptual', description: 'd', resolved: false, resolved_date: null },
      ],
    });
    const pattern: ErrorPattern = {
      pattern_id: 'pattern_1', signature: 'sig', error_type: 'conceptual', topic_ids: ['topic_a'],
      severity: 'high', occurrence_ids: ['error_1', 'error_2'],
      first_seen: '2026-08-16T00:00:00.000Z', last_seen: '2026-08-17T00:00:00.000Z',
    };
    const r = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([t], [pattern]), NOW);
    expect(r.verdict).toBe('not_ready');
    expect(r.criteria.find((c) => c.id === 'no_critical_errors')!.state).toBe('fail');
  });

  it('a formative target accepts independent (non-cold) evidence where a benchmark would not', () => {
    const indepOnly = topic('topic_a', {
      review_history: [1, 2, 3, 4, 5].map((i) => ({ ...coldPass(i), assessment: { independence: 3 } })), // tier 4, not cold
    });
    const formative = assessReadiness({ topic_ids: ['topic_a'], benchmark: false }, storeWith([indepOnly]), NOW);
    const benchmark = assessReadiness({ topic_ids: ['topic_a'], benchmark: true }, storeWith([indepOnly]), NOW);
    expect(formative.verdict).toBe('ready');
    expect(benchmark.verdict).toBe('insufficient_evidence'); // no cold evidence
  });
});
