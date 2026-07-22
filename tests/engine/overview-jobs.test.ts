import { describe, expect, it } from 'vitest';
import { activityFeed } from '@/engine/overview';
import { emptyStore, type JobApplication, type Store } from '@/domain/types';

function appWith(stages: Array<[JobApplication['stage_history'][number]['stage'], string]>): JobApplication {
  return {
    schema_version: '2.0.0',
    application_id: 'application_feedtest1',
    company: 'Acme',
    role: 'Engineer',
    stage_history: stages.map(([stage, date], i) => ({ event_id: `event_f${i}`, date, stage })),
    created_at: stages[0]![1],
    archived: false,
  };
}

function storeWith(app: JobApplication): Store {
  return { ...emptyStore(), applications: [app] };
}

describe('activityFeed — job stage events', () => {
  it('emits one feed item per stage event, in the feed voice', () => {
    const store = storeWith(
      appWith([
        ['saved', '2026-07-01T09:00:00Z'],
        ['applied', '2026-07-03T09:00:00Z'],
        ['interview', '2026-07-10T09:00:00Z'],
      ]),
    );
    const items = activityFeed(store).filter((i) => i.kind === 'job');
    expect(items).toHaveLength(3);
    // Newest first across the whole feed.
    expect(items[0]!.title).toBe('Interview — Acme');
    expect(items[1]!.title).toBe('Applied to Acme');
    expect(items[2]!.title).toBe('Saved Acme');
    expect(items[0]!.detail).toBe('Engineer');
  });

  it('interleaves with other domains by date, newest first', () => {
    const store = storeWith(appWith([['applied', '2026-07-15T09:00:00Z']]));
    store.runs.push({
      schema_version: '2.0.0',
      activity_id: 'activity_feedr1',
      date: '2026-07-20',
      distance_km: 5,
      duration_seconds: 1800,
      pace_sec_per_km: 360,
      type: 'easy',
    });
    const items = activityFeed(store);
    expect(items[0]!.kind).toBe('run');
    expect(items[1]!.kind).toBe('job');
  });
});
