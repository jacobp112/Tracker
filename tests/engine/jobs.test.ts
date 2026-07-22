import { describe, expect, it } from 'vitest';
import {
  boardColumns,
  closedApplications,
  daysInStage,
  funnelStats,
  furthestStage,
  nextStages,
  upcomingActions,
} from '@/engine/jobs';
import { currentStage, emptyStore, type JobApplication, type JobStage, type Store } from '@/domain/types';

let n = 0;

function app(stages: Array<[JobStage, string]>, overrides: Partial<JobApplication> = {}): JobApplication {
  n += 1;
  return {
    schema_version: '2.0.0',
    application_id: `application_${String(n).padStart(10, '0')}`,
    company: `Company ${n}`,
    role: 'Engineer',
    stage_history: stages.map(([stage, date], i) => ({
      event_id: `event_${n}x${i}`,
      date,
      stage,
    })),
    created_at: stages[0]?.[1] ?? '2026-07-01T09:00:00Z',
    archived: false,
    ...overrides,
  };
}

function storeWith(...apps: JobApplication[]): Store {
  return { ...emptyStore(), applications: apps };
}

const NOW = new Date('2026-07-22T12:00:00Z');

describe('currentStage / daysInStage', () => {
  it('reads the last stage event', () => {
    const a = app([
      ['saved', '2026-07-01T09:00:00Z'],
      ['applied', '2026-07-10T09:00:00Z'],
    ]);
    expect(currentStage(a)).toBe('applied');
  });

  it('counts whole days since the last stage move', () => {
    const a = app([['applied', '2026-07-19T09:00:00Z']]);
    expect(daysInStage(a, NOW)).toBe(3);
  });

  it('never goes negative on a future-dated event', () => {
    const a = app([['applied', '2026-08-01T09:00:00Z']]);
    expect(daysInStage(a, NOW)).toBe(0);
  });
});

describe('boardColumns', () => {
  it('groups active applications by current stage, excluding terminal and archived', () => {
    const saved = app([['saved', '2026-07-01T09:00:00Z']]);
    const applied = app([['applied', '2026-07-02T09:00:00Z']]);
    const rejected = app([
      ['applied', '2026-07-01T09:00:00Z'],
      ['rejected', '2026-07-05T09:00:00Z'],
    ]);
    const archived = app([['saved', '2026-07-03T09:00:00Z']], { archived: true });

    const cols = boardColumns(storeWith(saved, applied, rejected, archived));
    const byStage = Object.fromEntries(cols.map((c) => [c.stage, c.applications]));

    expect(byStage.saved).toHaveLength(1); // archived one excluded
    expect(byStage.applied).toHaveLength(1);
    expect(cols.flatMap((c) => c.applications)).not.toContain(rejected);
  });

  it('orders a column newest stage-move first', () => {
    const older = app([['saved', '2026-07-01T09:00:00Z']]);
    const newer = app([['saved', '2026-07-10T09:00:00Z']]);
    const cols = boardColumns(storeWith(older, newer));
    const savedCol = cols.find((c) => c.stage === 'saved')!;
    expect(savedCol.applications[0]).toBe(newer);
  });
});

describe('closedApplications', () => {
  it('lists terminal-stage applications, most recent first', () => {
    const rejected = app([
      ['applied', '2026-07-01T09:00:00Z'],
      ['rejected', '2026-07-03T09:00:00Z'],
    ]);
    const accepted = app([
      ['offer', '2026-07-01T09:00:00Z'],
      ['accepted', '2026-07-10T09:00:00Z'],
    ]);
    const active = app([['applied', '2026-07-05T09:00:00Z']]);

    const closed = closedApplications(storeWith(rejected, accepted, active));
    expect(closed).toEqual([accepted, rejected]);
  });
});

describe('furthestStage / funnelStats', () => {
  it('uses history, not current stage — a rejection after interview still counts the interview', () => {
    const a = app([
      ['applied', '2026-07-01T09:00:00Z'],
      ['interview', '2026-07-05T09:00:00Z'],
      ['rejected', '2026-07-10T09:00:00Z'],
    ]);
    expect(furthestStage(a)).toBe('interview');
  });

  it('computes rates as a share of applications that applied', () => {
    const savedOnly = app([['saved', '2026-07-01T09:00:00Z']]);
    const appliedOnly = app([['applied', '2026-07-01T09:00:00Z']]);
    const screened = app([
      ['applied', '2026-07-01T09:00:00Z'],
      ['screen', '2026-07-05T09:00:00Z'],
    ]);
    const interviewedThenRejected = app([
      ['applied', '2026-07-01T09:00:00Z'],
      ['interview', '2026-07-06T09:00:00Z'],
      ['rejected', '2026-07-09T09:00:00Z'],
    ]);
    const offered = app([
      ['applied', '2026-07-01T09:00:00Z'],
      ['offer', '2026-07-15T09:00:00Z'],
    ]);

    const stats = funnelStats(
      storeWith(savedOnly, appliedOnly, screened, interviewedThenRejected, offered),
    );

    expect(stats.applied).toBe(4);
    // screen or beyond: screened, interviewedThenRejected, offered → 3/4
    expect(stats.responseRate).toBe(75);
    // interview or beyond: interviewedThenRejected, offered → 2/4
    expect(stats.interviewRate).toBe(50);
    expect(stats.offers).toBe(1);
    // active excludes the rejected one
    expect(stats.active).toBe(4);
  });

  it('returns null rates before anything has been applied to', () => {
    const stats = funnelStats(storeWith(app([['saved', '2026-07-01T09:00:00Z']])));
    expect(stats.responseRate).toBeNull();
    expect(stats.interviewRate).toBeNull();
  });
});

describe('nextStages', () => {
  it('offers every stage except the current one', () => {
    const options = nextStages('applied');
    expect(options).not.toContain('applied');
    expect(options).toContain('screen');
    expect(options).toContain('rejected');
    // terminal stages can reopen back into the pipeline
    expect(nextStages('rejected')).toContain('applied');
  });
});

describe('upcomingActions', () => {
  it('orders by next_action_date and skips closed or archived applications', () => {
    const later = app([['applied', '2026-07-01T09:00:00Z']], { next_action_date: '2026-08-10' });
    const sooner = app([['screen', '2026-07-01T09:00:00Z']], { next_action_date: '2026-07-25' });
    const closed = app(
      [
        ['applied', '2026-07-01T09:00:00Z'],
        ['rejected', '2026-07-05T09:00:00Z'],
      ],
      { next_action_date: '2026-07-23' },
    );
    const noDate = app([['applied', '2026-07-01T09:00:00Z']]);

    expect(upcomingActions(storeWith(later, sooner, closed, noDate))).toEqual([sooner, later]);
  });
});
