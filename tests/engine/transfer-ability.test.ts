import { describe, expect, it } from 'vitest';
import { transferAbility } from '@/engine/performance';
import type { TransferLevel } from '@/domain/types';
import { makeEvent } from './assessment-fixtures';

const withTransfer = (level: number, date?: string) => makeEvent({ transfer_level: level as TransferLevel }, { date });

describe('transferAbility', () => {
  it('returns null below MIN_TRANSFER_N observations (no score on 1–2 obs)', () => {
    expect(transferAbility([withTransfer(3), withTransfer(3)])).toBeNull();
  });

  it('scores mean transfer_level on a 0–100 scale once enough data exists', () => {
    const r = transferAbility(Array.from({ length: 5 }, () => withTransfer(3)))!; // 3/3 → 100
    expect(r.n).toBe(5);
    expect(r.score).toBeCloseTo(100);
  });

  it('ignores events with no transfer_level', () => {
    const events = [...Array.from({ length: 5 }, () => withTransfer(3)), makeEvent({ difficulty: 2 })];
    expect(transferAbility(events)!.n).toBe(5);
  });

  it('trend is later-half minus earlier-half (improving → positive)', () => {
    const events = [
      withTransfer(0, '2026-08-01T00:00:00.000Z'),
      withTransfer(0, '2026-08-02T00:00:00.000Z'),
      withTransfer(3, '2026-08-03T00:00:00.000Z'),
      withTransfer(3, '2026-08-04T00:00:00.000Z'),
      withTransfer(3, '2026-08-05T00:00:00.000Z'),
      withTransfer(3, '2026-08-06T00:00:00.000Z'),
    ];
    expect(transferAbility(events)!.trend!).toBeGreaterThan(0);
  });
});
