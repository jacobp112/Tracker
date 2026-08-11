import { describe, expect, it } from 'vitest';
import { topicDiagnostics } from '@/engine/performance-view';
import { makeEvent } from './assessment-fixtures';

describe('topicDiagnostics — raw, unguarded per-topic view', () => {
  it('surfaces raw independent accuracy and transfer/quality below the headline min-N (would be null in the guarded composites)', () => {
    // Two independent (===3) attempts, each a full pass, carrying transfer + quality.
    const events = [
      makeEvent({ independence: 3, difficulty: 4, novelty: 3, transfer_level: 3, performance_quality: 4 }, { test: { score: 10, out_of: 10 } }),
      makeEvent({ independence: 3, difficulty: 5, novelty: 4, transfer_level: 3, performance_quality: 4 }, { test: { score: 8, out_of: 10 } }),
    ];
    const d = topicDiagnostics(events);
    expect(d.assessedCount).toBe(2);
    expect(d.independentN).toBe(2);
    expect(d.independentAccuracy).toBeCloseTo(0.9); // mean(1.0, 0.8)
    expect(d.avgTransfer).toBeCloseTo(100);         // transfer 3/3 → 100
    expect(d.avgQuality).toBeCloseTo(80);           // quality 4/5 → 80
    expect(d.difficulty.length).toBeGreaterThan(0); // independent-only spread present
    expect(d.novelty.length).toBeGreaterThan(0);
  });

  it('returns honest zeros/nulls/empties when there is no assessment data', () => {
    const events = [makeEvent(undefined)]; // a bare review_history event, no assessment
    const d = topicDiagnostics(events);
    expect(d.assessedCount).toBe(0);
    expect(d.independentAccuracy).toBeNull();
    expect(d.independentN).toBe(0);
    expect(d.avgTransfer).toBeNull();
    expect(d.avgQuality).toBeNull();
    expect(d.difficulty).toEqual([]);
    expect(d.novelty).toEqual([]);
  });
});
