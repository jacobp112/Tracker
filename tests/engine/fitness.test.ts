import { describe, expect, it } from 'vitest';
import { epley1Rm, formatPace, kgToLb, liftSeries, runSeries } from '@/engine/fitness';
import { emptyStore, type LiftingSession, type RunningActivity, type Store } from '@/domain/types';

function run(date: string, distanceKm: number, seconds: number, type: RunningActivity['type']): RunningActivity {
  return {
    schema_version: '2.0.0',
    activity_id: `activity_${date}`,
    date,
    distance_km: distanceKm,
    duration_seconds: seconds,
    pace_sec_per_km: seconds / distanceKm,
    type,
  };
}

function lift(date: string, exercise: string, sets: Array<[number, number]>): LiftingSession {
  return {
    schema_version: '2.0.0',
    session_id: `session_${date}`,
    date,
    exercises: [
      {
        exercise_name: exercise,
        sets: sets.map(([reps, weight], i) => ({ set_number: i + 1, reps, weight_kg: weight })),
      },
    ],
  };
}

function store(over: Partial<Store>): Store {
  return { ...emptyStore(), ...over };
}

describe('E6-S1 — running trends', () => {
  it('orders runs oldest→newest', () => {
    const s = store({ runs: [run('2026-07-10', 5, 1500, 'easy'), run('2026-07-01', 5, 1600, 'easy')] });
    expect(runSeries(s).map((p) => p.date)).toEqual(['2026-07-01', '2026-07-10']);
  });

  it('filters by run type (pace means different things per type, Doc 1 §5.1)', () => {
    const s = store({
      runs: [run('2026-07-01', 5, 1500, 'tempo'), run('2026-07-02', 10, 3600, 'long')],
    });
    expect(runSeries(s, 'tempo')).toHaveLength(1);
    expect(runSeries(s, 'tempo')[0]!.type).toBe('tempo');
  });

  it('formats pace as mm:ss', () => {
    expect(formatPace(300)).toBe('5:00');
    expect(formatPace(298)).toBe('4:58');
    expect(formatPace(365)).toBe('6:05');
  });
});

describe('E6-S2 — lifting progression', () => {
  it('estimates 1RM with Epley (per-set, not a flat total — Doc 1 §5.2)', () => {
    // 100kg × 5 reps → 100 × (1 + 5/30) = 116.67
    expect(epley1Rm(100, 5)).toBeCloseTo(116.67, 2);
    // A single heavy single is its own 1RM.
    expect(epley1Rm(120, 1)).toBeCloseTo(124, 2);
  });

  it('plots the top set and est-1RM per session, not a total', () => {
    const s = store({
      lifts: [
        lift('2026-07-01', 'Back Squat', [[5, 80], [5, 85], [5, 85]]),
        lift('2026-07-08', 'Back Squat', [[5, 82.5], [5, 87.5]]),
      ],
    });
    const series = liftSeries(s, 'Back Squat');
    expect(series).toHaveLength(2);
    expect(series[0]!.topSetKg).toBe(85);
    // est-1RM comes from the best set, not the last: 85×(1+5/30)=99.17
    expect(series[0]!.est1RmKg).toBeCloseTo(99.2, 1);
    expect(series[1]!.topSetKg).toBe(87.5);
  });

  it('groups fuzzily by name (case/whitespace), Doc 1 §5.2', () => {
    const s = store({
      lifts: [lift('2026-07-01', 'Back Squat', [[5, 80]]), lift('2026-07-08', ' back squat ', [[5, 85]])],
    });
    expect(liftSeries(s, 'Back Squat')).toHaveLength(2);
  });

  it('converts kg→lb for display but the input stays kg', () => {
    expect(kgToLb(100)).toBeCloseTo(220.46, 1);
  });
});
