import { describe, expect, it } from 'vitest';
import { performanceHealth, observedSuccess, mean } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

/** Naive raw accuracy — the metric the OLD tracker would rank on. */
function rawAccuracy(events: ReturnType<typeof makeEvent>[]): number {
  return mean(events.map(observedSuccess).filter((x): x is number => x !== undefined))!;
}

// Learner A: 95% accuracy, easy (difficulty 1), familiar (novelty 0), ASSISTED
// (independence 1), low transfer, decent quality. 10 attempts.
const learnerA = Array.from({ length: 10 }, () =>
  makeEvent({ difficulty: 1, novelty: 0, independence: 1, transfer_level: 0, performance_quality: 3 },
    { test: { score: 19, out_of: 20 } }),
);

// Learner B: ~82% accuracy, HARD (4–5), NOVEL (3–4), INDEPENDENT (3), strong
// transfer (3), high quality (5). 10 attempts, a couple missed.
const learnerB = [
  ...Array.from({ length: 8 }, () =>
    makeEvent({ difficulty: 5, novelty: 4, independence: 3, transfer_level: 3, performance_quality: 5 },
      { test: { score: 9, out_of: 10 } })),
  ...Array.from({ length: 2 }, () =>
    makeEvent({ difficulty: 4, novelty: 3, independence: 3, transfer_level: 3, performance_quality: 4 },
      { test: { score: 5, out_of: 10 } })),
];

describe('Learner A vs Learner B — the brief success criterion', () => {
  it('A has the higher RAW accuracy (the old tracker would rank A above B)', () => {
    expect(rawAccuracy(learnerA)).toBeGreaterThan(rawAccuracy(learnerB));
    expect(rawAccuracy(learnerA)).toBeGreaterThan(0.9); // ~0.95
  });

  it('B has the higher PERFORMANCE HEALTH (the new layer recognises B is stronger)', () => {
    const a = performanceHealth(learnerA)!;
    const b = performanceHealth(learnerB)!;
    expect(b).toBeGreaterThan(a);
    expect(a).toBeLessThan(40);  // "solid but untested / assisted" reads modest
    expect(b).toBeGreaterThan(70); // beyond-routine, independent → strong
  });

  it('both truths coexist: A higher accuracy AND B higher performance health', () => {
    expect(rawAccuracy(learnerA)).toBeGreaterThan(rawAccuracy(learnerB));
    expect(performanceHealth(learnerB)!).toBeGreaterThan(performanceHealth(learnerA)!);
  });
});
