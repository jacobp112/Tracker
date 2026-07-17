import { describe, expect, it } from 'vitest';
import { activityStep, healthStop, retentionStop } from '@/design/scale';

describe('retentionStop — Document 3 §2.2(a)', () => {
  /**
   * The approved mockup encodes these exact rows; they are the ground truth
   * the 3-stop boundaries were derived from.
   */
  it.each([
    [92, 'success'],
    [89, 'success'],
    [88, 'success'],
    [85, 'success'],
    [81, 'warning'],
    [76, 'warning'],
    [72, 'warning'],
    [38, 'danger'],
    [25, 'danger'],
  ])('reads %i%% as %s (mockup parity)', (pct, expected) => {
    expect(retentionStop(pct)).toBe(expected);
  });

  it('places the boundaries at 85 and 40', () => {
    expect(retentionStop(85)).toBe('success');
    expect(retentionStop(84.9)).toBe('warning');
    expect(retentionStop(40)).toBe('warning');
    expect(retentionStop(39.9)).toBe('danger');
  });

  it('puts DUE_THRESHOLD (70%) inside the warning band, per §2.2(a)', () => {
    expect(retentionStop(70)).toBe('warning');
  });

  it('handles the extremes', () => {
    expect(retentionStop(100)).toBe('success');
    expect(retentionStop(0)).toBe('danger');
  });
});

describe('healthStop — Document 2 §6 bands', () => {
  it('maps > 70 high, 40–70 mid, < 40 low', () => {
    expect(healthStop(92)).toBe('success');
    expect(healthStop(71)).toBe('success');
    // 70 is the top of the mid band: Doc 2 §6 says "> 70 high", "40–70 mid".
    expect(healthStop(70)).toBe('warning');
    expect(healthStop(50)).toBe('warning');
    expect(healthStop(40)).toBe('warning');
    expect(healthStop(39)).toBe('danger');
    expect(healthStop(0)).toBe('danger');
  });

  it('reads the Document 2 §12 worked example (health 50) as mid/amber', () => {
    expect(healthStop(50)).toBe('warning');
  });
});

describe('activityStep — Document 3 §2.2(b)', () => {
  it('maps a zero day to step 0', () => {
    expect(activityStep(0, 8)).toBe(0);
  });

  it('maps the busiest day to the top step', () => {
    expect(activityStep(8, 8)).toBe(4);
  });

  it('never returns step 0 for a day that had any activity', () => {
    // A day with real study must not render as an empty cell.
    expect(activityStep(1, 100)).toBe(1);
  });

  it('distributes intermediate values across the ramp', () => {
    expect(activityStep(2, 8)).toBe(1);
    expect(activityStep(4, 8)).toBe(2);
    expect(activityStep(6, 8)).toBe(3);
  });

  it('does not divide by zero on an empty window', () => {
    expect(activityStep(0, 0)).toBe(0);
    expect(activityStep(3, 0)).toBe(0);
  });
});
