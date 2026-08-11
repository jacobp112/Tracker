import { describe, expect, it } from 'vitest';
import { coldPerformance } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

const cold = (extra = {}, test?: { score: number; out_of: number }) =>
  makeEvent({ cold: true, ...extra }, test ? { test } : {});

describe('coldPerformance', () => {
  it('excludes non-cold attempts entirely', () => {
    const events = [
      ...Array.from({ length: 5 }, () => cold({ difficulty: 3 }, { score: 8, out_of: 10 })),
      makeEvent({ difficulty: 5, performance_quality: 5 }), // not cold — must not count
    ];
    expect(coldPerformance(events)!.n).toBe(5);
  });

  it('returns null below MIN_COLD_N cold attempts', () => {
    expect(coldPerformance([cold({ difficulty: 3 }, { score: 8, out_of: 10 })])).toBeNull();
  });

  it('re-normalises over missing dimensions rather than zero-filling them', () => {
    // Cold, correctness only (no difficulty/novelty/etc). Score must reflect the
    // correctness alone (~80), NOT be dragged toward 0 by absent dimensions.
    const events = Array.from({ length: 5 }, () => cold({}, { score: 8, out_of: 10 }));
    expect(coldPerformance(events)!.score).toBeCloseTo(80, 0);
  });

  it('ANTI-GAMING: failed hard/novel cold attempts bank NO difficulty/novelty credit (§18)', () => {
    // Max difficulty & novelty but scored 0. Ungated, difficulty+novelty would
    // bank 0.30 of the composite (→ score 50); success-gated, they contribute 0
    // and — with correctness also 0 — the whole score is 0. Attempting hard/novel
    // cold work and failing must not read as good cold performance.
    const events = Array.from({ length: 5 }, () =>
      cold({ difficulty: 5, novelty: 4 }, { score: 0, out_of: 10 }),
    );
    expect(coldPerformance(events)!.score).toBe(0);
  });

  it('rewards solved hard/novel cold work over solved easy/familiar cold work', () => {
    const hard = Array.from({ length: 5 }, () => cold({ difficulty: 5, novelty: 4 }, { score: 9, out_of: 10 }));
    const easy = Array.from({ length: 5 }, () => cold({ difficulty: 0, novelty: 0 }, { score: 9, out_of: 10 }));
    expect(coldPerformance(hard)!.score).toBeGreaterThan(coldPerformance(easy)!.score);
  });
});
