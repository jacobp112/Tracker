import { describe, expect, it } from 'vitest';
import { recommend } from '@/engine/recommend';
import type { Course, ErrorLogEntry, ErrorPattern, Store, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';

const NOW = new Date('2026-08-20T00:00:00.000Z');

function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-18T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [], ...opts,
  };
}

function occ(id: string, date: string): ErrorLogEntry {
  return { error_id: id, date, source: 'session', source_id: 'session_x',
    error_type: 'conceptual', description: 'd', resolved: false, resolved_date: null };
}

function pattern(opts: Partial<ErrorPattern> = {}): ErrorPattern {
  return {
    pattern_id: 'pattern_1', signature: 'sig', error_type: 'conceptual', topic_ids: ['topic_a'],
    severity: 'high', occurrence_ids: ['error_1', 'error_2'],
    first_seen: '2026-08-10T00:00:00.000Z', last_seen: '2026-08-15T00:00:00.000Z', ...opts,
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

describe('recommend — the "what should I do next?" cascade', () => {
  it('surfaces a critical error remediation, and ranks it first', () => {
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-10T00:00:00.000Z'), occ('error_2', '2026-08-15T00:00:00.000Z')],
      last_reviewed: '2026-08-01T00:00:00.000Z', // also due, so it competes with a review
    });
    const recs = recommend(storeWith([t], [pattern()]), NOW);
    expect(recs[0]!.action).toBe('remediate');
    expect(recs[0]!.priority).toBe('critical');
    expect(recs[0]!.target).toEqual({ kind: 'pattern', id: 'pattern_1', title: 'sig' });
    expect(recs[0]!.reason.length).toBeGreaterThan(0);
    expect(recs[0]!.evidence.length).toBeGreaterThan(0);
  });

  it('recommends prerequisite remediation when an upstream topic is unstable', () => {
    const upstream = topic('topic_up', { status: 'learning' }); // learning ⇒ unstable prerequisite
    const downstream = topic('topic_dn', { status: 'practising', prerequisites: ['topic_up'] });
    const recs = recommend(storeWith([upstream, downstream]), NOW);
    const pre = recs.find((r) => r.action === 'prerequisite');
    expect(pre).toBeDefined();
    expect(pre!.target.id).toBe('topic_up');
  });

  it('recommends a review for a decayed (due) topic', () => {
    const decayed = topic('topic_a', { last_reviewed: '2026-08-01T00:00:00.000Z', strength: 1 });
    const recs = recommend(storeWith([decayed]), NOW);
    expect(recs.some((r) => r.action === 'review' && r.target.id === 'topic_a')).toBe(true);
  });

  it('recommends learning a not_started topic whose prerequisites are satisfied', () => {
    const done = topic('topic_a', { status: 'mastered' });
    const next = topic('topic_b', { status: 'not_started', last_reviewed: null, prerequisites: ['topic_a'] });
    const recs = recommend(storeWith([done, next]), NOW);
    expect(recs.some((r) => r.action === 'learn' && r.target.id === 'topic_b')).toBe(true);
  });

  it('does NOT recommend learning a not_started topic with an unsatisfied prerequisite', () => {
    const weakPrereq = topic('topic_a', { status: 'learning' });
    const blocked = topic('topic_b', { status: 'not_started', last_reviewed: null, prerequisites: ['topic_a'] });
    const recs = recommend(storeWith([weakPrereq, blocked]), NOW);
    expect(recs.some((r) => r.action === 'learn' && r.target.id === 'topic_b')).toBe(false);
  });

  it('produces no remediation for a verified-resolved pattern', () => {
    // resolved occurrence (remediation) + an independent cold pass afterwards verifies it
    const t = topic('topic_a', {
      error_log: [{ ...occ('error_1', '2026-08-10T00:00:00.000Z'), resolved: true, resolved_date: '2026-08-12T00:00:00.000Z' }],
      review_history: [{
        event_id: 'event_ok', date: '2026-08-14T00:00:00.000Z', kind: 'test_pass', source: 'exam',
        source_id: 'exam_1', confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 },
        assessment: { independence: 3, cold: true }, // tier 5 ⇒ verifies even high severity
      }],
    });
    const recs = recommend(storeWith([t], [pattern({ occurrence_ids: ['error_1'] })]), NOW);
    expect(recs.some((r) => r.action === 'remediate')).toBe(false);
  });

  it('orders critical above medium', () => {
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-10T00:00:00.000Z'), occ('error_2', '2026-08-15T00:00:00.000Z')],
      last_reviewed: '2026-08-01T00:00:00.000Z',
    });
    const recs = recommend(storeWith([t], [pattern()]), NOW);
    const rankOf = (p: string) => ['critical', 'high', 'medium', 'low'].indexOf(p);
    for (let i = 1; i < recs.length; i++) {
      expect(rankOf(recs[i - 1]!.priority)).toBeLessThanOrEqual(rankOf(recs[i]!.priority));
    }
  });
});
