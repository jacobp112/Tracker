import { describe, expect, it } from 'vitest';
import { validateAgainst } from '@/core/validate';

const fullAssessment = {
  difficulty: 4, novelty: 3, independence: 3, transfer_level: 2,
  performance_quality: 5, quality_rationale: 'clear method', cold: true,
  predicted_success: 0.7, predicted_at: '2026-08-10T09:00:00.000Z',
  assessed_by: 'tutor:opus',
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '3.2.0', session_id: 'session_1', course_id: 'course_1',
    date: '2026-08-10T10:00:00.000Z', duration_minutes: 0,
    topics_covered: [{ topic_id: 'topic_a', confidence_reported: 4, ...overrides }],
  };
}

function exam(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '3.2.0', exam_id: 'exam_1', title: 'E',
    date: '2026-08-10T10:00:00.000Z', linked_topic_ids: ['topic_a'],
    score: 8, max_score: 10, ...overrides,
  };
}

describe('assessment schema — acceptance', () => {
  it('accepts a session topic carrying a full assessment block', () => {
    expect(validateAgainst('session', session({ assessment: fullAssessment })).ok).toBe(true);
  });

  it('accepts an exam with top-level cold and a breakdown assessment', () => {
    const r = validateAgainst('exam', exam({
      cold: true,
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10, assessment: { difficulty: 3 } }],
    }));
    expect(r.ok).toBe(true);
  });

  it('accepts an exam with top-level cold and no breakdown', () => {
    expect(validateAgainst('exam', exam({ cold: true })).ok).toBe(true);
  });

  it('accepts a course topic declaring prerequisites', () => {
    const course = {
      schema_version: '3.2.0', course_id: 'course_1', title: 'C',
      created_at: '2026-08-10T00:00:00.000Z', source: 'manual',
      sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
        topic_id: 'topic_c', title: 'T', status: 'not_started', conf: 1,
        strength: 0, k_factor: 8.4, cards: 0, last_reviewed: null,
        drift_history: [], review_history: [], error_log: [],
        prerequisites: ['topic_a', 'topic_b'],
      }] }],
    };
    expect(validateAgainst('course', course).ok).toBe(true);
  });
});

describe('assessment schema — backward compatibility', () => {
  it('still accepts a legacy session with no assessment', () => {
    expect(validateAgainst('session', session()).ok).toBe(true);
  });
  it('still accepts a legacy exam with no cold / no breakdown assessment', () => {
    expect(validateAgainst('exam', exam({
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10 }],
    })).ok).toBe(true);
  });
});

describe('assessment schema — rejection', () => {
  it('rejects an out-of-range difficulty (6)', () => {
    expect(validateAgainst('session', session({ assessment: { difficulty: 6 } })).ok).toBe(false);
  });
  it('rejects predicted_success outside 0–1', () => {
    expect(validateAgainst('session', session({ assessment: { predicted_success: 1.5 } })).ok).toBe(false);
  });
  it('rejects an unknown key inside assessment (additionalProperties:false)', () => {
    expect(validateAgainst('session', session({ assessment: { made_up: 1 } })).ok).toBe(false);
  });
  it('rejects a malformed predicted_at (Ajv date-time format assertion)', () => {
    // The one field whose only runtime guard is the format assertion — a bad
    // date-time from a tutor paste must not slip through as a valid string.
    expect(validateAgainst('session', session({ assessment: { predicted_at: 'not-a-date' } })).ok).toBe(false);
  });
});
