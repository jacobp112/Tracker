import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Performance } from '@/routes/Performance';
import { emptyStore, type ReviewEvent, type Store, type Topic } from '@/domain/types';
import { makeEvent } from '../engine/assessment-fixtures';

function topicWith(id: string, events: ReviewEvent[], over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: events, error_log: [], ...over,
  };
}
function storeOf(...topics: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }] });
  return s;
}

describe('Performance page', () => {
  it('shows an empty state when there is no assessment data', () => {
    render(<Performance store={storeOf(topicWith('topic_a', [makeEvent(undefined)]))} />);
    expect(screen.getByText(/no performance data yet/i)).toBeInTheDocument();
  });

  it('renders the headline card labels and a computed value when data exists', () => {
    // 5 transfer observations → Transfer Ability = 100.
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);
    expect(screen.getByText('Transfer Ability')).toBeInTheDocument();
    expect(screen.getByText('Performance Health')).toBeInTheDocument();
    // Transfer card shows 100; a metric with no data shows an em dash.
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // e.g. Cold has no cold attempts
  });

  it('renders a performance-by-difficulty bar for independent attempts', () => {
    const events = Array.from({ length: 3 }, () =>
      makeEvent({ independence: 3, difficulty: 4 }, { test: { score: 9, out_of: 10 } }),
    );
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);
    expect(screen.getByText(/performance by difficulty/i)).toBeInTheDocument();
    expect(screen.getByText(/difficulty 4/i)).toBeInTheDocument();
  });
});
