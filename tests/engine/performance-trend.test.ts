import { describe, expect, it } from 'vitest';
import { windowEvents, metricTrend } from '@/engine/performance-view';
import { makeEvent } from './assessment-fixtures';

const NOW = new Date('2026-08-30T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('windowEvents', () => {
  it('keeps only events within the last N days', () => {
    const events = [
      makeEvent({ difficulty: 1 }, { date: daysAgo(2) }),   // in 7 and 30
      makeEvent({ difficulty: 1 }, { date: daysAgo(20) }),  // in 30 only
      makeEvent({ difficulty: 1 }, { date: daysAgo(90) }),  // in neither
    ];
    expect(windowEvents(events, NOW, 7)).toHaveLength(1);
    expect(windowEvents(events, NOW, 30)).toHaveLength(2);
  });
});

describe('metricTrend', () => {
  it('applies the metric across 7d / 30d / lifetime windows', () => {
    const events = [
      makeEvent({ difficulty: 1 }, { date: daysAgo(2) }),
      makeEvent({ difficulty: 1 }, { date: daysAgo(20) }),
      makeEvent({ difficulty: 1 }, { date: daysAgo(90) }),
    ];
    const trend = metricTrend(events, NOW, (evs) => evs.length);
    expect(trend).toEqual({ d7: 1, d30: 2, lifetime: 3 });
  });
});
