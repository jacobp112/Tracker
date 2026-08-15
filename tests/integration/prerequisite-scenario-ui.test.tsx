import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '@/App';
import { saveStore } from '@/core/storage';
import { emptyStore } from '@/domain/types';
import type { Course, Store, Topic } from '@/domain/types';

function createScenarioStore(): Store {
  const nowIso = new Date().toISOString();
  const sampleSpaces: Topic = {
    topic_id: 'topic_sample_spaces',
    title: 'Sample spaces and events',
    status: 'learning',
    conf: 4,
    strength: 1,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: nowIso,
    mastered_at: null,
    drift_history: [],
    review_history: [{
      event_id: 'ev_ret', date: nowIso, kind: 'test_pass', source: 'session', source_id: 's_1',
      confidence_reported: 4, test: { score: 97, out_of: 100, actual_retention: 0.97 },
    }],
    error_log: [],
  };

  const conditionalProb: Topic = {
    topic_id: 'topic_conditional',
    title: 'Conditional probability',
    status: 'learning',
    conf: 3,
    strength: 1,
    k_factor: 8.4,
    cards: 0,
    last_reviewed: '2026-08-11T12:00:00.000Z',
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [{
      error_id: 'err_1', date: nowIso, source: 'session', source_id: 's_prev',
      error_type: 'conceptual', description: 'Treated sample space as event outcomes', resolved: false, resolved_date: null,
    }],
    prerequisites: ['topic_sample_spaces'],
  };

  const course: Course = {
    schema_version: '3.3.0',
    course_id: 'course_prob',
    title: 'Probability Theory',
    created_at: '2026-08-01T00:00:00.000Z',
    source: 'manual',
    sections: [{
      section_id: 'sec_1',
      title: 'Foundations',
      order: 0,
      topics: [sampleSpaces, conditionalProb],
    }],
  };

  const store = emptyStore();
  store.courses.push(course);
  return store;
}

describe('Prerequisite Recommendation Scenario UI & Session Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    saveStore(createScenarioStore());
    window.location.hash = '#/';
  });

  it('surfaces the prerequisite intervention with its foundational reasoning and starts a session', async () => {
    render(<App />);

    // Post-§13, MAUT ranks by utility so the struggling dependent can lead; the
    // prerequisite intervention still SURFACES among the recommendations, carrying
    // its retention-contrast reasoning. (Evidence tags render on the primary card
    // only, so they are no longer asserted here.)
    expect(screen.getAllByText('Sample spaces and events').length).toBeGreaterThan(0);
    expect(screen.getByText(/Your overall retention is strong/i)).toBeInTheDocument();
    expect(screen.getByText(/fixing this foundational topic takes precedence/i)).toBeInTheDocument();

    // Start the prerequisite session from its recommendation card.
    const startBtn = screen.getByRole('button', { name: /Strengthen prerequisite/i });
    fireEvent.click(startBtn);

    // Verify session modal opens with briefing carrying retrieval-first protocol
    await waitFor(() => {
      expect(screen.getByText('Start session')).toBeInTheDocument();
      expect(screen.getByText('Briefing preview')).toBeInTheDocument();
    });

    const briefingText = screen.getByText(/Briefing preview/).parentElement?.textContent ?? '';
    expect(briefingText).toContain('Attempt retrieval/probe first before offering any explanation');
    expect(briefingText).toContain('Re-test with a new independent application problem');
    expect(briefingText).toContain('Do not declare mastery on a single superficial response');
  });
});
