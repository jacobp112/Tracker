import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
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
function storeOfCourses(courses: Array<{ id: string; title: string; topics: Topic[] }>): Store {
  const s = emptyStore();
  courses.forEach((c, i) => {
    s.courses.push({ schema_version: '3.2.0', course_id: c.id, title: c.title,
      created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
      sections: [{ section_id: `section_${i}`, title: 'S', order: 0, topics: c.topics }] });
  });
  return s;
}
function storeOfSections(sections: Array<{ id: string; title: string; topics: Topic[] }>): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: sections.map((sec, i) => ({ section_id: sec.id, title: sec.title, order: i, topics: sec.topics })) });
  return s;
}
function storeOfCoursesWithSections(
  courses: Array<{ id: string; title: string; sections: Array<{ id: string; title: string; topics: Topic[] }> }>
): Store {
  const s = emptyStore();
  courses.forEach((c) => {
    s.courses.push({ schema_version: '3.2.0', course_id: c.id, title: c.title,
      created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
      sections: c.sections.map((sec, secIdx) => ({ section_id: sec.id, title: sec.title, order: secIdx, topics: sec.topics })) });
  });
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
    // The Trends panel row duplicates each headline label, so assert presence via getAllByText.
    expect(screen.getAllByText('Transfer Ability').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Performance Health').length).toBeGreaterThanOrEqual(1);
    // Transfer card shows 100; a metric with no data shows an em dash.
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
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

  it('scopes the metrics to the selected course', async () => {
    const user = userEvent.setup();
    const alpha = topicWith('topic_a', Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 })));
    const beta = topicWith('topic_b', [makeEvent(undefined)]); // no assessment
    render(<Performance store={storeOfCourses([
      { id: 'course_a', title: 'Alpha', topics: [alpha] },
      { id: 'course_b', title: 'Beta', topics: [beta] },
    ])} />);

    // Default "All courses": Alpha's five transfer observations aggregate to 100.
    // Both the headline card and the Trends panel row show it, so assert via getAllByText.
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);

    // Scope to Beta (no assessment data) → the 100 is gone and a scoped empty message shows.
    await user.click(screen.getByRole('radio', { name: 'Beta' }));
    expect(screen.queryByText('100')).not.toBeInTheDocument();
    expect(screen.getByText(/no performance data for this selection yet/i)).toBeInTheDocument();
    // The scoped no-data branch must not render the Trends panel either.
    expect(screen.queryByRole('heading', { name: /^trends$/i })).not.toBeInTheDocument();
  });

  it('shows no scope selector when there is only one course', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('moves focus and selection with arrow keys', async () => {
    const user = userEvent.setup();
    const alpha = topicWith('topic_a', Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 })));
    const beta = topicWith('topic_b', [makeEvent(undefined)]);
    render(<Performance store={storeOfCourses([
      { id: 'course_a', title: 'Alpha', topics: [alpha] },
      { id: 'course_b', title: 'Beta', topics: [beta] },
    ])} />);
    const allTab = screen.getByRole('radio', { name: 'All courses' });
    allTab.focus();
    await user.keyboard('{ArrowRight}');
    const alphaTab = screen.getByRole('radio', { name: 'Alpha' });
    expect(alphaTab).toHaveFocus();
    expect(alphaTab).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Performance trends panel', () => {
  it('renders a Trends panel with the three window headers and a metric row', () => {
    // 5 transfer observations → Transfer Ability = 100 in every window that contains them.
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);

    expect(screen.getByRole('heading', { name: /^trends$/i })).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText(/lifetime/i)).toBeInTheDocument();
    // A Trends row label for Transfer Ability exists (the header card also shows this label,
    // so assert there are at least two occurrences: card + trends row).
    expect(screen.getAllByText('Transfer Ability').length).toBeGreaterThanOrEqual(2);
  });

  it('shows lifetime values but em dashes for windows with too few recent attempts', () => {
    // Freeze "now" far after the events so the 7d and 30d windows are empty but lifetime is not.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T00:00:00.000Z'));
    try {
      // Events dated 2026-08-10 (fixture default) are >30 days before frozen now.
      const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
      render(<Performance store={storeOf(topicWith('topic_a', events))} />);

      // '100' should appear exactly twice: the headline Transfer Ability card (unwindowed,
      // reflects all scoped events) and the Trends row's lifetime cell. If windowing were
      // broken and the lifetime value leaked into the d7/d30 cells too, this would be 4.
      expect(screen.getAllByText('100')).toHaveLength(2);
      // With empty 7d/30d windows, multiple trend cells read as an em dash.
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('excludes a 15-day-old attempt from the 7d window but includes it in the 30d window', () => {
    // Events dated 2026-08-10, "now" frozen at 2026-08-25 → a 15-day gap: outside the 7d
    // window (7 < 15), inside the 30d window (15 < 30). This pins the 7d/30d boundary
    // itself, distinguishing it from an implementation that swapped or conflated the cutoffs.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T00:00:00.000Z'));
    try {
      const events = Array.from({ length: 5 }, () =>
        makeEvent({ transfer_level: 3 }, { date: '2026-08-10T00:00:00.000Z' }),
      );
      render(<Performance store={storeOf(topicWith('topic_a', events))} />);

      // '100' should appear exactly three times: the headline card (unwindowed), the Trends
      // row's d30 cell, and its lifetime cell. If the 7d cutoff were wrong (e.g. used 30
      // days), the d7 cell would also read 100 → 4, failing this assertion.
      expect(screen.getAllByText('100')).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not render the Trends panel when there is no assessment data', () => {
    render(<Performance store={storeOf(topicWith('topic_a', [makeEvent(undefined)]))} />);
    expect(screen.queryByRole('heading', { name: /^trends$/i })).not.toBeInTheDocument();
  });
});

describe('Performance section scope', () => {
  it('shows a section selector for a multi-section course and scopes to the chosen section', async () => {
    const user = userEvent.setup();
    // Intro section has 5 transfer obs (→ Transfer Ability 100); Advanced has none.
    const intro = topicWith('topic_a', Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 })));
    const advanced = topicWith('topic_b', [makeEvent(undefined)]);
    render(<Performance store={storeOfSections([
      { id: 'section_1', title: 'Intro', topics: [intro] },
      { id: 'section_2', title: 'Advanced', topics: [advanced] },
    ])} />);

    // Sole course → section selector is visible immediately (Whole course + both sections).
    expect(screen.getByRole('radio', { name: 'Whole course' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Intro' })).toBeInTheDocument();
    // Whole course aggregates Intro's five transfer obs → 100 present.
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);

    // Scope to Advanced (no data) → 100 gone, scoped-empty message shows.
    await user.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(screen.queryAllByText('100')).toHaveLength(0);
    expect(screen.getByText(/no performance data for this selection yet/i)).toBeInTheDocument();

    // Scope to Intro → 100 returns.
    await user.click(screen.getByRole('radio', { name: 'Intro' }));
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
  });

  it('shows no section selector for a single-section course', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOfSections([{ id: 'section_1', title: 'Only', topics: [topicWith('topic_a', events)] }])} />);
    expect(screen.queryByRole('radio', { name: 'Whole course' })).not.toBeInTheDocument();
  });

  it('resets section scope to Whole course when the selected course changes', async () => {
    const user = userEvent.setup();
    // Two courses, each with two sections
    const introTopic = topicWith('topic_intro', Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 })));
    const advancedTopic = topicWith('topic_adv', [makeEvent(undefined)]);
    const basicsTopic = topicWith('topic_basics', [makeEvent(undefined)]);
    const deepTopic = topicWith('topic_deep', [makeEvent(undefined)]);

    const store = storeOfCoursesWithSections([
      {
        id: 'course_a',
        title: 'A',
        sections: [
          { id: 'section_a1', title: 'Intro', topics: [introTopic] },
          { id: 'section_a2', title: 'Advanced', topics: [advancedTopic] },
        ],
      },
      {
        id: 'course_b',
        title: 'B',
        sections: [
          { id: 'section_b1', title: 'Basics', topics: [basicsTopic] },
          { id: 'section_b2', title: 'Deep', topics: [deepTopic] },
        ],
      },
    ]);

    render(<Performance store={store} />);

    // Select course_a, then drill into its "Advanced" section.
    await user.click(screen.getByRole('radio', { name: 'A' }));
    await user.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(screen.getByRole('radio', { name: 'Advanced' })).toHaveAttribute('aria-checked', 'true');

    // Switch to course_b → section selector should revert to "Whole course" checked,
    // and course_a's "Advanced" section option should no longer be present.
    await user.click(screen.getByRole('radio', { name: 'B' }));
    expect(screen.getByRole('radio', { name: 'Whole course' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('radio', { name: 'Advanced' })).not.toBeInTheDocument();
  });
});
