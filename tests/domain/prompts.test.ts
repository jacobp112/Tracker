import { describe, expect, it } from 'vitest';
import { coursePrompt, sessionPrompt, examPrompt, coldAssessmentPrompt } from '@/domain/prompts';
import { emptyStore, type Store } from '@/domain/types';

function storeWithTopic(): Store {
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: 'topic_1', title: 'T', status: 'practising', conf: 3, strength: 1, k_factor: 8.4,
      cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null, drift_history: [],
      review_history: [], error_log: [],
    }] }],
  });
  return s;
}

/**
 * Seam test — the prompts (what the app asks the tutor to produce) must stay in
 * lockstep with the schema (what the tracker accepts). The Performance feature's
 * whole gap was that this seam was untested: the schema accepted assessment
 * fields the prompts never asked for.
 */
describe('prompts carry the assessment contract', () => {
  const DIMENSIONS = ['difficulty', 'novelty', 'independence', 'transfer_level', 'performance_quality'];

  it('the session prompt asks for the assessment block and every dimension', () => {
    const p = sessionPrompt('course_1', [{ topic_id: 'topic_1', title: 'T' }]);
    expect(p).toContain('assessment');
    for (const d of DIMENSIONS) expect(p).toContain(d);
  });

  it('the session prompt does NOT ask for predictions (calibration needs a predict-first flow that does not exist yet)', () => {
    const p = sessionPrompt('course_1', [{ topic_id: 'topic_1', title: 'T' }]);
    expect(p).not.toContain('predicted_success');
  });

  it('the exam prompt asks for per-topic assessment and the exam-level cold flag', () => {
    const p = examPrompt(storeWithTopic());
    expect(p).toContain('assessment');
    expect(p).toContain('cold');
    for (const d of DIMENSIONS) expect(p).toContain(d);
  });

  it('the course prompt asks for prerequisites and lists existing topics for cross-course dependencies', () => {
    const p = coursePrompt(storeWithTopic());
    expect(p).toContain('prerequisites');
    expect(p).toContain('topic_1'); // existing topic injected so it can be cited as a prerequisite
  });

  it('the course prompt still works when no other courses exist', () => {
    const p = coursePrompt(emptyStore());
    expect(p).toContain('prerequisites');
  });

  it('a cold-assessment prompt exists, marks the result cold, and states the cold protocol', () => {
    const p = coldAssessmentPrompt(storeWithTopic());
    expect(p).toContain('cold');
    expect(p.toLowerCase()).toMatch(/no hints|no notes|unaided|unfamiliar/);
    for (const d of DIMENSIONS) expect(p).toContain(d);
  });
});
