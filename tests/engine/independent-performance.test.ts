import { describe, expect, it } from 'vitest';
import { independentPerformance } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('independentPerformance — strict tiering', () => {
  it('an independence-2 attempt lands in lightlyAssisted, NOT independent', () => {
    const r = independentPerformance([makeEvent({ independence: 2 }, { test: { score: 10, out_of: 10 } })])!;
    expect(r.independent.n).toBe(0);
    expect(r.lightlyAssisted.n).toBe(1);
  });

  it('an independence-3 attempt lands in independent', () => {
    const r = independentPerformance([makeEvent({ independence: 3 }, { test: { score: 8, out_of: 10 } })])!;
    expect(r.independent.n).toBe(1);
    expect(r.independent.accuracy).toBeCloseTo(0.8);
  });

  it('reports difficulty/novelty of the independent tier separately from assisted', () => {
    const r = independentPerformance([
      makeEvent({ independence: 3, difficulty: 4, novelty: 3 }, { test: { score: 8, out_of: 10 } }),
      makeEvent({ independence: 0, difficulty: 1 }, { test: { score: 10, out_of: 10 } }),
    ])!;
    expect(r.independent.avgDifficulty).toBeCloseTo(4);
    expect(r.independent.avgNovelty).toBeCloseTo(3);
    expect(r.assisted.n).toBe(1);
    expect(r.assisted.accuracy).toBeCloseTo(1);
  });

  it('sufficient is false below MIN_INDEPENDENT_N independent attempts', () => {
    const few = [makeEvent({ independence: 3 }, { test: { score: 8, out_of: 10 } })];
    expect(independentPerformance(few)!.sufficient).toBe(false);
  });

  it('returns null when no attempt carries an independence value', () => {
    expect(independentPerformance([makeEvent({ difficulty: 3 })])).toBeNull();
  });
});
