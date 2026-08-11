import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicDetail } from '@/routes/TopicDetail';
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';
import { makeEvent } from '../engine/assessment-fixtures';
import type { ReviewEvent } from '@/domain/types';

const NOW = new Date('2026-07-20T12:00:00Z');

function masteredTopic(): Topic {
  return {
    topic_id: 't', title: 'Big-O', status: 'mastered',
    conf: 5, strength: 5, k_factor: CONFIG.DECAY_K, cards: 5,
    last_reviewed: NOW.toISOString(), mastered_at: '2026-07-01T00:00:00Z',
    drift_history: [],
    review_history: [{
      event_id: 'p', date: NOW.toISOString(), kind: 'test_pass',
      source: 'exam', source_id: 'x', confidence_reported: 5,
      test: { score: 10, out_of: 10, actual_retention: 1 },
    }],
    error_log: [],
  };
}

describe('TopicDetail — drawer', () => {
  it('opens as a labelled drawer showing the high-water level', () => {
    render(
      <TopicDetail
        topic={masteredTopic()} sectionTitle="Complexity"
        onClose={() => {}} onResolveError={() => {}}
        onPromote={() => {}} onQuickReview={() => {}} now={NOW}
      />,
    );
    expect(screen.getByRole('dialog', { name: /big-o/i })).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Level ${CONFIG.LEVEL.HEALTH_BANDS.length}`)),
    ).toBeInTheDocument();
  });
});

function assessedTopic(events: ReviewEvent[]): Topic {
  return { ...masteredTopic(), topic_id: 't2', title: 'Recursion', review_history: events };
}

describe('TopicDetail — assessment diagnostics', () => {
  it('shows the diagnostics card with raw values for an assessed topic', () => {
    const events = [
      makeEvent({ independence: 3, difficulty: 4, novelty: 3, transfer_level: 3, performance_quality: 4 }, { test: { score: 10, out_of: 10 } }),
      makeEvent({ independence: 3, difficulty: 5, novelty: 4, transfer_level: 3, performance_quality: 4 }, { test: { score: 8, out_of: 10 } }),
    ];
    render(
      <TopicDetail topic={assessedTopic(events)} sectionTitle="Core"
        onClose={() => {}} onResolveError={() => {}} onPromote={() => {}} onQuickReview={() => {}} now={NOW} />,
    );
    expect(screen.getByText(/assessment diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/n=2/i)).toBeInTheDocument();          // independent accuracy row
    expect(screen.getByText(/transfer/i)).toBeInTheDocument();     // transfer/quality row
  });

  it('omits the diagnostics card for a topic with no assessment data', () => {
    // masteredTopic()'s single event has a `test` block but no `assessment`.
    render(
      <TopicDetail topic={masteredTopic()} sectionTitle="Core"
        onClose={() => {}} onResolveError={() => {}} onPromote={() => {}} onQuickReview={() => {}} now={NOW} />,
    );
    expect(screen.queryByText(/assessment diagnostics/i)).not.toBeInTheDocument();
  });
});
