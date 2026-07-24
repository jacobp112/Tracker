import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/feedback';
import { HeroRing } from '@/components/HeroRing';
import { Button, Card, Eyebrow, Hint } from '@/components/primitives';
import { Prop, PropsRow } from '@/components/PropsRow';
import { RetentionRow } from '@/components/RetentionRow';
import { Sparkline, type SparkPoint } from '@/components/Sparkline';
import { CONFIG } from '@/config/constants';
import type { Store } from '@/domain/types';
import {
  activityFeed,
  globalDueQueue,
  globalHealth,
  overallMastery,
  studyStreak,
  weeklyVolume,
  type FeedKind,
} from '@/engine/overview';
import { STAGE_LABEL, upcomingActions } from '@/engine/jobs';
import { retrievable, expTrend, workLogged } from '@/engine/progress';
import { retentionPct } from '@/engine/retention';
import { currentStage } from '@/domain/types';
import { navigate } from '@/router';
import { ExamsIcon, FitnessIcon, JobsIcon, OverviewIcon, StudyIcon } from '@/shell/icons';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

interface NextAction {
  label: string;
  onClick: () => void;
}

/**
 * The one thing to do next — Overview's whole reason for existing (§5.1).
 *
 * This screen answers "what now?", so the answer is a control in the header,
 * not a conclusion the user assembles by scrolling to the bottom of the page.
 * The slot always resolves to exactly one action; there is no state in which
 * Overview has nothing to suggest.
 *
 * Note the first branch: a session has to attach to a course, so a tracker with
 * no courses cannot offer "log a session" — the first action there is
 * necessarily to add the course.
 */
function nextAction(
  store: Store,
  due: ReturnType<typeof globalDueQueue>,
  hasLogged: boolean,
  now: Date,
): NextAction {
  if (store.courses.length === 0) {
    return { label: 'Add your first course', onClick: () => navigate('/study/add') };
  }

  // The most-decayed topic is the highest-value thing the app knows. Naming it
  // (and its number) makes the button an answer rather than a menu.
  const top = due[0];
  if (top) {
    return {
      label: `Review ${top.topic.title} — ${retentionPct(top.topic, now)}%`,
      onClick: () => navigate(`/course/${courseIdOf(store, top.topic.topic_id)}`),
    };
  }

  const first = store.courses[0]!;
  return {
    label: hasLogged ? 'Log a session' : 'Log your first session',
    onClick: () => navigate(`/course/${first.course_id}`),
  };
}

const FEED_ICON: Record<FeedKind, () => JSX.Element> = {
  session: StudyIcon,
  exam: ExamsIcon,
  run: FitnessIcon,
  lift: FitnessIcon,
  job: JobsIcon,
};

/** "in 3 days" / "today" / "2 days overdue" — deadlines are relative things. */
function relDeadline(dateKey: string, now: Date): { label: string; overdue: boolean } {
  const target = new Date(`${dateKey}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return { label: 'today', overdue: false };
  if (days === 1) return { label: 'tomorrow', overdue: false };
  if (days > 1) return { label: `in ${days} days`, overdue: false };
  return { label: days === -1 ? '1 day overdue' : `${-days} days overdue`, overdue: true };
}

function relDate(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Overview — Document 3 v0.4 §5.1, Document 4 E7-S1. The only cross-domain
 * screen; answers "what should I do today?" at a glance. Everything derived
 * live.
 *
 * Hierarchy (tightened in Document 3 v0.4 §0.0 item 2): the course-health ring
 * is *the* hero stat and takes the bloom + `--shadow-hero` treatment. "Due for
 * review" is the densest block but a plain Card — exactly one hero per screen
 * (§3).
 */
export function Overview({ store }: { store: Store }) {
  const [now] = useState(() => new Date());

  const due = useMemo(() => globalDueQueue(store, 5, now), [store, now]);
  const feed = useMemo(() => activityFeed(store, 15), [store]);
  const actions = useMemo(() => upcomingActions(store).slice(0, 5), [store]);
  const health = globalHealth(store, now);
  const mastery = overallMastery(store);
  const streak = studyStreak(store, now);
  const volume = weeklyVolume(store, now);
  const exp = retrievable(store, now);
  const work = workLogged(store);
  const trend = useMemo<SparkPoint[]>(
    () => expTrend(store, now).map((p) => ({ value: Math.round(p.ratio * 100), date: p.date })),
    [store, now],
  );

  const nothingYet = mastery.total === 0 && store.runs.length === 0 && store.lifts.length === 0;
  const action = nextAction(store, due, feed.length > 0, now);

  if (nothingYet) {
    return (
      <div className="content">
        {/* The action sits in the header here too, so its position is learned
          * once and never moves as the tracker fills up. */}
        <div className="page-head split">
          <div>
            <h1>{greeting(now)}</h1>
            <p>Nothing tracked yet.</p>
          </div>
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
        <div className="section">
          <Card>
            {/* No button: the header above already owns the one action, and
              * offering it twice on one screen makes neither read as primary. */}
            <EmptyState
              icon={<OverviewIcon />}
              title="Nothing to review yet. Add a course to start tracking retention."
            />
          </Card>
        </div>
      </div>
    );
  }

  const duePct = Math.round(CONFIG.DUE_THRESHOLD * 100);

  return (
    <div className="content">
      <div className="page-head split reveal" style={{ ['--i' as string]: 0 }}>
        <div>
          <h1>{greeting(now)}</h1>
          <p>Here's what needs your attention.</p>
        </div>
        <Button className="page-action" onClick={action.onClick}>
          {action.label}
        </Button>
      </div>

      <div className="hero-row">
        {/* The hero: the single most prominent number on the screen (§5.1). */}
        {health === null ? (
          /* An em-dash is not an answer. When there's no health to show, the
           * hero says why there isn't and offers the action that would produce
           * one — the most prominent card on the screen shouldn't be the least
           * useful. */
          <Card className="hero-stat hero-ring reveal" style={{ ['--i' as string]: 1 }}>
            <Eyebrow>Course health</Eyebrow>
            <div className="hero-ring-body hero-ring-empty">
              <p className="hero-empty-copy">
                Health is measured across the topics you're actively learning. You don't have one in
                progress yet.
              </p>
              <Button onClick={action.onClick}>{action.label}</Button>
            </div>
          </Card>
        ) : (
          <HeroRing
            className="reveal"
            style={{ ['--i' as string]: 1 }}
            eyebrow="Course health"
            hint="A 0-100 score for every topic you're actively learning: current retention, confidence calibration, unresolved mistakes and flashcard coverage, combined."
            value={health}
            caption="Across all active topics"
          />
        )}

        {/* Dense, but deliberately not the loudest surface (§5.1). */}
        <Card className="due-card reveal" style={{ ['--i' as string]: 2 }}>
          <div className="due-head">
            <div className="eyebrow-row">
              <Eyebrow>Due for review</Eyebrow>
              <Hint
                text={`Topics whose predicted retention has fallen below ${duePct}%. Reviewing these now gives the biggest payoff.`}
                label="About due for review"
              />
            </div>
            {due.length > 0 && (
              <span className="due-count mono-num">
                {due.length}
                <span className="sr-only"> topics due</span>
              </span>
            )}
          </div>
          {due.length === 0 ? (
            /* Borderless status line, not a boxed empty state — the good news
             * shouldn't wear more chrome than the bad. */
            <div className="due-clear">
              <span className="dot ok" aria-hidden="true" />
              <p>Nothing below {duePct}% retention. You're on top of it.</p>
            </div>
          ) : (
            <>
              {/* Compressed: the count is already the big number above. */}
              <p className="due-sub">Below {duePct}% — most-decayed first.</p>
              <div className="due-list">
                {due.map(({ topic, courseTitle }) => (
                  <RetentionRow
                    key={topic.topic_id}
                    title={topic.title}
                    retention={retentionPct(topic, now)}
                    badges={[{ label: courseTitle, tone: 'neutral' }]}
                    onSelect={() => navigate(`/course/${courseIdOf(store, topic.topic_id)}`)}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {exp.ceiling > 0 && (
        <div className="section reveal" style={{ ['--i' as string]: 3 }}>
          <Card>
            <div className="eyebrow-row">
              <Eyebrow>Retrievable now</Eyebrow>
              <Hint
                label="About retrievable now"
                text="How much you could recall across every started topic right now — the sum of each topic's current retention. It falls when you don't study and recovers when you review; that's the point."
              />
            </div>
            <div className="hero-number mono-num">
              {exp.exp.toFixed(1)} <span className="hero-sub">/ {exp.ceiling} topics</span>
            </div>
            <Sparkline
              data={trend}
              label="Retrievable knowledge"
              idPrefix="exp-trend"
            />
          </Card>
        </div>
      )}

      <PropsRow className="reveal" style={{ ['--i' as string]: 4 }}>
        <Prop
          label="Study streak"
          value={streak}
          caption={streak === 1 ? 'consecutive day' : 'consecutive days'}
        />
        <Prop
          label="This week"
          value={volume.sessions}
          caption={`${volume.sessions === 1 ? 'session' : 'sessions'} · ~${volume.hours} hrs`}
        />
        <Prop
          label="Mastery"
          value={`${mastery.pct}%`}
          caption={`${mastery.mastered}/${mastery.total} topics mastered`}
        />
        <Prop
          label="Work logged"
          value={work.sessions}
          caption={`${work.sessions === 1 ? 'session' : 'sessions'} · ${work.papers} ${work.papers === 1 ? 'paper' : 'papers'}`}
          hint="Everything you've put in — total study sessions and exam papers. Unlike retrievable-now, this only ever goes up."
        />
      </PropsRow>

      {actions.length > 0 && (
        <div className="section reveal" style={{ ['--i' as string]: 5 }}>
          <div className="section-title">Coming up</div>
          <div className="section-sub">Job deadlines and interviews, soonest first.</div>
          <Card className="list-card">
            {actions.map((app) => {
              const when = relDeadline(app.next_action_date!, now);
              return (
                <div className="row" key={app.application_id}>
                  <div className="row-left">
                    <span className="feed-icon">
                      <JobsIcon />
                    </span>
                    <button type="button" className="topic topic-btn" onClick={() => navigate('/jobs')}>
                      {app.company} — {app.role}
                    </button>
                    <span className="feed-detail">{STAGE_LABEL[currentStage(app)]}</span>
                  </div>
                  <div className="row-right">
                    <span className={`feed-date ${when.overdue ? 'deadline-overdue' : ''}`}>
                      {when.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <div className="section reveal" style={{ ['--i' as string]: 6 }}>
        <div className="section-title">Recent activity</div>
        <div className="section-sub">Everything you've logged, newest first.</div>
        <Card className="list-card">
          {feed.length === 0 ? (
            <EmptyState
              icon={<OverviewIcon />}
              title="Nothing logged yet. Log a session to start the feed."
              action={<Button onClick={() => navigate('/study')}>Open your course</Button>}
            />
          ) : (
            feed.map((item) => {
              const Icon = FEED_ICON[item.kind];
              return (
                <div className="row feed-row" key={`${item.kind}-${item.id}`}>
                  <div className="row-left">
                    <span className="feed-icon">
                      <Icon />
                    </span>
                    <span className="topic">{item.title}</span>
                    <span className="feed-detail">{item.detail}</span>
                  </div>
                  <div className="row-right">
                    <span className="feed-date">{relDate(item.date, now)}</span>
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}

function courseIdOf(store: Store, topicId: string): string {
  for (const c of store.courses) {
    for (const s of c.sections) {
      if (s.topics.some((t) => t.topic_id === topicId)) return c.course_id;
    }
  }
  return '';
}
