import { describe, expect, it } from 'vitest';
import { performanceByDifficulty, performanceByNovelty } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('performanceByDifficulty — independent-only', () => {
  it('excludes an independence-2 attempt from every bucket', () => {
    const buckets = performanceByDifficulty([
      makeEvent({ independence: 2, difficulty: 4 }, { test: { score: 10, out_of: 10 } }),
    ]);
    expect(buckets).toEqual([]); // the lightly-assisted attempt is not counted
  });

  it('buckets independent attempts by difficulty with a pass-rate', () => {
    const buckets = performanceByDifficulty([
      makeEvent({ independence: 3, difficulty: 4 }, { test: { score: 10, out_of: 10 } }), // pass
      makeEvent({ independence: 3, difficulty: 4 }, { test: { score: 5, out_of: 10 } }),  // fail
    ]);
    expect(buckets).toEqual([{ level: 4, n: 2, successRate: 0.5 }]);
  });
});

describe('performanceByNovelty — independent-only', () => {
  it('buckets independent attempts by novelty', () => {
    const buckets = performanceByNovelty([
      makeEvent({ independence: 3, novelty: 3 }, { test: { score: 9, out_of: 10 } }), // pass
    ]);
    expect(buckets).toEqual([{ level: 3, n: 1, successRate: 1 }]);
  });
});
