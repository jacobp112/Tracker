import { describe, expect, it } from 'vitest';
import { emptyStore, type Store } from '@/domain/types';
import { weeklyVolume } from '@/engine/overview';
import { workLogged } from '@/engine/progress';

function storeWithSession(minutes: number): Store {
  const now = new Date();
  return {
    ...emptyStore(),
    // one committed session, recorded via a SessionRecord with real minutes
    sessions: [{ session_id: 'session_1', topic_id: 't', course_id: 'c', created_at: now.toISOString(), completed_at: now.toISOString(), duration_minutes: minutes, intent: 'retention', scope: 'topic', timer_mode: 'count_up' }],
  };
}

describe('real study durations', () => {
  it('workLogged sums real minutes from sessions when present', () => {
    const wl = workLogged(storeWithSession(90));
    expect(wl.hours).toBeCloseTo(1.5, 1);
  });
  it('weeklyVolume counts a recent recorded session and its real hours', () => {
    const wv = weeklyVolume(storeWithSession(45));
    expect(wv.sessions).toBeGreaterThanOrEqual(1);
    expect(wv.hours).toBeCloseTo(0.75, 1);
  });
});
