import { describe, expect, it } from 'vitest';
import type { Topic } from '@/domain/types';

function baseTopic(): Topic {
  return {
    topic_id: 'topic_a',
    title: 'A',
    status: 'not_started',
    conf: 1,
    strength: 0,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: null,
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
  };
}

describe('Topic.prerequisites', () => {
  it('accepts an optional list of upstream topic_ids', () => {
    const topic: Topic = { ...baseTopic(), prerequisites: ['topic_b', 'topic_c'] };
    expect(topic.prerequisites).toEqual(['topic_b', 'topic_c']);
  });

  it('is optional — a topic without prerequisites is valid (backward compatible)', () => {
    const topic = baseTopic();
    expect(topic.prerequisites).toBeUndefined();
  });
});
