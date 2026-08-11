import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CourseDashboard } from '@/routes/CourseDashboard';
import type { Course, Topic } from '@/domain/types';

/**
 * E4-S1…S4 — the dashboard renders live engine values in the approved mockup's
 * layout: rotated health-badge header, five-stat grid, activity heatmap, and
 * the topic matrix. Honesty rules (Doc 3 §6) are preserved: undefined values
 * read "—", never a fabricated 0.
 */

function topic(over: Partial<Topic> = {}): Topic {
  return {
    topic_id: 'topic_a',
    title: 'Chain rule',
    status: 'practising',
    conf: 4,
    strength: 1.3,
    k_factor: 7.0,
    cards: 1,
    last_reviewed: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    mastered_at: null,
    drift_history: [],
    review_history: [],
    error_log: [],
    ...over,
  };
}

function course(topics: Topic[]): Course {
  return {
    schema_version: '2.0.0',
    course_id: 'course_1',
    title: 'Advanced Theory',
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [{ section_id: 'section_1', title: 'Fundamentals', order: 0, topics }],
  };
}

function renderDash(c: Course) {
  return render(<CourseDashboard course={c} onLogSession={vi.fn()} onSelectTopic={vi.fn()} />);
}

describe('E4-S1 — dashboard shell', () => {
  it('shows the course name as the header', () => {
    renderDash(course([topic()]));
    expect(screen.getByRole('heading', { name: 'Advanced Theory' })).toBeInTheDocument();
  });
});

describe('E4-S2 — topic matrix', () => {
  it('groups topics under their section label', () => {
    renderDash(course([topic()]));
    expect(screen.getByText('Fundamentals')).toBeInTheDocument();
  });

  it('exposes live retention in the row, not just colour (Doc 3 §6)', () => {
    // strength 1.3, k 7.0, 9 days → e^(-9/9.1) ≈ 37%.
    renderDash(course([topic()]));
    expect(screen.getByRole('button', { name: /chain rule.*37% retention/i })).toBeInTheDocument();
  });

  it('reads a never-reviewed topic as "—", never 0%', () => {
    renderDash(course([topic({ status: 'not_started', last_reviewed: null, strength: 0, review_history: [] })]));
    const row = screen.getByRole('button', { name: /chain rule/i });
    // No fabricated retention in the accessible label…
    expect(row.getAttribute('aria-label')).not.toMatch(/% retention/i);
    // …and a dash in the retention/due cells rather than 0%.
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('E4-S3 — stats & activity', () => {
  it('renders the stat grid and the activity heatmap', () => {
    renderDash(course([topic()]));
    expect(screen.getByRole('group', { name: 'Avg retention' })).toBeInTheDocument();
    expect(screen.getByText('Study activity')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('renders the five stat cards', () => {
    renderDash(course([topic()]));
    for (const label of ['Avg retention', 'Health', 'Calibration', 'Due review', 'Projected finish']) {
      expect(screen.getByRole('group', { name: label })).toBeInTheDocument();
    }
  });

  it('surfaces course health for practising topics', () => {
    // 0.30·37.19 + 0.25·100 + 0.20·100 + 0.15·80 + 0.10·20 ≈ 70.
    renderDash(course([topic()]));
    expect(within(screen.getByRole('group', { name: 'Health' })).getByText('70')).toBeInTheDocument();
  });
});

/*
 * Empty states must never read as a failed load or a fabricated zero — the
 * distinction the review called out. A brand-new course exercises all of them.
 */
describe('empty states are honest, not broken-looking', () => {
  const fresh = () =>
    course([topic({ status: 'not_started', last_reviewed: null, strength: 0, review_history: [] })]);

  it('shows Avg retention as "—" with guiding copy, not a fabricated zero', () => {
    renderDash(fresh());
    const card = screen.getByRole('group', { name: 'Avg retention' });
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).getByText(/start a topic to begin tracking/i)).toBeInTheDocument();
  });

  it('shows Calibration as "—" with no exam basis, never "+0.00"', () => {
    renderDash(fresh());
    const card = screen.getByRole('group', { name: 'Calibration' });
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).queryByText(/\+0\.00/)).not.toBeInTheDocument();
    expect(within(card).getByText(/log an exam to calibrate/i)).toBeInTheDocument();
  });

  it('still shows a genuine zero — Due review is 0, not dashed out', () => {
    renderDash(fresh());
    const card = screen.getByRole('group', { name: 'Due review' });
    expect(within(card).getByText('0')).toBeInTheDocument();
  });

  it('explains jargon labels with a "?" help', () => {
    renderDash(fresh());
    const card = screen.getByRole('group', { name: 'Calibration' });
    expect(within(card).getByTitle(/confidence/i)).toBeInTheDocument();
  });
});

describe('E4-S4 — projection', () => {
  it('says "Not enough data yet" rather than fabricating a finish date', () => {
    renderDash(course([topic()]));
    expect(
      within(screen.getByRole('group', { name: 'Projected finish' })).getByText(/not enough data yet/i),
    ).toBeInTheDocument();
  });

  it('says "Course complete" when every topic is mastered', () => {
    renderDash(
      course([
        topic({ topic_id: 'topic_1', status: 'mastered', mastered_at: '2026-07-01T00:00:00Z' }),
        topic({ topic_id: 'topic_2', status: 'mastered', mastered_at: '2026-07-02T00:00:00Z' }),
      ]),
    );
    expect(screen.getByText(/course complete/i)).toBeInTheDocument();
  });
});
