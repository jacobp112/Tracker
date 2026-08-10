import { describe, expect, it } from 'vitest';
import { performanceQuality, novelTaskSuccess } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('performanceQuality', () => {
  it('is null below MIN_QUALITY_N observations', () => {
    expect(performanceQuality([makeEvent({ performance_quality: 5 })])).toBeNull();
  });
  it('averages performance_quality onto 0–100 once enough data exists', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ performance_quality: 4 })); // 4/5 → 80
    const r = performanceQuality(events)!;
    expect(r.n).toBe(5);
    expect(r.score).toBeCloseTo(80);
  });
  it('ignores attempts with no performance_quality', () => {
    const events = [...Array.from({ length: 5 }, () => makeEvent({ performance_quality: 4 })), makeEvent({ difficulty: 2 })];
    expect(performanceQuality(events)!.n).toBe(5);
  });
});

describe('novelTaskSuccess', () => {
  it('counts only independent (===3) novel (novelty>=NOVEL_THRESHOLD) attempts', () => {
    const events = [
      // independent + novel + passing → counts
      ...Array.from({ length: 5 }, () => makeEvent({ independence: 3, novelty: 3 }, { test: { score: 9, out_of: 10 } })),
      // independence 2 (lightly assisted) novel → EXCLUDED
      makeEvent({ independence: 2, novelty: 4 }, { test: { score: 10, out_of: 10 } }),
      // independent but not novel → EXCLUDED
      makeEvent({ independence: 3, novelty: 1 }, { test: { score: 10, out_of: 10 } }),
    ];
    const r = novelTaskSuccess(events)!;
    expect(r.n).toBe(5);
    expect(r.rate).toBeCloseTo(1);
  });
  it('is null below MIN_NOVEL_N qualifying observations', () => {
    expect(novelTaskSuccess([makeEvent({ independence: 3, novelty: 4 }, { test: { score: 9, out_of: 10 } })])).toBeNull();
  });
  it('rate is the pass fraction (>= TEST_PASS_MARK)', () => {
    const events = [
      ...Array.from({ length: 3 }, () => makeEvent({ independence: 3, novelty: 3 }, { test: { score: 9, out_of: 10 } })), // pass
      ...Array.from({ length: 2 }, () => makeEvent({ independence: 3, novelty: 3 }, { test: { score: 5, out_of: 10 } })), // fail
    ];
    expect(novelTaskSuccess(events)!.rate).toBeCloseTo(0.6);
  });
});
