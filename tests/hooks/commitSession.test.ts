import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/hooks/useStore';
import { STORE_KEY } from '@/core/storage';
import { emptyStore, type Course, type Store, type Topic } from '@/domain/types';

/**
 * C1/I2 — the app, not the pasted JSON, is the timekeeper. `commitSession`
 * must map `meta.measured_minutes` into the stored SessionRecord and must
 * never read `value.duration_minutes` (the AI-supplied field), which the
 * start-session briefing tells the AI to set to a meaningless 0.
 */

function seeded(): Store {
  const topic: Topic = {
    topic_id: 'topic_x', title: 'Elasticity', status: 'practising', conf: 4, strength: 1, k_factor: 8, cards: 0,
    last_reviewed: '2026-08-01T00:00:00Z', mastered_at: null, drift_history: [], review_history: [], error_log: [],
  };
  const course: Course = {
    schema_version: '2.0.0', course_id: 'course_x', title: 'Micro', created_at: '2026-07-01T00:00:00Z',
    source: 'ai_generated', sections: [{ section_id: 'sec_x', title: 'Elasticity', order: 0, topics: [topic] }],
  };
  return { ...emptyStore(), courses: [course] };
}

function sessionValue(duration_minutes: number, session_id: string) {
  return {
    schema_version: '2.0.0',
    session_id,
    course_id: 'course_x',
    date: '2026-08-07T18:00:00Z',
    duration_minutes,
    topics_covered: [{ topic_id: 'topic_x', confidence_reported: 4 }],
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY, JSON.stringify(seeded()));
});
afterEach(() => localStorage.clear());

describe('commitSession — the app is the timekeeper', () => {
  it('stores meta.measured_minutes, never the pasted duration_minutes decoy', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.store.courses).toHaveLength(1));

    let err: string | null = null;
    act(() => {
      err = result.current.commitSession(sessionValue(999, 'session_decoy001'), {
        topic_id: 'topic_x',
        created_at: '2026-08-07T17:30:00Z',
        intent: 'adaptive',
        scope: 'topic',
        timer_mode: 'count_up',
        measured_minutes: 42,
      });
    });

    expect(err).toBeNull();
    expect(result.current.store.sessions).toHaveLength(1);
    expect(result.current.store.sessions[0]!.duration_minutes).toBe(42);
    expect(result.current.store.sessions[0]!.duration_minutes).not.toBe(999);
  });

  it('commits a pasted session whose duration_minutes is 0 (C1 end-to-end)', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.store.courses).toHaveLength(1));

    let err: string | null = null;
    act(() => {
      err = result.current.commitSession(sessionValue(0, 'session_zero0001'), {
        topic_id: 'topic_x',
        created_at: '2026-08-07T17:30:00Z',
        intent: 'adaptive',
        scope: 'topic',
        timer_mode: 'count_up',
        measured_minutes: 15,
      });
    });

    expect(err).toBeNull();
    expect(result.current.store.sessions).toHaveLength(1);
    expect(result.current.store.sessions[0]!.duration_minutes).toBe(15);
  });
});
