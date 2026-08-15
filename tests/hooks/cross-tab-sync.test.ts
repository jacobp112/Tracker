import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/hooks/useStore';
import { STORE_KEY } from '@/core/storage';
import { emptyStore, findTopic, type Course, type Store, type Topic } from '@/domain/types';

/**
 * V1 — cross-tab / rapid-commit state desync.
 *
 * Every mutator must perform an atomic read-modify-write against the persisted
 * store (never a stale in-memory closure), and the hook must adopt another
 * tab's write via the `storage` event. These regression specs simulate two
 * detached store instances ("tabs") sharing one localStorage.
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

function sessionValue(session_id: string) {
  return {
    schema_version: '2.0.0',
    session_id,
    course_id: 'course_x',
    date: '2026-08-07T18:00:00Z',
    duration_minutes: 30,
    topics_covered: [{ topic_id: 'topic_x', confidence_reported: 4 }],
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY, JSON.stringify(seeded()));
});
afterEach(() => localStorage.clear());

describe('V1 — atomic read-modify-write across tabs', () => {
  it("a second tab's commit preserves the first tab's persisted review event", async () => {
    // Two independent hook instances, both loaded from the same localStorage.
    const tabA = renderHook(() => useStore());
    const tabB = renderHook(() => useStore());
    await waitFor(() => expect(tabA.result.current.store.courses).toHaveLength(1));
    await waitFor(() => expect(tabB.result.current.store.courses).toHaveLength(1));

    // Tab A logs a session. Tab B never re-mounts, so its in-memory store is now stale.
    act(() => {
      expect(tabA.result.current.commitValue('session', sessionValue('session_aaaaaaa1'))).toBeNull();
    });

    // Tab B logs a different session against its stale snapshot.
    act(() => {
      expect(tabB.result.current.commitValue('session', sessionValue('session_bbbbbbb2'))).toBeNull();
    });

    // The persisted store must carry BOTH review events — the second write may
    // not clobber the first.
    const persisted = JSON.parse(localStorage.getItem(STORE_KEY)!) as Store;
    const topic = findTopic(persisted, 'topic_x')!;
    expect(topic.review_history).toHaveLength(2);
  });

  it('adopts another tab\'s write via the storage event', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.store.courses).toHaveLength(1));

    // Simulate another tab writing a mutated store, then the browser firing the
    // cross-tab `storage` event.
    const mutated = seeded();
    const topic = findTopic(mutated, 'topic_x')!;
    topic.strength = 99;
    const newValue = JSON.stringify(mutated);

    act(() => {
      localStorage.setItem(STORE_KEY, newValue);
      window.dispatchEvent(new StorageEvent('storage', { key: STORE_KEY, newValue }));
    });

    await waitFor(() =>
      expect(findTopic(result.current.store, 'topic_x')!.strength).toBe(99),
    );
  });
});
