import { useState, type ReactNode } from 'react';
import { navigate, type Route } from '@/router';
import { useTheme } from '@/theme/useTheme';
import { SHORTCUT_LABEL } from '@/hooks/useCommandShortcut';
import { IconButton } from '@/components/primitives';
import {
  AddIcon,
  ChevronDown,
  ExamsIcon,
  FitnessIcon,
  JobsIcon,
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
  if (route.name === 'add-run' || route.name === 'add-lift') return 'fitness';
  if (route.name === 'add-job') return 'jobs';
  return route.name;
}

const TABS = [
  { name: 'overview' as const, label: 'Overview', href: '#/overview', Icon: OverviewIcon },
  { name: 'study' as const, label: 'Study', href: '#/study', Icon: StudyIcon },
  { name: 'fitness' as const, label: 'Fitness', href: '#/fitness', Icon: FitnessIcon },
  { name: 'exams' as const, label: 'Exams', href: '#/exams', Icon: ExamsIcon },
  { name: 'jobs' as const, label: 'Jobs', href: '#/jobs', Icon: JobsIcon },
  { name: 'settings' as const, label: 'Settings', href: '#/settings', Icon: SettingsIcon },
];

export interface CourseSummary {
  courseId: string;
  title: string;
  initials: string;
  masteryPct: number;
}

/**
 * App shell — Document 3 §4.
 * Desktop: persistent sidebar. Below 768px: bottom tab bar (the mockup omits
 * mobile nav; §4 governs). Everything here is reachable by keyboard.
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
  const { theme, toggle } = useTheme();
  const [studyOpen, setStudyOpen] = useState(true);
  const active = activeFor(route);

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="course-switch" type="button" onClick={() => navigate('/study')}>
          <div className="course-icon" aria-hidden="true">
            {activeCourse?.initials ?? '—'}
          </div>
          <div className="course-meta">
            <div className="course-name">
              {activeCourse?.title ?? (courses.length > 0 ? 'All courses' : 'No course yet')}
              <ChevronDown />
            </div>
            <div className="course-mastery">
              {activeCourse
                ? `Mastery ${activeCourse.masteryPct}%`
                : courses.length > 0
                  ? `${courses.length} course${courses.length === 1 ? '' : 's'}`
                  : 'Add one to start'}
            </div>
          </div>
        </button>

        <button className="cmdk" type="button" onClick={onOpenSearch}>
          <SearchIcon />
          <span className="cmdk-label">Search</span>
          <span className="cmdk-key">{SHORTCUT_LABEL}</span>
        </button>

        <nav aria-label="Primary">
          <button
            type="button"
            className={`nav-item ${active === 'overview' ? 'active' : ''}`}
            onClick={() => navigate('/overview')}
            aria-current={active === 'overview' ? 'page' : undefined}
          >
            <OverviewIcon />
            Overview
          </button>

          {/* Split control: the label navigates, the chevron discloses the course
            * list. A single button doing both meant Study could never reach the
            * Study page — it only ever toggled. */}
          <div className={`nav-group ${studyOpen ? '' : 'collapsed'}`}>
            <div className={`nav-item nav-item-split ${active === 'study' ? 'active' : ''}`}>
              <button
                type="button"
                className="nav-item-main"
                onClick={() => navigate('/study')}
                aria-current={active === 'study' ? 'page' : undefined}
              >
                <StudyIcon />
                Study
              </button>
              <button
                type="button"
                className="nav-disclosure"
                onClick={() => setStudyOpen((o) => !o)}
                aria-expanded={studyOpen}
                aria-controls="study-sub-nav"
                aria-label={studyOpen ? 'Collapse course list' : 'Expand course list'}
              >
                <ChevronDown className="nav-chevron" />
              </button>
            </div>
            <div className="sub-nav" id="study-sub-nav">
              <div className="sub-nav-inner">
                {courses.length === 0 ? (
                  <span className="sub-item" style={{ color: 'var(--ink-muted)', cursor: 'default' }}>
                    No courses yet
                  </span>
                ) : (
                  courses.map((c) => (
                    <button
                      key={c.courseId}
                      type="button"
                      className={`sub-item ${
                        route.name === 'course' && route.courseId === c.courseId ? 'active' : ''
                      }`}
                      onClick={() => navigate(`/course/${c.courseId}`)}
                    >
                      {c.title}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`nav-item ${active === 'fitness' ? 'active' : ''}`}
            onClick={() => navigate('/fitness')}
          >
            <FitnessIcon />
            Fitness
          </button>
          <button
            type="button"
            className={`nav-item ${active === 'exams' ? 'active' : ''}`}
            onClick={() => navigate('/exams')}
          >
            <ExamsIcon />
            Exams
          </button>
          <button
            type="button"
            className={`nav-item ${active === 'jobs' ? 'active' : ''}`}
            onClick={() => navigate('/jobs')}
          >
            <JobsIcon />
            Jobs
          </button>

          <div className="nav-divider" />

          <button
            type="button"
            className={`nav-item nav-action ${active === 'quick-add' ? 'active' : ''}`}
            onClick={() => navigate('/add')}
          >
            <AddIcon />
            Quick add
          </button>
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className={`nav-item ${active === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('/settings')}
          >
            <SettingsIcon />
            Settings
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="brand">StudyOS</div>
          <div className="topbar-right">
            {action}
            {/* The sidebar's ⌘K row is hidden below 768px, so without this the
              * palette would be desktop-only. The topbar is visible at every
              * width. */}
            <IconButton label={`Search (${SHORTCUT_LABEL})`} onClick={onOpenSearch}>
              <SearchIcon />
            </IconButton>
            <IconButton
              label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="theme-toggle"
              onClick={toggle}
            >
              <SunIcon />
              <MoonIcon />
            </IconButton>
          </div>
        </header>

        {children}
      </div>

      {/* Bottom tab bar — Document 3 §4, shown below 768px via CSS. */}
      <nav className="tabbar" aria-label="Primary">
        {TABS.map(({ name, label, href, Icon }) => (
          <a
            key={name}
            href={href}
            className={`tab ${active === name ? 'active' : ''}`}
            aria-current={active === name ? 'page' : undefined}
          >
            <Icon />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
