import { describe, expect, it } from 'vitest';
import { validateAgainst } from '@/core/validate';
import type { Course, ErrorLogEntry, ReviewEvent } from '@/domain/types';

/**
 * Phase 1 — the study schemas must ACCEPT the new optional evidence-identity
 * fields (so a store/bundle carrying them re-validates) while `additionalProperties:
 * false` still REJECTS anything hallucinated. These live inside a Course's topic,
 * so we validate a whole course.
 */

function courseWith(event?: Partial<ReviewEvent>, error?: Partial<ErrorLogEntry>): Course {
  const review_history: ReviewEvent[] = event
    ? [
        {
          event_id: 'event_1',
          date: '2026-08-01T00:00:00.000Z',
          kind: 'study_review',
          source: 'session',
          source_id: 'session_1',
          confidence_reported: 3,
          ...event,
        } as ReviewEvent,
      ]
    : [];
  const error_log: ErrorLogEntry[] = error
    ? [
        {
          error_id: 'error_1',
          date: '2026-08-01T00:00:00.000Z',
          source: 'session',
          source_id: 'session_1',
          error_type: 'conceptual',
          description: 'x',
          resolved: false,
          resolved_date: null,
          ...error,
        } as ErrorLogEntry,
      ]
    : [];
  return {
    schema_version: '3.3.0',
    course_id: 'course_1',
    title: 'C',
    created_at: '2026-08-01T00:00:00.000Z',
    source: 'manual',
    sections: [
      {
        section_id: 'section_1',
        title: 'S',
        order: 0,
        topics: [
          {
            topic_id: 'topic_a', title: 'T', status: 'learning', conf: 3, strength: 1,
            k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z',
            drift_history: [], review_history, error_log,
          } as unknown as Course['sections'][number]['topics'][number],
        ],
      },
    ],
  };
}

describe('schema — Phase 1 evidence/error identity fields', () => {
  it('accepts a ReviewEvent carrying provenance and assessment_ref', () => {
    const c = courseWith({
      provenance: 'past_paper',
      assessment_ref: { assessment_id: 'assessment_1', attempt_id: 'attempt_1', question_id: 'question_1' },
    });
    expect(validateAgainst('course', c).ok).toBe(true);
  });

  it('rejects an unknown provenance value', () => {
    const c = courseWith({ provenance: 'made_up' as unknown as ReviewEvent['provenance'] });
    expect(validateAgainst('course', c).ok).toBe(false);
  });

  it('accepts an ErrorLogEntry carrying pattern_id and severity', () => {
    const c = courseWith(undefined, { pattern_id: 'pattern_1', severity: 'high' });
    expect(validateAgainst('course', c).ok).toBe(true);
  });

  it('rejects an unknown severity value', () => {
    const c = courseWith(undefined, { severity: 'apocalyptic' as unknown as ErrorLogEntry['severity'] });
    expect(validateAgainst('course', c).ok).toBe(false);
  });

  it('still rejects a hallucinated field on the event (additionalProperties:false holds)', () => {
    const c = courseWith({ ease_factor: 2.5 } as unknown as Partial<ReviewEvent>);
    expect(validateAgainst('course', c).ok).toBe(false);
  });
});
