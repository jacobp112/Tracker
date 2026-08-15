import { describe, expect, it } from 'vitest';
import { recommend } from '@/engine/recommend';
import type { Course, ErrorPattern, Store, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';

const NOW = new Date('2026-08-20T00:00:00.000Z');

function topic(id: string, title: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title, status: 'learning', conf: 4, strength: 1, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-20T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [{
      event_id: 'ev_1', date: '2026-08-20T00:00:00.000Z', kind: 'test_pass', source: 'session', source_id: 's_1',
      confidence_reported: 4, test: { score: 97, out_of: 100, actual_retention: 0.97 },
    }], error_log: [], ...opts,
  };
}

function pattern(opts: Partial<ErrorPattern> = {}): ErrorPattern {
  return {
    pattern_id: 'pattern_1', signature: 'Treated sample space as event outcomes', error_type: 'conceptual',
    topic_ids: ['topic_sample_spaces'], severity: 'high', occurrence_ids: ['error_1'],
    first_seen: '2026-08-10T00:00:00.000Z', last_seen: '2026-08-15T00:00:00.000Z', ...opts,
  };
}

function storeWith(topics: Topic[], patterns: ErrorPattern[] = []): Store {
  const course: Course = {
    schema_version: '3.3.0', course_id: 'course_1', title: 'Probability & Statistics',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'Core Probability', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  s.error_patterns.push(...patterns);
  return s;
}

describe('Recommendation Causal Clarity & Evidence Roles', () => {
  it('explains why a high retention topic (97%) is recommended for prerequisite remediation', () => {
    const upstream = topic('topic_sample_spaces', 'Sample spaces and events', {
      status: 'learning',
      error_log: [{
        error_id: 'error_1', date: '2026-08-15T00:00:00.000Z', source: 'session', source_id: 's_prev',
        error_type: 'conceptual', description: 'Treated sample space as event outcomes', resolved: false, resolved_date: null,
      }],
    });
    const downstream = topic('topic_conditional', 'Conditional probability', {
      status: 'learning',
      prerequisites: ['topic_sample_spaces'],
    });

    const store = storeWith([upstream, downstream], [pattern()]);
    const recs = recommend(store, NOW);
    const prereqRec = recs.find((r) => r.action === 'prerequisite');

    expect(prereqRec).toBeDefined();
    expect(prereqRec!.target.id).toBe('topic_sample_spaces');

    // Reasoning should explicitly contrast high overall retention with unresolved error / prerequisite precedence
    expect(prereqRec!.reason).toContain('retention is strong');
    expect(prereqRec!.reason).toContain('unresolved error');
    expect(prereqRec!.reason).toContain('Conditional probability');

    // Evidence should carry explicit roles distinguishing prerequisite, dependent topic, and unresolved error
    const prereqEv = prereqRec!.evidence.find((e) => e.kind === 'topic' && e.id === 'topic_sample_spaces');
    const depEv = prereqRec!.evidence.find((e) => e.kind === 'topic' && e.id === 'topic_conditional');
    const errEv = prereqRec!.evidence.find((e) => e.kind === 'pattern');

    expect(prereqEv).toBeDefined();
    expect(prereqEv?.role).toBe('prerequisite');

    expect(depEv).toBeDefined();
    expect(depEv?.role).toBe('dependent');

    expect(errEv).toBeDefined();
    expect(errEv?.role).toBe('unresolved_error');
  });

  it('surfaces the prerequisite intervention at high priority (MAUT-ranked, §13)', () => {
    // Post-§13 the static cascade is gone: candidates rank by MAUT utility, so the
    // failed downstream topic can lead. The behavioural guarantee that survives is
    // that the direct prerequisite intervention still SURFACES at high priority.
    const upstream = topic('topic_sample_spaces', 'Sample spaces and events', { status: 'learning' });
    const downstream = topic('topic_conditional', 'Conditional probability', {
      status: 'learning',
      prerequisites: ['topic_sample_spaces'],
      review_history: [{ event_id: 'ed_fail', date: NOW.toISOString(), kind: 'test_fail', source: 'session', source_id: 'sd', confidence_reported: 2, test: { score: 2, out_of: 10, actual_retention: 0.2 } }],
    });
    const recs = recommend(storeWith([upstream, downstream]), NOW);
    const prereqRec = recs.find((r) => r.action === 'prerequisite');
    expect(prereqRec).toBeDefined();
    expect(prereqRec!.priority).toBe('high');
  });
});
