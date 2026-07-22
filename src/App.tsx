import { useCallback, useState } from 'react';
import { Button, Card } from '@/components/primitives';
import { CommandPalette } from '@/components/CommandPalette';
import { EmptyState, ToastProvider, useToast } from '@/components/feedback';
import { useCommandShortcut } from '@/hooks/useCommandShortcut';
import { useStore } from '@/hooks/useStore';
import { useTheme } from '@/theme/useTheme';
import { navigate, useRoute } from '@/router';
import type { PaletteAction } from '@/engine/palette';
import { AppShell, type CourseSummary } from '@/shell/AppShell';
import { AddIcon } from '@/shell/icons';
import { AddCourse } from '@/routes/AddCourse';
import { AddExam } from '@/routes/AddExam';
import { AddFitness } from '@/routes/AddFitness';
import { AddJob } from '@/routes/AddJob';
import { Jobs } from '@/routes/Jobs';
import { ComponentShowcase } from '@/routes/ComponentShowcase';
import { CourseDashboard } from '@/routes/CourseDashboard';
import { Exams } from '@/routes/Exams';
import { Fitness } from '@/routes/Fitness';
import { LogSession } from '@/routes/LogSession';
import { Overview } from '@/routes/Overview';
import { QuickAdd } from '@/routes/QuickAdd';
import { Settings } from '@/routes/Settings';
import { TokenSheet } from '@/routes/TokenSheet';
import { TopicDetail } from '@/routes/TopicDetail';
import { courseTopics } from '@/engine/course';
import type { Course, Store } from '@/domain/types';

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
}: {
  course: Course;
  store: Store;
  commitValue: ReturnType<typeof useStore>['commitValue'];
  undoLast: ReturnType<typeof useStore>['undoLast'];
  toggleError: ReturnType<typeof useStore>['toggleError'];
  promoteTopic: ReturnType<typeof useStore>['promoteTopic'];
  logManualReview: ReturnType<typeof useStore>['logManualReview'];
}) {
  const [logging, setLogging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      />
      <LogSession
        course={course}
        store={store}
        open={logging}
        onClose={() => setLogging(false)}
        commitValue={commitValue}
        undoLast={undoLast}
      />
      <TopicDetail
        topic={selected?.topic ?? null}
        sectionTitle={selected?.section.title ?? ''}
        onClose={() => setSelectedId(null)}
        onResolveError={(topicId, errorId) => {
          const error = toggleError(topicId, errorId);
          if (error) toast(error, 'error');
        }}
        onPromote={(topicId, status) => {
          const error = promoteTopic(topicId, status);
          if (error) toast(error, 'error');
        }}
        onQuickReview={(topicId, confidence) => {
          const error = logManualReview(topicId, confidence);
          toast(error ?? `Review logged — confidence ${confidence}/5`, error ? 'error' : 'success');
        }}
      />
    </>
  );
}

function StudyIndex({ store }: { store: Store }) {
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
      <div className="page-head reveal" style={{ ['--i' as string]: 0 }}>
        <h1>Study</h1>
        <p>Your courses.</p>
      </div>
      <div className="section reveal" style={{ ['--i' as string]: 1 }}>
        <Card className="list-card">
          {store.courses.map((c) => {
            const topics = c.sections.flatMap((s) => s.topics);
            return (
              <div className="row" key={c.course_id}>
                <div className="row-left">
                  <button className="topic topic-btn" onClick={() => navigate(`/course/${c.course_id}`)}>
                    {c.title}
                  </button>
                </div>
                <div className="row-right">
                  <span className="row-count">
                    <span className="mono-num">{topics.length}</span>{' '}
                    {topics.length === 1 ? 'topic' : 'topics'}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function AppInner() {
  const route = useRoute();
  const {
    store,
    commitValue,
    undoLast,
    toggleError,
    promoteTopic,
    logManualReview,
    moveStage,
    editApplication,
    archiveApplication,
    replaceStore,
    clearStore,
    loadError,
  } = useStore();
  const { toggle: toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  useCommandShortcut(() => setSearchOpen((o) => !o));

  const runPaletteAction = useCallback(
    (action: PaletteAction) => {
      if (action === 'toggle-theme') toggleTheme();
    },
    [toggleTheme],
  );

  const courses = store.courses.map(summarise);
  // Only a course route has an active course. Falling back to courses[0] made
  // the sidebar present an arbitrary course — and its mastery % — as the
  // current context on Overview, Fitness, Exams and Settings.
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
        return <AddCourse store={store} commitValue={commitValue} undoLast={undoLast} />;
      case 'overview':
        return <Overview store={store} />;
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
          />
        );
      }
      case 'fitness':
        return <Fitness store={store} />;
      case 'add-run':
        return <AddFitness kind="running" store={store} commitValue={commitValue} undoLast={undoLast} />;
      case 'add-lift':
        return <AddFitness kind="lifting" store={store} commitValue={commitValue} undoLast={undoLast} />;
      case 'exams':
        return <Exams store={store} />;
      case 'add-exam':
        return <AddExam store={store} commitValue={commitValue} undoLast={undoLast} />;
      case 'jobs':
        return (
          <Jobs
            store={store}
            moveStage={moveStage}
            editApplication={editApplication}
            archiveApplication={archiveApplication}
          />
        );
      case 'add-job':
        return <AddJob store={store} commitValue={commitValue} undoLast={undoLast} />;
      case 'quick-add':
        return <QuickAdd store={store} commitValue={commitValue} undoLast={undoLast} />;
      case 'settings':
        return <Settings store={store} replaceStore={replaceStore} clearStore={clearStore} />;
    }
  })();

  return (
    <AppShell
      route={route}
      courses={courses}
      activeCourse={activeCourse}
      onOpenSearch={() => setSearchOpen(true)}
    >
      {screen}
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
export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
