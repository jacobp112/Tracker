import { describe, expect, it } from 'vitest';
import { buildSessionContext, sessionWrapUpPrompt, startSessionPrompt } from '@/engine/session';
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

describe('startSessionPrompt (opening briefing)', () => {
  it('clean_slate omits learner + errors blocks but keeps the topic', () => {
    const p = build('new_content', 'clean_slate');
    expect(p).toContain('Elasticity');
    expect(p).not.toContain('UNRESOLVED ERRORS');
    expect(p).not.toContain('LEARNER');
  });
  it('topic scope includes learner + unresolved errors', () => {
    const p = build('remediate', 'topic');
    expect(p).toContain('LEARNER');
    expect(p).toContain('UNRESOLVED ERRORS');
    expect(p).toContain('confuses elastic/inelastic');
  });
  it('kicks off a live tutoring session and explicitly defers the JSON', () => {
    const p = build('retention', 'topic');
    expect(p).toContain('BEGIN');
    // It must tell the model to start tutoring, not to emit a log.
    expect(p.toLowerCase()).toMatch(/tutor|teach|start the session/);
    expect(p.toLowerCase()).toContain('do not output');
  });
  it('carries NO session-log schema — that is what made the AI dump JSON immediately', () => {
    const p = build('retention', 'topic');
    expect(p).not.toContain('duration_minutes');
    expect(p).not.toContain('topics_covered');
    expect(p).not.toContain('schema_version');
    expect(p).not.toContain('OUTPUT');
  });
  it('intent drives INSTRUCTIONS + AVOID copy', () => {
    expect(build('remediate', 'topic')).toContain('Do not move on until each error is corrected.');
  });
  it('remediate ALWAYS carries the unresolved errors, even under clean_slate scope', () => {
    // remediate is defined by the error log; without the errors its instruction
    // ("Focus entirely on the unresolved errors…") references nothing. It must
    // override the scope and keep the errors block.
    const p = build('remediate', 'clean_slate');
    expect(p).toContain('UNRESOLVED ERRORS');
    expect(p).toContain('confuses elastic/inelastic');
    expect(p).toContain('listed above'); // errors render before INSTRUCTIONS
  });
});

describe('sessionWrapUpPrompt (import step)', () => {
  const topics = [{ topic_id: 'f', title: 'Elasticity' }, { topic_id: 'g', title: 'Supply' }];
  it('requests the session-log JSON with the real course id and topic ids', () => {
    const p = sessionWrapUpPrompt('course_micro', topics);
    expect(p).toContain('course_micro');
    expect(p).toContain('schema_version');
    expect(p).toContain('topics_covered');
    expect(p).toContain('f → Elasticity');
    expect(p).toContain('g → Supply');
    expect(p.toLowerCase()).toContain('output only');
  });
  it('pins the timekeeper instruction: duration_minutes 0 + app records the real time', () => {
    const p = sessionWrapUpPrompt('c', topics);
    // C1: the app is the only timekeeper. The wrap-up must instruct 0 so the
    // pasted log validates (schema allows 0) and the app overwrites with the
    // measured minutes on commit.
    expect(p).toMatch(/duration_minutes["\s]*:\s*0/);
    expect(p).toContain('the app records the real time');
  });
  it('states confidence is 1-5, not a percentage', () => {
    const p = sessionWrapUpPrompt('c', topics);
    expect(p.toLowerCase()).toMatch(/1-5|1–5/);
    expect(p.toLowerCase()).toContain('not a percentage');
  });
});
