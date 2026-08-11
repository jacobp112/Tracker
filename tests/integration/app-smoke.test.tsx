import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { AuthProvider } from '@/auth/useAuth';
import { mergeInto } from '@/core/merge';
import { commit, ingest } from '@/core/pipeline';
import { STORE_KEY } from '@/core/storage';
import { emptyStore, type Course, type Store } from '@/domain/types';

/**
 * Drives the real <App/> at each route with a populated store — the closest
 * this environment gets to running the app, since no browser driver is
 * installed. Catches runtime errors in the actual screen render paths that
 * unit tests of sub-functions can't.
 */

function populated(): Store {
  const course: Course = {
    schema_version: '2.0.0',
    course_id: 'course_smoke0001',
    title: 'Advanced Theory',
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [
      {
        section_id: 'section_smoke01',
        title: 'Fundamentals',
        order: 0,
        topics: [
          {
            topic_id: 'topic_smoke0001',
            title: 'Closures',
            status: 'practising',
            conf: 3,
            strength: 1.2,
            k_factor: 7.5,
            cards: 1,
            last_reviewed: '2026-07-12T12:00:00Z',
            mastered_at: null,
            drift_history: [],
            review_history: [
              {
                event_id: 'event_smoke0001',
                date: '2026-07-12T12:00:00Z',
                kind: 'study_review',
                source: 'session',
                source_id: 'session_smoke001',
                confidence_reported: 3,
              },
            ],
            error_log: [],
          },
          {
            topic_id: 'topic_smoke0002',
            title: 'Recursion',
            status: 'mastered',
            conf: 5,
            strength: 3.4,
            k_factor: 8.4,
            cards: 5,
            last_reviewed: '2026-07-14T12:00:00Z',
            mastered_at: '2026-07-10T12:00:00Z',
            drift_history: [],
            review_history: [],
            error_log: [],
          },
        ],
      },
    ],
  };

  let store: Store = { ...emptyStore(), courses: [course] };

  const session = ingest(
    JSON.stringify({
      schema_version: '2.0.0',
      session_id: 'session_smoke001',
      course_id: 'course_smoke0001',
      date: '2026-07-14T18:00:00Z',
      duration_minutes: 40,
      topics_covered: [
        {
          topic_id: 'topic_smoke0001',
          confidence_reported: 3,
          errors: [{ error_type: 'conceptual', description: 'Captured value not variable.' }],
        },
      ],
    }),
    'session',
    store,
  );
  if (session.ok) store = commit('session', session.value, store, mergeInto);

  const exam = ingest(
    JSON.stringify({
      schema_version: '2.0.0',
      exam_id: 'exam_smoke00001',
      title: 'Quiz 1',
      date: '2026-07-15T10:00:00Z',
      linked_topic_ids: ['topic_smoke0001', 'topic_smoke0002'],
      score: 14,
      max_score: 20,
      confidence_reported: 4,
      breakdown: [
        { topic_id: 'topic_smoke0001', points_earned: 5, points_possible: 10 },
        { topic_id: 'topic_smoke0002', points_earned: 9, points_possible: 10 },
      ],
    }),
    'exam',
    store,
  );
  if (exam.ok) store = commit('exam', exam.value, store, mergeInto);

  return store;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORE_KEY, JSON.stringify(populated()));
});

afterEach(() => {
  localStorage.clear();
});

function mountAt(hash: string) {
  window.location.hash = hash;
  // Settings reads useAuth for its Account section, so the app tree needs the
  // provider it has in production (main.tsx).
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
}

describe('App smoke — every route renders with real data', () => {
  it('Overview', () => {
    mountAt('#/overview');
    // Title lives in the shell topbar; the content leads with the stat grid.
    expect(screen.getByRole('heading', { name: /^overview$/i })).toBeInTheDocument();
    expect(screen.getByText(/recent activity/i)).toBeInTheDocument();
    expect(screen.getByText('Retrievable now')).toBeInTheDocument();
  });

  it('Study index', () => {
    mountAt('#/study');
    expect(screen.getByRole('heading', { name: /^study$/i })).toBeInTheDocument();
  });

  it('Course dashboard', () => {
    mountAt('#/course/course_smoke0001');
    // The course name appears in both the shell topbar and the in-content header.
    expect(screen.getAllByRole('heading', { name: 'Advanced Theory' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('group', { name: 'Avg retention' })).toBeInTheDocument();
    // A real topic row from the seeded course (the row is a labelled button).
    expect(screen.getByRole('button', { name: /closures/i })).toBeInTheDocument();
  });

  it('Add course', () => {
    mountAt('#/study/add');
    // The add flow is now a modal over the Study index.
    expect(screen.getByRole('dialog', { name: /add a course/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/paste the json/i)).toBeInTheDocument();
  });

  it('Exams', () => {
    mountAt('#/exams');
    expect(screen.getByRole('heading', { name: /^exams$/i })).toBeInTheDocument();
    expect(screen.getByText('Quiz 1')).toBeInTheDocument();
    // Effect chips derived from the breakdown.
    expect(screen.getByText(/boosted/i)).toBeInTheDocument();
    expect(screen.getByText(/flagged weak/i)).toBeInTheDocument();
  });

  it('Settings', () => {
    mountAt('#/settings');
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByText(/export data/i)).toBeInTheDocument();
  });

  it('Token sheet dev route', () => {
    mountAt('#/dev/tokens');
    expect(screen.getByRole('heading', { name: /token sheet/i })).toBeInTheDocument();
  });

  it('Component showcase dev route', () => {
    mountAt('#/dev/components');
    expect(screen.getByRole('heading', { name: /component showcase/i })).toBeInTheDocument();
  });
});

describe('App smoke — the sidebar lists your courses', () => {
  it('lists the course in the sidebar on any route', () => {
    mountAt('#/exams');
    // The "Your courses" list shows every course as a row, regardless of route.
    expect(screen.getByRole('button', { name: /advanced theory/i })).toBeInTheDocument();
  });

  it('marks the active course row on a course route', () => {
    mountAt('#/course/course_smoke0001');
    expect(screen.getByRole('button', { name: /advanced theory/i })).toHaveClass('active');
  });
});

describe('App smoke — empty store shows guiding empty states (Doc 3 §7)', () => {
  beforeEach(() => localStorage.clear());

  it('Overview tells the user to add a course', () => {
    mountAt('#/overview');
    expect(screen.getByRole('button', { name: /add your first course/i })).toBeInTheDocument();
  });

  it('Exams tells the user to add a result', () => {
    mountAt('#/exams');
    expect(screen.getByText(/no exams yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add an exam result/i })).toBeInTheDocument();
  });
});
