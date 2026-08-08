import { describe, expect, it } from 'vitest';
import { buildSessionContext, startSessionPrompt } from '@/engine/session';
import type { Course, Section, Topic } from '@/domain/types';

const NOW = new Date('2026-08-07T12:00:00Z');
// minimal focal topic with one unresolved error
const focal: Topic = { topic_id: 'f', title: 'Elasticity', status: 'practising', conf: 4, strength: 1, k_factor: 8, cards: 0,
  last_reviewed: new Date(NOW.getTime() - 5 * 86400000).toISOString(), mastered_at: null, drift_history: [],
  review_history: [{ event_id: 'e', date: new Date(NOW.getTime() - 5*86400000).toISOString(), kind: 'study_review', source: 'session', source_id: 's', confidence_reported: 4 }],
  error_log: [{ error_id: 'x', date: '', source: 'session', source_id: 's', error_type: 'conceptual', description: 'confuses elastic/inelastic', resolved: false, resolved_date: null }] };
const sec: Section = { section_id: 's', title: 'Elasticity', order: 0, topics: [focal] };
const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'Micro', created_at: '', source: 'ai_generated', sections: [sec] };
const build = (intent: any, scope: any) => startSessionPrompt(buildSessionContext(course, sec, focal, intent, scope, NOW), intent, scope);

describe('startSessionPrompt', () => {
  it('clean_slate omits learner + errors blocks but keeps topic + OUTPUT', () => {
    const p = build('new_content', 'clean_slate');
    expect(p).toContain('Elasticity');
    expect(p).not.toContain('UNRESOLVED ERRORS');
    expect(p).not.toContain('LEARNER');
    expect(p).toContain('OUTPUT');
  });
  it('topic scope includes learner + unresolved errors', () => {
    const p = build('remediate', 'topic');
    expect(p).toContain('LEARNER');
    expect(p).toContain('UNRESOLVED ERRORS');
    expect(p).toContain('confuses elastic/inelastic');
  });
  it('OUTPUT always tells the AI not to estimate time and to set duration_minutes to 0', () => {
    const p = build('retention', 'topic');
    expect(p).toMatch(/duration_minutes.*0/);
    expect(p.toLowerCase()).toMatch(/app records the time|do not estimate/);
  });
  it('intent drives INSTRUCTIONS + AVOID copy', () => {
    expect(build('remediate', 'topic')).toContain('Do not move on until each error is corrected.');
  });
});
