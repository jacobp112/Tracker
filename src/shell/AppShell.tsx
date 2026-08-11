import { type ReactNode } from 'react';
import { navigate, type Route } from '@/router';
import { useTheme } from '@/theme/useTheme';
import { SHORTCUT_LABEL } from '@/hooks/useCommandShortcut';
import {
  CairnMark,
  ExamsIcon,
  MoonIcon,
  OverviewIcon,
  SearchIcon,
  SettingsIcon,
  StudyIcon,
  SunIcon,
} from './icons';

type NavName = Route['name'];

/** Which nav entry should read as active for a given route. */
function activeFor(route: Route): NavName {
  if (route.name === 'course' || route.name === 'add-course') return 'study';
  if (route.name === 'add-exam') return 'exams';
  return route.name;
}

const NAV = [
  { name: 'overview' as const, label: 'Overview', to: '/overview', Icon: OverviewIcon },
  { name: 'performance' as const, label: 'Performance', to: '/performance', Icon: OverviewIcon },
  { name: 'study' as const, label: 'Study', to: '/study', Icon: StudyIcon },
  { name: 'exams' as const, label: 'Exams', to: '/exams', Icon: ExamsIcon },
  { name: 'settings' as const, label: 'Settings', to: '/settings', Icon: SettingsIcon },
];

/** Course-row accent, cycled so the sidebar stack reads as hand-stacked. */
const COURSE_ACCENTS = [
  'var(--brand-teal)',
  'var(--brand-lavender)',
  'var(--brand-orange)',
  'var(--ink-muted)',
];

/** Topbar title + subtitle per route. Course uses the live course name. */
function heading(route: Route, activeCourse?: CourseSummary): { title: string; sub: string } {
  switch (route.name) {
    case 'overview':
      return { title: 'Overview', sub: 'Your study at a glance' };
    case 'study':
      return { title: 'Study', sub: 'Every course you’re tracking' };
    case 'course':
      return { title: activeCourse?.title ?? 'Course', sub: 'Course dashboard' };
    case 'add-course':
      return { title: 'Add a course', sub: 'Paste a plan to get started' };
    case 'exams':
      return { title: 'Exams', sub: 'Papers & readiness' };
    case 'add-exam':
      return { title: 'Add an exam result', sub: 'Log a graded paper' };
    case 'quick-add':
      return { title: 'Quick add', sub: 'Paste to add anything' };
    case 'settings':
      return { title: 'Settings', sub: 'Preferences & your data' };
    default:
      return { title: 'Cairn', sub: '' };
  }
}

export interface CourseSummary {
  courseId: string;
  title: string;
  initials: string;
  masteryPct: number;
}

/**
 * App shell — Document 3 §4 + the approved redesign mockup.
 * Desktop: persistent sidebar (Cairn mark, primary nav, the live course list,
 * an in-sidebar light/dark toggle). Below 768px it collapses to a bottom tab
 * bar. Everything here is reachable by keyboard. Routing/logic is unchanged;
 * this owns only the chrome.
 */
export function AppShell({
  route,
  courses,
  activeCourse,
  action,
  onOpenSearch,
  children,
}: {
  route: Route;
  courses: readonly CourseSummary[];
  activeCourse?: CourseSummary;
  action?: ReactNode;
  /** Opens the command palette. The shell draws the entry points; App owns the
   *  palette itself, since it needs the store. */
  onOpenSearch?: () => void;
  children: ReactNode;
}) {
  const { theme, set } = useTheme();
  const active = activeFor(route);
  const { title, sub } = heading(route, activeCourse);

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand-lockup" type="button" onClick={() => navigate('/overview')}>
          <CairnMark className="brand-mark" />
          <span className="brand-word">Cairn</span>
        </button>

        <nav className="nav-primary" aria-label="Primary">
          {NAV.map(({ name, label, to, Icon }) => (
            <button
              key={name}
              type="button"
              className={`nav-item ${active === name ? 'active' : ''}`}
              onClick={() => navigate(to)}
              aria-current={active === name ? 'page' : undefined}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>

        <div className="nav-divider" />

        <div className="course-list">
          <p className="course-list-label">Your courses</p>
          {courses.length === 0 ? (
            <p className="course-list-empty">No courses yet</p>
          ) : (
            <div className="course-list-scroll">
              {courses.map((c, i) => {
                const isActive = route.name === 'course' && route.courseId === c.courseId;
                return (
                  <button
                    key={c.courseId}
                    type="button"
                    className={`course-row ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(`/course/${c.courseId}`)}
                    title={`${c.title} — ${c.masteryPct}% mastery`}
                    style={{ ['--course-accent' as string]: COURSE_ACCENTS[i % COURSE_ACCENTS.length] }}
                  >
                    <span className="course-tile" aria-hidden="true">
                      {c.initials}
                    </span>
                    <span className="course-row-name">{c.title}</span>
                    <span className="course-row-mastery mono-num">{c.masteryPct}%</span>
                    <span className="course-row-track" aria-hidden="true">
                      <span
                        className="course-row-fill"
                        style={{ width: `${c.masteryPct}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="nav-divider" />

        <div className="theme-switch" role="group" aria-label="Theme">
          <span
            className="theme-switch-thumb"
            aria-hidden="true"
            data-theme-pos={theme}
          />
          <button
            type="button"
            className={`theme-seg ${theme === 'light' ? 'active' : ''}`}
            onClick={() => set('light')}
            aria-pressed={theme === 'light'}
          >
            <SunIcon />
            Light
          </button>
          <button
            type="button"
            className={`theme-seg ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => set('dark')}
            aria-pressed={theme === 'dark'}
          >
            <MoonIcon />
            Dark
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <h1 className="topbar-h1">{title}</h1>
            {sub && <p className="topbar-sub">{sub}</p>}
          </div>
          <div className="topbar-right">
            {action}
            <button className="topbar-search" type="button" onClick={onOpenSearch}>
              <SearchIcon />
              <span className="topbar-search-label">Search or jump to…</span>
              <span className="topbar-search-key">{SHORTCUT_LABEL}</span>
            </button>
            <button className="topbar-add" type="button" onClick={() => navigate('/add')}>
              <span aria-hidden="true">＋</span> Add
            </button>
          </div>
        </header>

        {children}
      </div>

      {/* Bottom tab bar — Document 3 §4, shown below 768px via CSS. */}
      <nav className="tabbar" aria-label="Primary">
        {NAV.map(({ name, label, to, Icon }) => (
          <a
            key={name}
            href={`#${to}`}
            className={`tab ${active === name ? 'active' : ''}`}
            aria-current={active === name ? 'page' : undefined}
          >
            <Icon />
            {label}
          </a>
        ))}
        <button
          type="button"
          className="tab tab-theme"
          onClick={() => set(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          Theme
        </button>
      </nav>
    </div>
  );
}
