import { describe, expect, it } from 'vitest';
import { rankSiblings, courseSnapshot, buildSessionContext } from '@/engine/session';
import type { Course, Section, Topic } from '@/domain/types';

const NOW = new Date('2026-08-07T12:00:00Z');
function topic(over: Partial<Topic>): Topic {
  return {
    topic_id: 't', title: 'T', status: 'practising', conf: 3, strength: 1, k_factor: 8, cards: 0,
    last_reviewed: new Date(NOW.getTime() - 5 * 86400000).toISOString(), mastered_at: null,
    drift_history: [], review_history: [{ event_id: 'e', date: new Date(NOW.getTime() - 5 * 86400000).toISOString(), kind: 'study_review', source: 'session', source_id: 's', confidence_reported: 3 }],
    error_log: [], ...over,
  };
}
function section(topics: Topic[]): Section { return { section_id: 'sec', title: 'Sec', order: 0, topics }; }

describe('rankSiblings', () => {
  it('excludes the focal topic and caps at 5', () => {
    const topics = Array.from({ length: 8 }, (_, i) => topic({ topic_id: `t${i}`, title: `T${i}` }));
    const out = rankSiblings(section(topics), 't0', 'retention', NOW);
    expect(out.length).toBe(5);
    expect(out.find((s) => s.topic_id === 't0')).toBeUndefined();
  });

  it('retention intent surfaces the most-faded siblings first', () => {
    const strong = topic({ topic_id: 'strong', title: 'Strong', strength: 6 });
    const weak = topic({ topic_id: 'weak', title: 'Weak', strength: 0.2 });
    const out = rankSiblings(section([topic({ topic_id: 'focal' }), strong, weak]), 'focal', 'retention', NOW);
    expect(out[0]!.topic_id).toBe('weak');
  });
});

describe('courseSnapshot', () => {
  it('reports per-section mastery ratios and ≤5 weaknesses', () => {
    const mastered = topic({ topic_id: 'm', status: 'mastered' });
    const learning = topic({ topic_id: 'l', status: 'learning', strength: 0.2 });
    const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'C', created_at: '', source: 'ai_generated', sections: [section([mastered, learning])] };
    const snap = courseSnapshot(course, NOW);
    expect(snap.sections[0]).toMatchObject({ mastered: 1, total: 2 });
    expect(snap.topWeaknesses.length).toBeLessThanOrEqual(5);
  });
});

describe('buildSessionContext', () => {
  const focal = topic({ topic_id: 'focal', title: 'Elasticity', conf: 4, error_log: [
    { error_id: 'x', date: '', source: 'session', source_id: 's', error_type: 'conceptual', description: 'confuses elastic/inelastic', resolved: false, resolved_date: null },
  ]});
  const sec = section([focal, topic({ topic_id: 'sib', title: 'Demand' })]);
  const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'Micro', created_at: '', source: 'ai_generated', sections: [sec] };

  it('clean_slate carries only topic identity — no learner data', () => {
    const ctx = buildSessionContext(course, sec, focal, 'new_content', 'clean_slate', NOW);
    expect(ctx.topic.title).toBe('Elasticity');
    expect(ctx.learner).toBeUndefined();
    expect(ctx.unresolvedErrors).toEqual([]);
    expect(ctx.siblings).toEqual([]);
    expect(ctx.snapshot).toBeNull();
  });

  it('topic scope includes learner signals + unresolved errors, no siblings', () => {
    const ctx = buildSessionContext(course, sec, focal, 'remediate', 'topic', NOW);
    expect(ctx.learner?.confidence).toBe(4);
    expect(ctx.unresolvedErrors).toContain('confuses elastic/inelastic');
    expect(ctx.siblings).toEqual([]);
  });

  it('section scope adds ranked siblings; course scope adds a snapshot', () => {
    expect(buildSessionContext(course, sec, focal, 'retention', 'section', NOW).siblings.length).toBeGreaterThan(0);
    expect(buildSessionContext(course, sec, focal, 'adaptive', 'course', NOW).snapshot).not.toBeNull();
  });
});
