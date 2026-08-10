import { describe, expect, it } from 'vitest';
import { calibrationError, isForesightPrediction } from '@/engine/performance';
import { makeEvent } from './assessment-fixtures';

const ATTEMPT = '2026-08-10T12:00:00.000Z';
const BEFORE = '2026-08-10T09:00:00.000Z';
const AFTER = '2026-08-10T15:00:00.000Z';

const pred = (predicted_at: string | undefined, score = 8) =>
  makeEvent(
    { predicted_success: 0.9, ...(predicted_at ? { predicted_at } : {}) },
    { date: ATTEMPT, test: { score, out_of: 10 } },
  );

describe('isForesightPrediction — the foresight rule', () => {
  it('counts a prediction made strictly before the attempt', () => {
    expect(isForesightPrediction(pred(BEFORE))).toBe(true);
  });
  it('excludes a prediction timestamped AT the attempt (not strictly before)', () => {
    expect(isForesightPrediction(pred(ATTEMPT))).toBe(false);
  });
  it('excludes a prediction made AFTER the attempt (hindsight)', () => {
    expect(isForesightPrediction(pred(AFTER))).toBe(false);
  });
  it('excludes a prediction with no predicted_at (unverifiable → hindsight)', () => {
    expect(isForesightPrediction(pred(undefined))).toBe(false);
  });
});

describe('calibrationError', () => {
  it('aggregates only foresight predictions; hindsight ones do not move it', () => {
    // 5 foresight predictions (0.9 predicted, 0.8 observed) + a hindsight one that
    // would skew the number if wrongly counted.
    const foresight = Array.from({ length: 5 }, () => pred(BEFORE)); // |0.9-0.8|=0.1
    const hindsight = pred(AFTER, 0); // predicted 0.9, observed 0 — must be ignored
    const r = calibrationError([...foresight, hindsight])!;
    expect(r.n).toBe(5);
    expect(r.meanAbsError).toBeCloseTo(0.1);
    expect(r.bias).toBeCloseTo(0.1); // over-predicted by 0.1
  });

  it('returns null below MIN_CALIBRATION_N foresight predictions', () => {
    expect(calibrationError([pred(BEFORE), pred(BEFORE)])).toBeNull();
  });
});
