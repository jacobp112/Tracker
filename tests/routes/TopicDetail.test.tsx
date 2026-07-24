import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicDetail } from '@/routes/TopicDetail';
import { CONFIG } from '@/config/constants';
import type { Topic } from '@/domain/types';

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

describe('TopicDetail — level stat', () => {
  it('shows the high-water level adjacent to retention', () => {
    render(
      <TopicDetail
        topic={masteredTopic()} sectionTitle="Complexity"
        onClose={() => {}} onResolveError={() => {}}
        onPromote={() => {}} onQuickReview={() => {}} now={NOW}
      />,
    );
    expect(screen.getByText(`Lv ${CONFIG.LEVEL.HEALTH_BANDS.length}`)).toBeInTheDocument();
    expect(screen.getByText('level')).toBeInTheDocument();
  });
});
