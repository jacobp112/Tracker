import { describe, expect, it } from 'vitest';
import { evidenceTier } from '@/engine/performance';
import type { AssessmentEvidence, ReviewEvent, AssessmentProvenance } from '@/domain/types';

/**
 * Phase 1 — evidence hierarchy (design §H). evidenceTier is a pure, per-event
 * function returning 0–6. Independence is THE gate for certifying tiers (≥4);
 * a missing independence signal NEVER earns an independent tier, and `smeared`
 * always collapses to 0 regardless of other signals.
 */

function ev(
  kind: ReviewEvent['kind'],
  opts: { assessment?: AssessmentEvidence; provenance?: AssessmentProvenance; smeared?: boolean } = {},
): ReviewEvent {
  const e: ReviewEvent = {
    event_id: 'event_1',
    date: '2026-08-01T00:00:00.000Z',
    kind,
    source: kind === 'study_review' ? 'session' : 'exam',
    source_id: 'src_1',
    confidence_reported: 3,
  };
  if (kind !== 'study_review') e.test = { score: 8, out_of: 10, actual_retention: 0.8 };
  if (opts.assessment) e.assessment = opts.assessment;
  if (opts.provenance) e.provenance = opts.provenance;
  if (opts.smeared !== undefined) e.smeared = opts.smeared;
  return e;
}

describe('evidenceTier', () => {
  it('smeared collapses to 0 even with strong independence', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 3, cold: true }, smeared: true }))).toBe(0);
  });

  it('past-paper cold independent is the gold benchmark (6)', () => {
    expect(
      evidenceTier(ev('test_pass', { assessment: { independence: 3, cold: true }, provenance: 'past_paper' })),
    ).toBe(6);
  });

  it('cold independent from any source is 5', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 3, cold: true } }))).toBe(5);
  });

  it('independent but not cold is 4', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 3 } }))).toBe(4);
  });

  it('lightly assisted (independence 2) is 3', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 2 } }))).toBe(3);
  });

  it('assisted (independence 0 or 1) is 2', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 1 } }))).toBe(2);
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 0 } }))).toBe(2);
  });

  it('a real test outcome with no independence signal floors at 2 (cannot certify independence)', () => {
    expect(evidenceTier(ev('test_fail', {}))).toBe(2);
  });

  it('cold alone without an independence rating does not earn an independent tier', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { cold: true } }))).toBe(2);
  });

  it('a bare study review with no assessment metadata is 1', () => {
    expect(evidenceTier(ev('study_review', {}))).toBe(1);
  });

  it('past_paper provenance does not lift a non-independent attempt above its independence tier', () => {
    expect(evidenceTier(ev('test_pass', { assessment: { independence: 2 }, provenance: 'past_paper' }))).toBe(3);
  });
});
