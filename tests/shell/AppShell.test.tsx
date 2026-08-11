import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { ToastProvider } from '@/components/feedback';
import { AppShell, type CourseSummary } from '@/shell/AppShell';
import type { Route } from '@/router';

const COURSES: CourseSummary[] = [
  { courseId: 'c1', title: 'Linear Algebra', initials: 'LA', masteryPct: 62 },
  { courseId: 'c2', title: 'Organic Chemistry', initials: 'OC', masteryPct: 31 },
];

function renderShell(
  hash = '#/overview',
  { route = { name: 'overview' } as Route, courses = [] as CourseSummary[], activeCourse = undefined as CourseSummary | undefined } = {},
) {
  window.location.hash = hash;
  return render(
    <ToastProvider>
      <AppShell route={route} courses={courses} activeCourse={activeCourse}>
        <div>content</div>
      </AppShell>
    </ToastProvider>,
  );
}

describe('AppShell — Document 3 §4 / E1-S3', () => {
  it('renders both navigations: sidebar and the bottom tab bar', () => {
    renderShell();
    // Both exist in the DOM; which one shows is a CSS breakpoint concern.
    const navs = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(navs).toHaveLength(2);
  });

  it('reaches Settings from the nav and Add from the topbar', () => {
    renderShell();
    // Settings is a primary nav entry (sidebar) + a bottom-tab link.
    expect(screen.getAllByRole('button', { name: /settings/i }).length).toBeGreaterThan(0);
    // Quick add moved to the topbar's primary "＋ Add" control (the ＋ glyph is
    // aria-hidden, so the accessible name is just "Add").
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument();
  });

  it('marks the active destination with aria-current', () => {
    renderShell();
    const tabbar = screen.getAllByRole('navigation', { name: 'Primary' })[1]!;
    const overview = within(tabbar).getByRole('link', { name: /overview/i });
    expect(overview).toHaveAttribute('aria-current', 'page');
  });

  it('exposes a labelled theme toggle', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /switch to (dark|light) mode/i })).toBeInTheDocument();
  });

  it('tells the user what to do when no courses exist, rather than showing nothing', () => {
    renderShell();
    expect(screen.getByText(/no courses yet/i)).toBeInTheDocument();
  });
});

/*
 * Study is a flat primary-nav entry that navigates straight to the /study
 * index (the old split-control disclosure was removed — courses now live in
 * their own "Your courses" list below the nav).
 */
describe('AppShell — the Study nav entry', () => {
  it('navigates to the Study page when clicked', async () => {
    const user = userEvent.setup();
    renderShell('#/overview', { courses: COURSES });

    await user.click(screen.getByRole('button', { name: 'Study' }));

    expect(window.location.hash).toBe('#/study');
  });
});

/*
 * The sidebar lists every course with its mastery, on every route, and marks
 * the row you are currently inside.
 */
describe('AppShell — the sidebar course list', () => {
  it('lists every course with its mastery', () => {
    renderShell('#/overview', { courses: COURSES });
    expect(screen.getByRole('button', { name: /linear algebra/i })).toBeInTheDocument();
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('31%')).toBeInTheDocument();
  });

  it('marks the active course row on a course route', () => {
    renderShell('#/course/c1', {
      route: { name: 'course', courseId: 'c1' },
      courses: COURSES,
      activeCourse: COURSES[0],
    });
    expect(screen.getByRole('button', { name: /linear algebra/i })).toHaveClass('active');
  });
});

describe('App — routing smoke test', () => {
  it('mounts the dev token sheet without crashing', () => {
    window.location.hash = '#/dev/tokens';
    render(<App />);
    expect(screen.getByRole('heading', { name: /token sheet/i })).toBeInTheDocument();
  });

  it('mounts the component showcase without crashing', () => {
    window.location.hash = '#/dev/components';
    render(<App />);
    expect(screen.getByRole('heading', { name: /component showcase/i })).toBeInTheDocument();
  });

  it('renders an empty state that says what to do next, per the voice rules (Doc 3 §7)', () => {
    window.location.hash = '#/study';
    render(<App />);
    expect(screen.getByText(/add one to start tracking retention/i)).toBeInTheDocument();
  });
});
