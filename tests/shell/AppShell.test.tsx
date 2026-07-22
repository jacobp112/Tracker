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

  it('reaches Quick add and Settings from the shell', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /quick add/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /settings/i }).length).toBeGreaterThan(0);
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
 * The Study entry is a split control: the label navigates, the chevron
 * discloses. It previously toggled only, which left the /study route
 * unreachable from the desktop sidebar entirely.
 */
describe('AppShell — the Study nav entry', () => {
  it('navigates to the Study page when the label is clicked', async () => {
    const user = userEvent.setup();
    renderShell('#/overview', { courses: COURSES });

    await user.click(screen.getByRole('button', { name: 'Study' }));

    expect(window.location.hash).toBe('#/study');
  });

  it('discloses the course list from the chevron without navigating away', async () => {
    const user = userEvent.setup();
    renderShell('#/overview', { courses: COURSES });

    const disclosure = screen.getByRole('button', { name: /collapse course list/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');

    await user.click(disclosure);

    expect(screen.getByRole('button', { name: /expand course list/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    // The disclosure is not navigation — the route must be untouched.
    expect(window.location.hash).toBe('#/overview');
  });

  it('points the disclosure at the list it controls', () => {
    renderShell('#/overview', { courses: COURSES });
    const disclosure = screen.getByRole('button', { name: /collapse course list/i });
    const controlled = document.getElementById(disclosure.getAttribute('aria-controls')!);
    expect(controlled).toBeInTheDocument();
    expect(within(controlled!).getByRole('button', { name: 'Linear Algebra' })).toBeInTheDocument();
  });
});

/*
 * The sidebar header states the user's current context. Off a course route
 * there isn't one, and inventing a course there is a lie about where you are.
 */
describe('AppShell — course context header', () => {
  it('names the active course and its mastery on a course route', () => {
    renderShell('#/course/c1', {
      route: { name: 'course', courseId: 'c1' },
      courses: COURSES,
      activeCourse: COURSES[0],
    });
    // Matched on the composed name — a bare /linear algebra/ also hits the
    // sub-nav entry for the same course.
    const header = screen.getByRole('button', { name: /linear algebra mastery 62%/i });
    expect(within(header).getByText('Linear Algebra')).toBeInTheDocument();
    expect(within(header).getByText(/mastery 62%/i)).toBeInTheDocument();
  });

  it('claims no active course off a course route, even when courses exist', () => {
    renderShell('#/overview', { courses: COURSES });

    expect(screen.getByText('All courses')).toBeInTheDocument();
    expect(screen.getByText('2 courses')).toBeInTheDocument();
    // The old fallback showed courses[0] here as if you were inside it.
    expect(screen.queryByText(/mastery/i)).not.toBeInTheDocument();
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
