import { describe, expect, it } from 'vitest';
import { performanceHealth } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

describe('performanceHealth — anti-gaming invariants', () => {
  it('NO difficulty floor on accuracy: easy independent high-accuracy → modest, non-zero (solid but untested)', () => {
    // independent, difficulty 0, novelty 0, success 0.9. Present sub-scores:
    // accuracy=0.9 (w .30), difficulty=0 (w .20), novelty=0 (w .15). transfer/
    // quality absent → excluded. composite = (.30*.9)/(.30+.20+.15) = .27/.65.
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 0, novelty: 0 }, { test: { score: 9, out_of: 10 } }),
    );
    expect(performanceHealth(events)).toBe(Math.round((0.3 * 0.9) / 0.65 * 100)); // 42
  });

  it('difficulty is success-gated: a failed hard independent attempt adds ~0 difficulty credit', () => {
    // independent, difficulty 5, success 0 → difficulty sub-score 0.
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 5 }, { test: { score: 0, out_of: 10 } }),
    );
    // accuracy=0 and difficulty=0 → composite 0.
    expect(performanceHealth(events)).toBe(0);
  });

  it('rewards difficulty WITH success: solved-hard beats solved-easy', () => {
    const hard = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 5 }, { test: { score: 9, out_of: 10 } }),
    );
    const easy = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3, difficulty: 0 }, { test: { score: 9, out_of: 10 } }),
    );
    expect(performanceHealth(hard)!).toBeGreaterThan(performanceHealth(easy)!);
  });

  it('returns null when fewer than MIN_HEALTH_INPUTS sub-scores are present', () => {
    // Only accuracy is present (no difficulty/novelty/transfer/quality anywhere).
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ independence: 3 }, { test: { score: 9, out_of: 10 } }),
    );
    expect(performanceHealth(events)).toBeNull();
  });
});
