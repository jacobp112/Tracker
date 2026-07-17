import { useMemo, useState } from 'react';
import { ActivityCalendar } from '@/components/ActivityCalendar';
import { ociLabel } from '@/components/controls';
import { HeroStat } from '@/components/HeroStat';
import { Card, Eyebrow } from '@/components/primitives';
import { Prop, PropsRow } from '@/components/PropsRow';
import { RetentionRow } from '@/components/RetentionRow';
import { Sparkline } from '@/components/Sparkline';
import { CONFIG } from '@/config/constants';
import type { Course, Topic } from '@/domain/types';
import {
  averageRetention,
  courseHealth,
  courseTopics,
  dueQueue,
  projectFinish,
  weakTopics,
  type TopicRef,
} from '@/engine/course';
import { activitySeries, retentionSeries } from '@/engine/history';
import { badges, health, overconfidenceIndex, shouldShowHealth, testEvents } from '@/engine/metrics';
import { projectedDue, retentionPct } from '@/engine/retention';
import { navigate } from '@/router';
import { CalendarIcon, ChevronRight, DueIcon, HealthIcon, ClockIcon } from '@/shell/icons';

const RETENTION_GOAL = 80;

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Health → the plain-language caption under the props value. */
function healthCaption(score: number): string {
  if (score > 70) return 'Optimal';
  if (score >= 40) return 'Needs attention';
  return 'At risk';
}

/**
 * Course dashboard — Document 3 v0.3 §5.2, Document 4 E4-S1…S4.
 * Every number here is derived live by the engine on each render; nothing is
 * read from storage (Document 1 v0.2 §2.3 / E3-S4).
 */
export function CourseDashboard({
  course,
  onLogSession,
  onSelectTopic,
}: {
  course: Course;
  onLogSession: () => void;
  onSelectTopic: (topic: Topic) => void;
}) {
  // `now` is fixed for the render so every number on screen agrees with the
  // others — deriving it per-call could straddle a midnight boundary.
  const [now] = useState(() => new Date());

  const refs = useMemo(() => courseTopics(course), [course]);
  const spark = useMemo(() => retentionSeries(course, 30, now), [course, now]);
  const activity = useMemo(() => activitySeries(course), [course]);

  const avgRet = averageRetention(refs, now);
  const chealth = courseHealth(refs, now);
  const due = refs.filter((r) => {
    const p = projectedDue(r.topic, now);
    return p?.overdue === true;
  }).length;

  const projection = projectFinish(refs, now);
  // Calibration is derived from exam results only (Document 2 §5). With no exam
  // logged there is no basis for it — that is "—", not "+0.00". A genuine
  // neutral calibration (exams logged, confidence matched scores) still shows
  // +0.00, which is the point of the empty-value rule: distinguish "measured
  // zero" from "nothing to measure".
  const calibrated = refs.filter((r) => testEvents(r.topic).length > 0);
  const meanOci =
    calibrated.length === 0
      ? null
      : calibrated.reduce((a, r) => a + overconfidenceIndex(r.topic), 0) / calibrated.length;

  // Ranked weak-first within each section (Document 2 §9 governs ordering,
  // Document 3 §5.2 groups by section).
  const ranked = useMemo(() => weakTopics(refs, now), [refs, now]);
  const rankOf = new Map(ranked.map((r, i) => [r.topic.topic_id, i]));

  const plan = useMemo(() => dueQueue(refs, 3, now), [refs, now]);

  const delta = useMemo(() => {
    if (spark.length < 2) return undefined;
    return Math.round(spark[spark.length - 1]!.value - spark[0]!.value);
  }, [spark]);

  return (
    <div className="content">
      <div className="breadcrumb reveal" style={{ ['--i' as string]: 0 }}>
        {/* "Study" to match the nav label — one word for one place. Clickable,
          * because a breadcrumb ancestor that doesn't navigate is a dead
          * affordance. */}
        <button type="button" className="crumb-link" onClick={() => navigate('/study')}>
          Study
        </button>
        <ChevronRight />
        <span className="current">{course.title}</span>
      </div>

      <div className="page-head reveal" style={{ ['--i' as string]: 1 }}>
        <h1>Course dashboard</h1>
        <p>Overview of your progress and retention in {course.title}.</p>
      </div>

      <div className="hero-row">
        <HeroStat
          className="reveal"
          style={{ ['--i' as string]: 2 }}
          eyebrow="Avg retention"
          value={avgRet === null ? null : Math.round(avgRet)}
          caption={avgRet === null ? 'No history yet' : 'Past 30 days'}
          delta={avgRet === null ? undefined : delta}
        >
          {avgRet === null ? (
            // A flat line pinned at 0% reads as a failed load, not as "no data".
            // Say it in words instead of drawing a curve that isn't there.
            <p className="hero-chart-empty">
              No retention history yet. Log a session to start the curve.
            </p>
          ) : (
            <Sparkline data={spark} goal={RETENTION_GOAL} />
          )}
        </HeroStat>

        <Card className="activity-card reveal" style={{ ['--i' as string]: 3 }}>
          <div className="activity-head">
            <Eyebrow>Study activity</Eyebrow>
            <div className="range">Last 90 days</div>
          </div>
          <ActivityCalendar days={activity} today={now} />
        </Card>
      </div>

      {/* Measured, live state — sits above the horizon and never scrubs
        * (Document 3 v0.4 §5.2 scope rule). */}
      <PropsRow className="reveal" style={{ ['--i' as string]: 4 }}>
        <Prop
          icon={<HealthIcon />}
          label="Health"
          value={chealth ?? '—'}
          caption={chealth === null ? 'No active topics yet' : healthCaption(chealth)}
        />
        <Prop
          icon={<ClockIcon />}
          label="Calibration"
          hint="How well your confidence matches your exam scores. Positive means overconfident, negative means underconfident."
          value={meanOci === null ? '—' : `${meanOci >= 0 ? '+' : ''}${meanOci.toFixed(2)}`}
          caption={meanOci === null ? 'Log an exam to calibrate' : ociLabel(meanOci)}
        />
        <Prop
          icon={<DueIcon />}
          label="Due review"
          accent
          after={due > 0 ? <span className="live-dot live-pulse" /> : undefined}
          value={due}
          caption={
            due === 0 ? (
              'Nothing due'
            ) : (
              <>
                Due today <span className="prop-sep">·</span>{' '}
                <button className="prop-action" onClick={onLogSession}>
                  Review now →
                </button>
              </>
            )
          }
        />
        <Prop
          icon={<CalendarIcon />}
          label="Projected finish"
          hint="When you're on track to master every topic, based on your recent pace. Always a range, never a single date."
          value={
            projection.state === 'range'
              ? `${fmtDate(projection.best)}–${fmtDate(projection.worst)}`
              : '—'
          }
          caption={
            projection.state === 'range' ? (
              `${projection.topicsPerWeek.toFixed(1)} topics/week`
            ) : /* Never a fabricated date (Document 2 §10). */
            projection.state === 'complete' ? (
              'Course complete'
            ) : (
              'Not enough data yet'
            )
          }
        />
      </PropsRow>

      <div className="section reveal" style={{ ['--i' as string]: 5 }}>
        <div className="section-title">Retention matrix</div>
        <div className="section-sub">
          Grouped by section. Bar and dot both encode retention — badges flag attention states only.
        </div>

        {course.sections.map((section) => {
          const rows: TopicRef[] = section.topics
            .map((topic) => ({ topic, section }))
            .sort((a, b) => {
              // Weak-first within the section (Document 2 §9). Topics excluded
              // from the ranking (Not Started / Mastered) sink to the bottom.
              const ra = rankOf.get(a.topic.topic_id) ?? Number.MAX_SAFE_INTEGER;
              const rb = rankOf.get(b.topic.topic_id) ?? Number.MAX_SAFE_INTEGER;
              return ra - rb;
            });

          return (
            <div key={section.section_id}>
              <div className="group-label">{section.title}</div>
              <Card className="list-card">
                {rows.map(({ topic }) => (
                  <RetentionRow
                    key={topic.topic_id}
                    title={topic.title}
                    retention={retentionPct(topic, now)}
                    badges={badges(topic).map((b) => ({ label: b.label, tone: b.tone }))}
                    onSelect={() => onSelectTopic(topic)}
                    onReview={onLogSession}
                  />
                ))}
              </Card>
            </div>
          );
        })}
      </div>

      <div className="section reveal" style={{ ['--i' as string]: 6 }}>
        <div className="section-title">Upcoming review plan</div>
        <div className="section-sub">
          Most-decayed first, interleaved across sections so you don't grind one topic.
        </div>
        <Card className="plan-card">
          {plan.length === 0 ? (
            <div className="plan-desc">
              Nothing is due below {Math.round(CONFIG.DUE_THRESHOLD * 100)}% retention. Log a session
              to keep it that way.
            </div>
          ) : (
            plan.map(({ topic, section }, i) => {
              const p = projectedDue(topic, now);
              return (
                <div className="plan-item" key={topic.topic_id}>
                  <div className={`marker ${i === 0 ? 'active live-pulse' : ''}`} />
                  <div className="plan-body">
                    <div>
                      <div className="plan-title">
                        {topic.title}
                        {i === 0 && <span className="plan-badge">Next</span>}
                      </div>
                      <div className="plan-desc">
                        {section.title}
                        {shouldShowHealth(topic) && ` · health ${health(topic, now)}`}
                      </div>
                    </div>
                    <div className="plan-date">
                      {p === null ? '—' : p.overdue ? 'Overdue' : fmtDate(p.date)}
                    </div>
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
