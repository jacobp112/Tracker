import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/hooks/useStore';
import { STORE_KEY } from '@/core/storage';
import { emptyStore, findTopic, type Course, type Store, type Topic } from '@/domain/types';

/**
 * V3 — every commit path (form as well as paste) must clear schema + integrity
 * validation before it touches the store. The form path previously called
 * `commitValue` with an unvalidated payload, so a malformed exam could poison
 * strength (earned/possible = Infinity) or dangle a reference.
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

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY, JSON.stringify(seeded()));
});
afterEach(() => localStorage.clear());

describe('V3 — form commits are validated at the pipeline boundary', () => {
  it('rejects an exam with points_possible: 0 and leaves strength finite', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.store.courses).toHaveLength(1));

    let err: string | null = null;
    act(() => {
      err = result.current.commitValue('exam', {
        schema_version: '2.0.0', exam_id: 'exam_zero1', title: 'Bad', date: '2026-08-10T00:00:00Z',
        linked_topic_ids: ['topic_x'], score: 8, max_score: 10,
        breakdown: [{ topic_id: 'topic_x', points_earned: 8, points_possible: 0 }],
      });
    });

    expect(err).not.toBeNull();
    expect(result.current.store.exams).toHaveLength(0);
    const topic = findTopic(result.current.store, 'topic_x')!;
    expect(Number.isFinite(topic.strength)).toBe(true);
    expect(topic.strength).toBe(1);
    // and nothing corrupt was persisted
    const persisted = JSON.parse(localStorage.getItem(STORE_KEY)!) as Store;
    expect(persisted.exams).toHaveLength(0);
  });

  it('rejects an exam referencing a non-existent topic with an integrity message', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.store.courses).toHaveLength(1));

    let err: string | null = null;
    act(() => {
      err = result.current.commitValue('exam', {
        schema_version: '2.0.0', exam_id: 'exam_ghost', title: 'Bad', date: '2026-08-10T00:00:00Z',
        linked_topic_ids: ['topic_ghost'], score: 8, max_score: 10,
      });
    });

    expect(err).toMatch(/doesn't exist/);
    expect(result.current.store.exams).toHaveLength(0);
  });

  it('still commits a valid exam through the same path', async () => {
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.store.courses).toHaveLength(1));

    let err: string | null = null;
    act(() => {
      err = result.current.commitValue('exam', {
        schema_version: '2.0.0', exam_id: 'exam_good1', title: 'Good', date: '2026-08-10T00:00:00Z',
        linked_topic_ids: ['topic_x'], score: 8, max_score: 10,
        breakdown: [{ topic_id: 'topic_x', points_earned: 8, points_possible: 10 }],
      });
    });

    expect(err).toBeNull();
    expect(result.current.store.exams).toHaveLength(1);
  });
});
