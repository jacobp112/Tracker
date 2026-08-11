import { describe, expect, it } from 'vitest';
import type {
  AssessmentEvidence,
  Difficulty,
  Independence,
  Novelty,
  PerformanceQuality,
  ReviewEvent,
  TransferLevel,
} from '@/domain/types';

describe('AssessmentEvidence type', () => {
  it('accepts a fully-populated block and round-trips its values', () => {
    const a: AssessmentEvidence = {
      difficulty: 4,
      novelty: 3,
      independence: 3,
      transfer_level: 2,
      performance_quality: 5,
      quality_rationale: 'clear method selection, minor slips',
      cold: true,
      predicted_success: 0.7,
      predicted_at: '2026-08-10T09:00:00.000Z',
      assessed_by: 'tutor:opus',
    };
    expect(a.difficulty).toBe(4);
    expect(a.cold).toBe(true);
    expect(a.predicted_at).toBe('2026-08-10T09:00:00.000Z');
  });

  it('accepts an empty block (every dimension optional — partial applicability)', () => {
    const a: AssessmentEvidence = {};
    expect(a.difficulty).toBeUndefined();
    expect(a.transfer_level).toBeUndefined();
  });

  it('attaches to a ReviewEvent as an optional field', () => {
    const event: ReviewEvent = {
      event_id: 'event_abc123',
      date: '2026-08-10T10:00:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 'session_x',
      confidence_reported: 4,
      assessment: { difficulty: 2, independence: 3 },
    };
    expect(event.assessment?.independence).toBe(3);
  });

  it('a ReviewEvent WITHOUT assessment is still valid (backward compatible)', () => {
    const legacy: ReviewEvent = {
      event_id: 'event_legacy',
      date: '2026-01-01T00:00:00.000Z',
      kind: 'study_review',
      source: 'session',
      source_id: 'session_old',
      confidence_reported: 3,
    };
    expect(legacy.assessment).toBeUndefined();
  });

  it('ordinals reject out-of-range values at compile time', () => {
    // @ts-expect-error 6 is above the Difficulty range (0–5)
    const badDifficulty: Difficulty = 6;
    // @ts-expect-error 5 is above the Novelty range (0–4)
    const badNovelty: Novelty = 5;
    // @ts-expect-error 4 is above the Independence range (0–3)
    const badIndependence: Independence = 4;
    // @ts-expect-error 4 is above the TransferLevel range (0–3)
    const badTransfer: TransferLevel = 4;
    // @ts-expect-error 6 is above the PerformanceQuality range (0–5)
    const badQuality: PerformanceQuality = 6;
    expect([badDifficulty, badNovelty, badIndependence, badTransfer, badQuality]).toHaveLength(5);
  });
});
