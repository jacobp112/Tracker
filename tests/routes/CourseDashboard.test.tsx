import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CourseDashboard } from '@/routes/CourseDashboard';
import type { Course, Topic } from '@/domain/types';

/**
 * E4-S1…S4 — the dashboard renders live engine values in the mockup's layout.
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
  return render(
    <CourseDashboard course={c} onLogSession={vi.fn()} onSelectTopic={vi.fn()} />,
  );
}

describe('E4-S1 — dashboard shell', () => {
  it('renders the breadcrumb and the course name as the headline', () => {
    renderDash(course([topic()]));
    // The course's own name is the page h1; the breadcrumb carries it too.
    expect(screen.getByRole('heading', { name: 'Advanced Theory' })).toBeInTheDocument();
    expect(screen.getAllByText('Advanced Theory').length).toBeGreaterThanOrEqual(1);
  });
});

describe('E4-S2 — retention matrix', () => {
  it('groups topics under their section label', () => {
    renderDash(course([topic()]));
    expect(screen.getByText('Fundamentals')).toBeInTheDocument();
  });

  it('renders live retention as text, not just colour (Doc 3 §6)', () => {
    // strength 1.3, k 7.0, 9 days → e^(-9/9.1) ≈ 37%.
    // The hero's avg lands on the same figure, so scope to the matrix row.
    renderDash(course([topic()]));
    const row = screen.getByRole('button', { name: 'Chain rule' }).closest('.row')!;
    expect(within(row as HTMLElement).getByText(/37%/)).toBeInTheDocument();
  });

  it('renders a never-reviewed topic as "—", never 0%', () => {
    renderDash(course([topic({ status: 'not_started', last_reviewed: null, strength: 0 })]));
    // Scope to the row: health and projected finish also (correctly) show "—"
    // when there is no data for them.
    const row = screen.getByRole('button', { name: 'Chain rule' }).closest('.row')!;
    const scoped = within(row as HTMLElement);
    expect(scoped.getByText('—')).toBeInTheDocument();
    expect(scoped.queryByText(/0%/)).not.toBeInTheDocument();
  });

  it('shows diagnostic badges on the row', () => {
    // 3 reviews at strength 1.3 → velocity 0.43 < 0.5 → Slow growth.
    const t = topic({
      review_history: [1, 2, 3].map((i) => ({
        event_id: `event_${i}`,
        date: '2026-07-01T12:00:00Z',
        kind: 'study_review' as const,
        source: 'session' as const,
        source_id: 'session_1',
        confidence_reported: 4 as const,
      })),
    });
    renderDash(course([t]));
    expect(screen.getByText('Slow growth')).toBeInTheDocument();
  });
});

describe('E4-S3 — hero, activity, props', () => {
  it('renders the hero avg-retention figure and the activity calendar', () => {
    renderDash(course([topic()]));
    expect(screen.getByText('Avg retention')).toBeInTheDocument();
    expect(screen.getByText('Study activity')).toBeInTheDocument();
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('renders the four props', () => {
    renderDash(course([topic()]));
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Calibration')).toBeInTheDocument();
    expect(screen.getByText('Due review')).toBeInTheDocument();
    expect(screen.getByText('Projected finish')).toBeInTheDocument();
  });

  it('surfaces course health for practising topics', () => {
    renderDash(course([topic()]));
    // No errors and no tests, so errorScore and calibrationScore are both full:
    //   0.30·37.19 + 0.25·100 + 0.20·100 + 0.15·80 + 0.10·20
    // =  11.16     + 25       + 20       + 12       + 2       = 70.16 → 70
    expect(screen.getByText('70')).toBeInTheDocument();
  });
});

/*
 * Empty states must never read as a failed load or as a fabricated zero — the
 * distinction the review called out. A brand-new course exercises all of them.
 */
describe('empty states are honest, not broken-looking', () => {
  const fresh = () =>
    course([topic({ status: 'not_started', last_reviewed: null, strength: 0, review_history: [] })]);

  const propOf = (label: string): HTMLElement =>
    screen.getByText(label).closest('.prop') as HTMLElement;

  it('replaces the retention sparkline with copy, not a flat zero line', () => {
    renderDash(fresh());
    expect(screen.getByText(/no retention history yet/i)).toBeInTheDocument();
    expect(screen.getByText('No history yet')).toBeInTheDocument();
  });

  it('captions the empty activity heatmap instead of showing a solid grid', () => {
    renderDash(fresh());
    expect(screen.getByText(/no study activity in the last 90 days/i)).toBeInTheDocument();
  });

  it('shows Calibration as "—" with no exam basis, never "+0.00"', () => {
    renderDash(fresh());
    const calibration = propOf('Calibration');
    expect(within(calibration).getByText('—')).toBeInTheDocument();
    expect(within(calibration).queryByText(/\+0\.00/)).not.toBeInTheDocument();
    expect(within(calibration).getByText(/log an exam to calibrate/i)).toBeInTheDocument();
  });

  it('still shows a genuine zero as 0 — Due review is not dashed out', () => {
    renderDash(fresh());
    const due = propOf('Due review');
    expect(within(due).getByText('0')).toBeInTheDocument();
  });

  it('explains the jargon labels with an info affordance', () => {
    renderDash(fresh());
    const calibration = propOf('Calibration');
    expect(within(calibration).getByLabelText(/calibration:.*confidence/i)).toBeInTheDocument();
  });
});

describe('E4-S4 — projection & review plan', () => {
  it('says "Not enough data yet" rather than fabricating a finish date', () => {
    renderDash(course([topic()]));
    expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument();
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

  it('lists the most-decayed topic in the review plan and badges it Next', () => {
    renderDash(course([topic()]));
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('reports an overdue topic as Overdue, not as a past date', () => {
    renderDash(course([topic()]));
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('tells the user nothing is due rather than showing an empty plan', () => {
    renderDash(course([topic({ last_reviewed: new Date().toISOString() })]));
    expect(screen.getByText(/nothing is due below 70% retention/i)).toBeInTheDocument();
  });
});
