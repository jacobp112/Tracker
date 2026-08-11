import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button, Card } from '@/components/primitives';
import { CommandPalette } from '@/components/CommandPalette';
import { EmptyState, ToastProvider, useToast } from '@/components/feedback';
import { useCommandShortcut } from '@/hooks/useCommandShortcut';
import { useStore } from '@/hooks/useStore';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';
import { navigate, useRoute } from '@/router';
import type { PaletteAction } from '@/engine/palette';
import { AppShell, type CourseSummary } from '@/shell/AppShell';
import { AddIcon } from '@/shell/icons';
import { AddFlow } from '@/routes/AddFlow';
import { Auth } from '@/routes/Auth';
import { Celebration } from '@/routes/Celebration';
import { ComponentShowcase } from '@/routes/ComponentShowcase';
import { CourseDashboard } from '@/routes/CourseDashboard';
import { Exams } from '@/routes/Exams';
import { FocusMode } from '@/routes/FocusMode';
import { Overview } from '@/routes/Overview';
import { Performance } from '@/routes/Performance';
import { Settings } from '@/routes/Settings';
import { StartSession } from '@/routes/StartSession';
import { TokenSheet } from '@/routes/TokenSheet';
import { TopicDetail } from '@/routes/TopicDetail';
import { clearFocusDraft, loadFocusDraft, saveFocusDraft, type FocusDraft } from '@/core/focusDraft';
import { courseHealth, courseTopics } from '@/engine/course';
import { sessionWrapUpPrompt } from '@/engine/session';
import { projectedDue } from '@/engine/retention';
import type { Course, SessionIntent, SessionScope, Store } from '@/domain/types';
import type { PomodoroConfig, TimerMode } from '@/hooks/useStudyTimer';

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Sidebar mastery % = mastered topics / all topics (Document 3 §4). */
function summarise(course: Course): CourseSummary {
  const topics = course.sections.flatMap((s) => s.topics);
  const mastered = topics.filter((t) => t.status === 'mastered').length;
  return {
    courseId: course.course_id,
    title: course.title,
    initials: initials(course.title),
    masteryPct: topics.length === 0 ? 0 : Math.round((mastered / topics.length) * 100),
  };
}

function Placeholder({ title, blurb, action }: { title: string; blurb: string; action?: React.ReactNode }) {
  return (
    <div className="content">
      <div className="page-head">
        <h1>{title}</h1>
      </div>
      <div className="section">
        <Card>
          <EmptyState icon={<AddIcon />} title={blurb} action={action} />
        </Card>
      </div>
    </div>
  );
}

/**
 * The course surface — dashboard + its two overlays (E4-S5 topic detail,
 * E4-S6 log session). Both read the live store, so a commit re-derives every
 * number on the next render with no manual refresh (E4-S6).
 */
function CourseScreen({
  course,
  store,
  commitValue,
  undoLast,
  toggleError,
  promoteTopic,
  logManualReview,
  onStartSession,
}: {
  course: Course;
  store: Store;
  commitValue: ReturnType<typeof useStore>['commitValue'];
  undoLast: ReturnType<typeof useStore>['undoLast'];
  toggleError: ReturnType<typeof useStore>['toggleError'];
  promoteTopic: ReturnType<typeof useStore>['promoteTopic'];
  logManualReview: ReturnType<typeof useStore>['logManualReview'];
  onStartSession: (topicId: string) => void;
}) {
  const [logging, setLogging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const { toast } = useToast();

  // Resolve from the live store each render rather than holding the topic
  // object — a stale copy would keep showing pre-commit numbers.
  const selected = selectedId
    ? courseTopics(course).find((r) => r.topic.topic_id === selectedId)
    : undefined;

  return (
    <>
      <CourseDashboard
        course={course}
        onLogSession={() => setLogging(true)}
        onSelectTopic={(t) => setSelectedId(t.topic_id)}
        onStartSession={onStartSession}
      />
      {logging && (
        <AddFlow
          kind="session"
          courseId={course.course_id}
          store={store}
          commitValue={commitValue}
          undoLast={undoLast}
          onClose={() => setLogging(false)}
        />
      )}
      <TopicDetail
        topic={selected?.topic ?? null}
        sectionTitle={selected?.section.title ?? ''}
        onClose={() => setSelectedId(null)}
        onResolveError={(topicId, errorId) => {
          const error = toggleError(topicId, errorId);
          if (error) toast(error, 'error');
        }}
        onPromote={(topicId, status) => {
          const wasMastered = selected?.topic.status === 'mastered';
          const error = promoteTopic(topicId, status);
          if (error) toast(error, 'error');
          else if (status === 'mastered' && !wasMastered) {
            setCelebrate(selected?.topic.title ?? 'This topic');
          }
        }}
        onQuickReview={(topicId, confidence) => {
          const error = logManualReview(topicId, confidence);
          toast(error ?? `Review logged — confidence ${confidence}/5`, error ? 'error' : 'success');
        }}
        onStartSession={onStartSession}
      />
      {celebrate && <Celebration topicName={celebrate} onClose={() => setCelebrate(null)} />}
    </>
  );
}

/** Health → bar tone (matches the Prop caption thresholds on the dashboard). */
function healthTone(score: number): 'ok' | 'warn' | 'bad' {
  if (score >= 70) return 'ok';
  if (score >= 45) return 'warn';
  return 'bad';
}

/** One course card — mastery ring, health bar, due badge. All numbers are the
 *  same the course dashboard derives, so the two never disagree. */
function StudyCard({ course, now }: { course: Course; now: Date }) {
  const refs = courseTopics(course);
  const topics = course.sections.flatMap((s) => s.topics);
  const mastered = topics.filter((t) => t.status === 'mastered').length;
  const masteryPct = topics.length === 0 ? 0 : Math.round((mastered / topics.length) * 100);
  const chealth = courseHealth(refs, now);
  const due = refs.filter((r) => projectedDue(r.topic, now)?.overdue === true).length;

  const circ = 2 * Math.PI * 22;
  const offset = circ * (1 - masteryPct / 100);

  return (
    <button
      type="button"
      className="study-card"
      onClick={() => navigate(`/course/${course.course_id}`)}
      title={`${course.title} — ${masteryPct}% mastery`}
    >
      <span className="study-card-band" aria-hidden="true" />
      <div className="study-card-top">
        <span className="study-ring-wrap">
          <svg viewBox="0 0 52 52" className="study-ring" aria-hidden="true">
            <circle cx="26" cy="26" r="22" className="study-ring-track" />
            <circle
              cx="26"
              cy="26"
              r="22"
              className="study-ring-fill"
              strokeDasharray={circ}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="study-ring-num mono-num">{masteryPct}%</span>
        </span>
        <div className="study-card-headings">
          <p className="study-card-title">{course.title}</p>
          <p className="study-card-meta">
            <span className="mono-num">{topics.length}</span> {topics.length === 1 ? 'topic' : 'topics'}
          </p>
        </div>
      </div>

      <div className="study-health">
        <div className="study-health-label">
          <span>Health</span>
          <span className="mono-num">{chealth ?? '—'}</span>
        </div>
        <div className="study-health-track">
          <span
            className={`study-health-fill ${chealth === null ? 'none' : healthTone(chealth)}`}
            style={{ width: `${chealth ?? 0}%` }}
          />
        </div>
      </div>

      <div className="study-card-foot">
        <span className="course-tile" aria-hidden="true">
          {initials(course.title)}
        </span>
        {due > 0 && <span className="study-due-badge">{due} due</span>}
      </div>
    </button>
  );
}

function StudyIndex({ store }: { store: Store }) {
  const [now] = useState(() => new Date());

  if (store.courses.length === 0) {
    return (
      <Placeholder
        title="Study"
        blurb="No courses yet. Add one to start tracking retention."
        action={<Button onClick={() => navigate('/study/add')}>Add course</Button>}
      />
    );
  }
  return (
    <div className="content">
      <div className="study-grid reveal" style={{ ['--i' as string]: 0 }}>
        {store.courses.map((c) => (
          <StudyCard key={c.course_id} course={c} now={now} />
        ))}
        <button type="button" className="add-course-card" onClick={() => navigate('/study/add')}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="6 6" />
            <path d="M50 32v36M32 50h36" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          Add course
        </button>
      </div>
    </div>
  );
}

/** The start-session flow's phases (Task 9's setup → Task 10's focus →
 *  Task 5/8's paste-import), lifted to app level so it survives navigation
 *  (a due-queue "Review" click can jump routes) and so the resume prompt
 *  can re-enter `focus` from any screen. */
type SessionFlowState =
  | { phase: 'idle' }
  | { phase: 'setup'; courseId: string; sectionId: string; topicId: string }
  | { phase: 'focus'; draft: FocusDraft }
  | { phase: 'import'; draft: FocusDraft; measuredMinutes: number };

function initialDraft(
  courseId: string,
  sectionId: string,
  topicId: string,
  topicTitle: string,
  cfg: { intent: SessionIntent; scope: SessionScope; timer_mode: TimerMode; pomodoro?: PomodoroConfig },
): FocusDraft {
  return {
    course_id: courseId,
    section_id: sectionId,
    topic_id: topicId,
    topic_title: topicTitle,
    intent: cfg.intent,
    scope: cfg.scope,
    timer_mode: cfg.timer_mode,
    pomodoro: cfg.pomodoro,
    created_at: new Date().toISOString(),
    elapsed_seconds: 0,
    checked_error_ids: [],
  };
}

/** "Resume your focus session on X?" banner — shown once at mount when a
 *  FocusMode draft was left mid-session (tab closed, crash, accidental
 *  navigate). Continue re-enters `focus` with the persisted draft; Discard
 *  clears it. Local `useTheme` read like every other route component here. */
function ResumeBanner({
  topicTitle,
  onContinue,
  onDiscard,
}: {
  topicTitle: string;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const { theme: mode } = useTheme();
  const theme = getCairnTheme(mode === 'dark');
  const wrap: CSSProperties = {
    position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 80,
    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', maxWidth: '92vw',
    background: theme.surface, border: `2px solid ${theme.border}`, borderRadius: '9999px',
    padding: '12px 18px', boxShadow: `5px 6px 0 ${theme.shadow}`,
  };
  const btn = (bg: string, color: string): CSSProperties => ({
    background: bg, color, border: `2px solid ${theme.border}`, borderRadius: '9999px',
    padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  });
  return (
    <div style={wrap} role="alert">
      <span style={{ fontSize: '13px', color: theme.ink }}>
        Resume your focus session on <strong>{topicTitle}</strong>?
      </span>
      <button type="button" data-press onClick={onContinue} style={btn(theme.pine, theme.onAccent)}>
        Continue
      </button>
      <button type="button" data-press onClick={onDiscard} style={btn('none', theme.muted)}>
        Discard
      </button>
    </div>
  );
}

function AppInner() {
  const route = useRoute();
  const {
    store,
    commitValue,
    commitSession,
    undoLast,
    toggleError,
    promoteTopic,
    logManualReview,
    replaceStore,
    clearStore,
    loadError,
  } = useStore();
  const { toggle: toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [flow, setFlow] = useState<SessionFlowState>({ phase: 'idle' });
  const [resumeDraft, setResumeDraft] = useState<FocusDraft | null>(null);

  // Resume prompt: re-read the single source of truth (localStorage)
  // whenever the flow returns to idle — including on mount, since `flow`
  // starts at 'idle'. A mount-only effect would go stale: FocusMode
  // autosaves the draft every tick, commit/discard clears it, and the
  // banner must reflect whichever of those happened most recently rather
  // than whatever was in storage when the app first loaded.
  useEffect(() => {
    if (flow.phase === 'idle') setResumeDraft(loadFocusDraft());
  }, [flow.phase]);

  useCommandShortcut(() => setSearchOpen((o) => !o));

  const runPaletteAction = useCallback(
    (action: PaletteAction) => {
      if (action === 'toggle-theme') toggleTheme();
    },
    [toggleTheme],
  );

  /** Entry point for both the TopicDetail drawer button and the Overview /
   *  CourseDashboard due-queue "Review" shortcuts — resolves the section for
   *  the topic and opens the setup modal, navigating to the course if the
   *  caller wasn't already there. */
  const startSession = useCallback(
    (courseId: string, topicId: string) => {
      const course = store.courses.find((c) => c.course_id === courseId);
      const ref = course ? courseTopics(course).find((r) => r.topic.topic_id === topicId) : undefined;
      if (!course || !ref) return;
      setFlow({ phase: 'setup', courseId: course.course_id, sectionId: ref.section.section_id, topicId: ref.topic.topic_id });
      if (!(route.name === 'course' && route.courseId === courseId)) navigate(`/course/${courseId}`);
    },
    [store, route],
  );

  const courses = store.courses.map(summarise);
  // Only a course route has an active course. Falling back to courses[0] made
  // the sidebar present an arbitrary course — and its mastery % — as the
  // current context on Overview, Exams and Settings.
  const activeCourse =
    route.name === 'course' ? courses.find((c) => c.courseId === route.courseId) : undefined;

  const screen = (() => {
    if (loadError) {
      return <Placeholder title="Something's wrong with your saved data" blurb={loadError} />;
    }

    switch (route.name) {
      case 'dev-tokens':
        return <TokenSheet />;
      case 'dev-components':
        return <ComponentShowcase />;
      case 'add-course':
        return (
          <>
            <StudyIndex store={store} />
            <AddFlow
              kind="course"
              store={store}
              commitValue={commitValue}
              undoLast={undoLast}
              onClose={() => navigate('/study')}
            />
          </>
        );
      case 'overview':
        return <Overview store={store} onStartSession={startSession} />;
      case 'performance':
        return <Performance store={store} />;
      case 'study':
        return <StudyIndex store={store} />;
      case 'course': {
        const course = store.courses.find((c) => c.course_id === route.courseId);
        if (!course) {
          return <Placeholder title="Course not found" blurb="That course isn't in your tracker." />;
        }
        return (
          <CourseScreen
            course={course}
            store={store}
            commitValue={commitValue}
            undoLast={undoLast}
            toggleError={toggleError}
            promoteTopic={promoteTopic}
            logManualReview={logManualReview}
            onStartSession={(topicId) => startSession(course.course_id, topicId)}
          />
        );
      }
      case 'exams':
        return <Exams store={store} />;
      case 'add-exam':
        return (
          <>
            <Exams store={store} />
            <AddFlow
              kind="exam"
              store={store}
              commitValue={commitValue}
              undoLast={undoLast}
              onClose={() => navigate('/exams')}
            />
          </>
        );
      case 'quick-add':
        return (
          <>
            <Overview store={store} />
            <AddFlow
              kind="quick"
              store={store}
              commitValue={commitValue}
              undoLast={undoLast}
              onClose={() => navigate('/overview')}
            />
          </>
        );
      case 'settings':
        return <Settings store={store} replaceStore={replaceStore} clearStore={clearStore} />;
    }
  })();

  // Resolve the setup/focus context from the live store by id each render —
  // same rationale as CourseScreen's `selected`: a stale captured object
  // would show pre-commit numbers.
  const setupCtx =
    flow.phase === 'setup'
      ? (() => {
          const c = store.courses.find((x) => x.course_id === flow.courseId);
          const ref = c ? courseTopics(c).find((r) => r.topic.topic_id === flow.topicId) : undefined;
          return c && ref ? { course: c, section: ref.section, topic: ref.topic } : null;
        })()
      : null;
  const focusUnresolvedErrors =
    flow.phase === 'focus'
      ? (() => {
          const c = store.courses.find((x) => x.course_id === flow.draft.course_id);
          const ref = c ? courseTopics(c).find((r) => r.topic.topic_id === flow.draft.topic_id) : undefined;
          return ref
            ? ref.topic.error_log.filter((e) => !e.resolved).map((e) => ({ error_id: e.error_id, description: e.description }))
            : [];
        })()
      : [];

  return (
    <AppShell
      route={route}
      courses={courses}
      activeCourse={activeCourse}
      onOpenSearch={() => setSearchOpen(true)}
    >
      {screen}
      {flow.phase === 'setup' && setupCtx && (
        <StartSession
          course={setupCtx.course}
          section={setupCtx.section}
          topic={setupCtx.topic}
          onBegin={(cfg) => {
            const draft = initialDraft(
              setupCtx.course.course_id,
              setupCtx.section.section_id,
              setupCtx.topic.topic_id,
              setupCtx.topic.title,
              cfg,
            );
            saveFocusDraft(draft);
            setFlow({ phase: 'focus', draft });
          }}
          onClose={() => setFlow({ phase: 'idle' })}
        />
      )}
      {flow.phase === 'focus' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 95, overflowY: 'auto' }}>
          <FocusMode
            draft={flow.draft}
            unresolvedErrors={focusUnresolvedErrors}
            onEnd={(measuredMinutes) => setFlow({ phase: 'import', draft: flow.draft, measuredMinutes })}
            onDiscard={() => {
              clearFocusDraft();
              setFlow({ phase: 'idle' });
            }}
          />
        </div>
      )}
      {flow.phase === 'import' && (
        <AddFlow
          kind="session"
          courseId={flow.draft.course_id}
          store={store}
          commitValue={commitValue}
          undoLast={undoLast}
          promptOverride={(() => {
            const c = store.courses.find((c) => c.course_id === flow.draft.course_id);
            const topics = c ? courseTopics(c).map((r) => ({ topic_id: r.topic.topic_id, title: r.topic.title })) : [];
            return sessionWrapUpPrompt(flow.draft.course_id, topics);
          })()}
          onClose={() => setFlow({ phase: 'idle' })}
          onCommitOverride={(value) => {
            const error = commitSession(value, {
              topic_id: flow.draft.topic_id,
              created_at: flow.draft.created_at,
              intent: flow.draft.intent,
              scope: flow.draft.scope,
              timer_mode: flow.draft.timer_mode,
              pomodoro_config: flow.draft.pomodoro,
              measured_minutes: flow.measuredMinutes,
            });
            if (!error) clearFocusDraft();
            return error;
          }}
        />
      )}
      {resumeDraft && flow.phase === 'idle' && (
        <ResumeBanner
          topicTitle={resumeDraft.topic_title}
          onContinue={() => {
            const d = resumeDraft;
            setResumeDraft(null);
            setFlow({ phase: 'focus', draft: d });
          }}
          onDiscard={() => {
            clearFocusDraft();
            setResumeDraft(null);
          }}
        />
      )}
      <CommandPalette
        store={store}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onAction={runPaletteAction}
      />
    </AppShell>
  );
}

// ToastProvider wraps AppInner rather than living inside it, so screens (and
// their overlays) can raise toasts via useToast.
//
// The auth/non-auth split happens here, before the provider tree, so it's a
// component swap (mount/unmount) rather than a conditional early-return
// inside AppInner. AppInner is remounted fresh on every auth<->non-auth
// transition, so its hooks are never skipped on a re-render of the same
// instance — an early return inside AppInner would violate the Rules of
// Hooks the moment `useRoute` re-renders it in place on `hashchange`.
export default function App() {
  const route = useRoute();
  if (route.name === 'auth') return <Auth signup={route.signup} />;
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
