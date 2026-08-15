import { useMemo, useState, type CSSProperties } from 'react';
import { toLocalDateKey } from '@/components/ActivityCalendar';
import { CONFIG } from '@/config/constants';
import { allTopics, type Store } from '@/domain/types';
import {
  activityFeed,
  allCourseRefs,
  globalDueQueue,
  globalHealth,
  overallMastery,
  studyStreak,
  weeklyVolume,
} from '@/engine/overview';
import { weakTopics } from '@/engine/course';
import { retrievable, expTrend, workLogged } from '@/engine/progress';
import { retentionPct } from '@/engine/retention';
import { recommend, type Recommendation } from '@/engine/recommend';
import { RecommendationCard } from '@/components/RecommendationCard';
import { navigate } from '@/router';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme, retentionColor } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

/** Map every topic_id to its course_id, for row navigation. */
function courseIndex(store: Store): Map<string, string> {
  const m = new Map<string, string>();
  for (const { topic, course } of allTopics(store)) m.set(topic.topic_id, course.course_id);
  return m;
}

/** Daily study intensity (session + exam events) keyed by local date. */
function dailyCounts(store: Store): Map<string, number> {
  const m = new Map<string, number>();
  const bump = (iso: string) => {
    const k = toLocalDateKey(new Date(iso));
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) if (e.source === 'session') bump(e.date);
  }
  for (const ex of store.exams) bump(ex.date);
  return m;
}

/**
 * Overview — rebuilt to the approved Cairn design mockup, pixel-for-pixel:
 * hero course-health ring + rhythm card (streak calendar + weekly bars), a
 * six-stat grid, the next-best-action banner, and a due-for-review / weakest /
 * activity layout. Every number is derived live from the store; logic and the
 * engine are unchanged — this is presentation only.
 */
export function Overview({
  store,
  onStartSession,
  onStartRecommendation,
}: {
  store: Store;
  /** Starts the timed session flow for a due topic (the per-row "Review"
   *  shortcut). Optional so existing callers/tests that only read Overview
   *  are unaffected — the row falls back to a plain navigate. */
  onStartSession?: (courseId: string, topicId: string) => void;
  /** Handles starting a recommended action. */
  onStartRecommendation?: (rec: Recommendation) => void;
}) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const [now] = useState(() => new Date());

  const refs = useMemo(() => allCourseRefs(store), [store]);
  const cIndex = useMemo(() => courseIndex(store), [store]);
  const health = globalHealth(store, now);
  const mastery = overallMastery(store);
  const streak = studyStreak(store, now);
  const volume = weeklyVolume(store, now);
  const exp = retrievable(store, now);
  const work = workLogged(store);
  const due = useMemo(() => globalDueQueue(store, 6, now), [store, now]);
  const feed = useMemo(() => activityFeed(store, 4), [store]);
  const recommendations = useMemo(() => recommend(store, now), [store, now]);

  const weak = useMemo(() => {
    const titleOf = new Map(allTopics(store).map(({ topic, course }) => [topic.topic_id, course.title]));
    return weakTopics(refs, now)
      .slice(0, 3)
      .map((r) => ({
        topic: r.topic.title,
        course: titleOf.get(r.topic.topic_id) ?? '',
        retention: Math.round(retentionPct(r.topic, now) ?? 0),
        courseId: cIndex.get(r.topic.topic_id) ?? '',
      }));
  }, [refs, store, now, cIndex]);

  const counts = useMemo(() => dailyCounts(store), [store]);
  const trend = useMemo(() => expTrend(store, now), [store, now]);

  const hasCourses = store.courses.length > 0;
  const nothingYet = mastery.total === 0;

  // ── Empty state ──────────────────────────────────────────────────
  if (!hasCourses || nothingYet) {
    return (
      <div style={contentStyle()}>
        <EmptyOverview theme={theme} isDark={isDark} />
      </div>
    );
  }

  const score = health ?? 0;
  const circ = 2 * Math.PI * 90;
  const offset = circ * (1 - score / 100);

  // A genuinely time-varying signal: the direction of average recall (the
  // retrievable ratio, reconstructed per day) over the last week. It rises when
  // you review and eases off as topics decay. Only shown when there's a real
  // basis at BOTH ends — a course younger than a week has nothing to compare,
  // so it stays hidden rather than always reading "on the rise".
  const ringBadge = (() => {
    const recent = trend[trend.length - 1];
    const prior = trend[Math.max(0, trend.length - 1 - 7)];
    if (!recent || !prior || recent.ceiling === 0 || prior.ceiling === 0) return null;
    const d = Math.round((recent.ratio - prior.ratio) * 100);
    if (d >= 2) return { text: 'on the rise ↑', title: `Average recall is up ${d} points this week` };
    if (d <= -2) return { text: 'easing off ↓', title: `Average recall is down ${Math.abs(d)} points this week` };
    return null; // roughly flat — holding steady, no badge
  })();

  // streak calendar — the current calendar month, laid out like a wall calendar
  // (Sun–Sat columns, blanks before the 1st) so days sit under their real
  // weekday and read in order.
  const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthCells: Array<{ day: number | null; v: number; isToday: boolean }> = (() => {
    const y = now.getFullYear();
    const mo = now.getMonth();
    const lead = new Date(y, mo, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    const todayNum = now.getDate();
    const cells: Array<{ day: number | null; v: number; isToday: boolean }> = [];
    for (let i = 0; i < lead; i++) cells.push({ day: null, v: 0, isToday: false });
    for (let dnum = 1; dnum <= daysInMonth; dnum++) {
      const c = counts.get(toLocalDateKey(new Date(y, mo, dnum))) ?? 0;
      cells.push({ day: dnum, v: c === 0 ? 0 : Math.min(3, c), isToday: dnum === todayNum });
    }
    return cells;
  })();

  // weekly bars — last 7 days
  const weekCells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return {
      value: counts.get(toLocalDateKey(d)) ?? 0,
      label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]!,
    };
  });
  const maxWeek = Math.max(1, ...weekCells.map((c) => c.value));

  const stats: Array<{
    label: string;
    value: string;
    unit?: string;
    sub: string;
    subTone?: string;
    bar?: number | null;
  }> = [
    {
      label: 'Retrievable now',
      value: exp.exp.toFixed(1),
      unit: `/ ${exp.ceiling} topics`,
      sub: exp.ceiling === 0 ? 'Log a session to start' : 'Expected recall right now',
      bar: exp.ceiling > 0 ? (exp.exp / exp.ceiling) * 100 : null,
    },
    {
      label: 'Study streak',
      value: String(streak),
      sub: streak === 1 ? 'consecutive day' : 'consecutive days',
      subTone: streak > 0 ? theme.orange : undefined,
    },
    {
      label: 'This week',
      value: String(volume.sessions),
      sub: `sessions · ~${volume.hours} hrs`,
    },
    {
      label: 'Mastery',
      value: `${mastery.pct}%`,
      sub: `${mastery.mastered}/${mastery.total} mastered`,
      bar: mastery.pct,
    },
    {
      label: 'Work logged',
      value: String(work.sessions),
      sub: `sessions · ${work.papers} ${work.papers === 1 ? 'paper' : 'papers'}`,
    },
    {
      label: 'Topics due',
      value: String(due.length),
      sub: due.length === 0 ? 'nothing due — you’re clear' : 'below 70% recall',
      subTone: due.length > 0 ? theme.error : theme.pine,
    },
  ];

  return (
    <div style={contentStyle()}>
      {/* ── Hero row: health ring + rhythm card ─────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', marginBottom: '32px' }}>
        <div style={{ position: 'relative', width: '220px', height: '220px', flexShrink: 0, transform: 'rotate(-1deg)' }}>
          {ringBadge && (
            <span
              title={ringBadge.title}
              style={{
                position: 'absolute', top: '-10px', right: '-14px', background: theme.orange,
                color: '#1a1a1a', border: `2px solid ${theme.border}`, borderRadius: '9999px',
                padding: '5px 12px', fontSize: '11px', fontWeight: 700, transform: 'rotate(7deg)',
                boxShadow: `3px 3px 0 ${theme.shadow}`, zIndex: 2,
              }}
            >
              {ringBadge.text}
            </span>
          )}
          <svg
            width="220" height="220" viewBox="0 0 220 220"
            style={{
              transform: 'rotate(-90deg)', position: 'relative', zIndex: 1,
              filter: `drop-shadow(0 3px 8px ${isDark ? 'rgba(61,219,192,0.18)' : 'rgba(3,79,70,0.16)'})`,
            }}
          >
            <circle cx="110" cy="110" r="90" fill="none" stroke={theme.border} strokeWidth="14" opacity="0.25" />
            <circle
              cx="110" cy="110" r="90" fill="none" stroke={theme.pine} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset} data-ring
              style={{ ['--ring-circ' as string]: String(circ), ['--ring-offset' as string]: String(offset) }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontFamily: SERIF, fontSize: '64px', lineHeight: 1, color: theme.ink, letterSpacing: '-1px' }}>
              {health === null ? '—' : score}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: theme.muted }}>Course health</span>
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: theme.muted, marginTop: '3px' }}>
              Across all active topics
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '32px', background: theme.surface,
            border: `2px solid ${theme.border}`, borderRadius: '14px 34px 14px 34px', padding: '26px 28px',
            transform: 'rotate(-0.3deg)', boxShadow: `6px 7px 0 ${theme.shadow}`, position: 'relative',
            flex: 2, minWidth: '460px',
          }}
        >
          <span
            style={{
              position: 'absolute', top: '-12px', left: '26px', background: theme.pine, color: theme.onAccent,
              border: `2px solid ${theme.border}`, borderRadius: '9999px', padding: '5px 14px', fontSize: '11px',
              fontWeight: 700, transform: 'rotate(-4deg)', boxShadow: `3px 3px 0 ${theme.shadow}`,
            }}
          >
            your rhythm
          </span>
          <div style={{ flexShrink: 0 }}>
            <h2 style={panelTitle(theme)}>
              Streak calendar{' '}
              <span style={{ fontSize: '13px', fontWeight: 600, color: theme.muted, fontFamily: SANS }}>
                — {streak} {streak === 1 ? 'day' : 'days'} running
              </span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 26px)', gap: '5px' }}>
              {WEEKDAY_LABELS.map((w, i) => (
                <div key={`h${i}`} style={{ width: '26px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: theme.muted, fontFamily: SANS }}>
                  {w}
                </div>
              ))}
              {monthCells.map((c, i) =>
                c.day === null ? (
                  <div key={i} aria-hidden />
                ) : (
                  <div
                    key={i}
                    data-cell
                    title={`Day ${c.day}`}
                    style={{
                      width: '26px', height: '26px', borderRadius: '6px', boxSizing: 'border-box',
                      background: intensity(c.v, theme),
                      border: c.isToday ? `2px solid ${theme.pine}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                      fontWeight: c.isToday ? 700 : 600, color: c.v >= 2 ? theme.onAccent : theme.muted, fontFamily: SANS,
                    }}
                  >
                    {c.day}
                  </div>
                ),
              )}
            </div>
          </div>
          <div style={{ width: '2px', alignSelf: 'stretch', background: theme.border, opacity: 0.3, minHeight: '90px' }} />
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h2 style={panelTitle(theme)}>This week</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              {weekCells.map((c, i) => (
                <div key={i} style={{ flex: 1 }}>
                  <div style={{ width: '100%', height: '90px', display: 'flex', alignItems: 'flex-end', background: theme.surfaceAlt, borderRadius: '6px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '100%', height: `${(c.value / maxWeek) * 100}%`,
                        background: i === weekCells.length - 1 ? theme.orange : theme.pine,
                        borderRadius: '6px 6px 0 0',
                      }}
                    />
                  </div>
                  <span style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: theme.muted, marginTop: '6px' }}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat grid ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {stats.map((s, i) => (
          <div key={s.label} style={statCard(theme, i)}>
            <span style={statLabel(theme)}>{s.label}</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: SERIF, fontSize: '32px', lineHeight: 1.05, color: theme.ink, letterSpacing: '-0.5px' }}>
                {s.value}
              </span>
              {s.unit && <span style={{ fontSize: '12px', fontWeight: 600, color: theme.muted }}>{s.unit}</span>}
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: s.subTone ?? theme.muted, lineHeight: 1.35 }}>
              {s.sub}
            </span>
            {typeof s.bar === 'number' && (
              <div style={{ position: 'relative', height: '6px', borderRadius: '9999px', background: theme.surfaceAlt, marginTop: '10px' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, s.bar)}%`, borderRadius: '9999px', background: theme.pine }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Recommendation Dashboard ─────────────────────────────── */}
      {recommendations.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          {/* Primary Recommendation */}
          <RecommendationCard
            recommendation={recommendations[0]!}
            store={store}
            isPrimary={true}
            onAction={(rec) => {
              if (onStartRecommendation) onStartRecommendation(rec);
              else {
                if (rec.action === 'assess') {
                  navigate('/exams');
                  return;
                }
                let targetTopicId = rec.target.kind === 'topic' ? rec.target.id : undefined;
                if (rec.target.kind === 'pattern') {
                  const pat = store.error_patterns.find((p) => p.pattern_id === rec.target.id);
                  if (pat && pat.topic_ids.length > 0) targetTopicId = pat.topic_ids[0];
                }
                if (targetTopicId) {
                  const courseId = cIndex.get(targetTopicId) ?? '';
                  if (onStartSession && courseId) onStartSession(courseId, targetTopicId);
                  else if (courseId) navigate(`/course/${courseId}`);
                }
              }
            }}
          />

          {/* Secondary Recommendations */}
          {recommendations.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Next Recommendations
              </h4>
              {recommendations.slice(1, 4).map((rec) => (
                <RecommendationCard
                  key={`${rec.target.kind}:${rec.target.id}`}
                  recommendation={rec}
                  store={store}
                  isPrimary={false}
                  onAction={(r) => {
                    if (onStartRecommendation) onStartRecommendation(r);
                    else {
                      if (r.action === 'assess') {
                        navigate('/exams');
                        return;
                      }
                      let targetTopicId = r.target.kind === 'topic' ? r.target.id : undefined;
                      if (r.target.kind === 'pattern') {
                        const pat = store.error_patterns.find((p) => p.pattern_id === r.target.id);
                        if (pat && pat.topic_ids.length > 0) targetTopicId = pat.topic_ids[0];
                      }
                      if (targetTopicId) {
                        const courseId = cIndex.get(targetTopicId) ?? '';
                        if (onStartSession && courseId) onStartSession(courseId, targetTopicId);
                        else if (courseId) navigate(`/course/${courseId}`);
                      }
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Two-column: due for review | weakest + activity ─────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
        <div style={panelStyle(theme, false)}>
          <div style={panelHeader()}>
            <h2 style={panelTitleFlush(theme)}>Due for review</h2>
            <span style={dueCountBadge(theme)}>{due.length} topics due</span>
          </div>
          <p style={{ fontSize: '12px', color: theme.muted, margin: '-6px 0 8px' }}>
            Below {Math.round(CONFIG.DUE_THRESHOLD * 100)}% — most-decayed first.
          </p>
          {due.map(({ topic, courseTitle }) => {
            const ret = Math.round(retentionPct(topic, now) ?? 0);
            const col = retentionColor(ret, theme);
            return (
              <div
                key={topic.topic_id}
                data-row
                onClick={() => navigate(`/course/${cIndex.get(topic.topic_id) ?? ''}`)}
                style={dueRow(theme)}
              >
                <span style={{ width: '9px', height: '9px', borderRadius: '9999px', background: col, flexShrink: 0, marginTop: '5px' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={dueTopic(theme)}>{topic.title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.muted }}>{courseTitle}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, minWidth: '44px' }}>
                  <span style={{ fontFamily: SERIF, fontSize: '17px', lineHeight: 1, color: col }}>{ret}%</span>
                  <span style={{ fontSize: '9.5px', color: theme.muted, letterSpacing: '0.02em' }}>retention</span>
                </div>
                <div style={track(theme, 56)}>
                  <div style={{ width: `${ret}%`, height: '100%', borderRadius: '9999px', background: col }} />
                </div>
                <button
                  type="button"
                  data-press
                  onClick={(e) => {
                    e.stopPropagation();
                    const courseId = cIndex.get(topic.topic_id) ?? '';
                    if (onStartSession && courseId) onStartSession(courseId, topic.topic_id);
                    else navigate(`/course/${courseId}`);
                  }}
                  style={{ background: theme.lavender, border: `2px solid ${theme.border}`, borderRadius: '9999px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', flexShrink: 0 }}
                >
                  Review
                </button>
              </div>
            );
          })}
          {due.length === 0 && (
            <p style={{ fontSize: '13px', color: theme.muted, padding: '4px 0' }}>
              Nothing below {Math.round(CONFIG.DUE_THRESHOLD * 100)}% retention. You’re on top of it.
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '280px' }}>
          <div style={panelStyle(theme, true)}>
            <div style={panelHeader()}>
              <h2 style={panelTitleFlush(theme)}>Weakest topics</h2>
              <span style={weakCountBadge(theme)}>needs work</span>
            </div>
            {weak.map((w, i) => (
              <div key={i} data-row onClick={() => navigate(`/course/${w.courseId}`)} style={dueRow(theme)}>
                <span style={{ width: '9px', height: '9px', borderRadius: '9999px', background: retentionColor(w.retention, theme), flexShrink: 0, marginTop: '5px' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={dueTopic(theme)}>{w.topic}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.muted }}>{w.course}</p>
                </div>
                <div style={track(theme, 56)}>
                  <div style={{ width: `${w.retention}%`, height: '100%', borderRadius: '9999px', background: retentionColor(w.retention, theme) }} />
                </div>
              </div>
            ))}
            {weak.length === 0 && <p style={{ fontSize: '13px', color: theme.muted, padding: '4px 0' }}>No weak spots — nicely done.</p>}
          </div>

          <div style={panelStyle(theme, false)}>
            <h2 style={panelTitle(theme)}>Recent activity</h2>
            {feed.map((a) => (
              <div key={`${a.kind}-${a.id}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 10px', margin: '0 -10px', borderRadius: '10px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '9999px', background: theme.orange, marginTop: '6px', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', color: theme.ink, lineHeight: 1.4 }}>
                    {a.title} <span style={{ color: theme.muted }}>· {a.detail}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: theme.muted }}>{relDate(a.date, now)}</p>
                </div>
              </div>
            ))}
            {feed.length === 0 && <p style={{ fontSize: '13px', color: theme.muted, padding: '4px 0' }}>Nothing logged yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── shared style builders (ported from the mockup) ───────────────── */
function contentStyle(): CSSProperties {
  return { flex: 1, width: '100%', maxWidth: '1440px', boxSizing: 'border-box', padding: '36px 40px 56px', position: 'relative' };
}
function panelTitle(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '20px', color: t.ink, margin: '0 0 16px' };
}
function panelTitleFlush(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '20px', color: t.ink, margin: 0 };
}
function panelHeader(): CSSProperties {
  return { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' };
}
function panelStyle(t: ReturnType<typeof getCairnTheme>, alt: boolean): CSSProperties {
  return {
    background: t.surface, border: `2px solid ${t.border}`,
    borderRadius: alt ? '10px 28px 10px 28px' : '28px 10px 28px 10px', padding: '24px',
    flex: alt ? undefined : 1, minWidth: alt ? undefined : '300px', boxSizing: 'border-box',
    marginBottom: '24px', transform: `rotate(${alt ? '0.5deg' : '-0.4deg'})`, boxShadow: `6px 7px 0 ${t.shadow}`,
  };
}
function statCard(t: ReturnType<typeof getCairnTheme>, i: number): CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', gap: '5px', background: t.surface, border: `2px solid ${t.border}`,
    borderRadius: i % 2 === 0 ? '18px 6px 18px 6px' : '6px 18px 6px 18px', padding: '16px 18px 18px',
    boxShadow: `4px 5px 0 ${t.shadow}`, transform: `rotate(${i % 3 === 0 ? '-0.5deg' : i % 3 === 1 ? '0.4deg' : '-0.2deg'})`,
    boxSizing: 'border-box',
  };
}
function statLabel(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.muted };
}
function dueRow(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 10px', margin: '0 -10px', borderRadius: '10px', borderBottom: `1px solid ${t.border}`, cursor: 'pointer' };
}
function dueTopic(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { margin: 0, fontSize: '14px', fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
}
function track(t: ReturnType<typeof getCairnTheme>, w: number): CSSProperties {
  return { width: `${w}px`, height: '6px', borderRadius: '9999px', background: t.surfaceAlt, overflow: 'hidden', flexShrink: 0 };
}
function dueCountBadge(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#1a1a1a', background: t.orange, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '3px 10px', transform: 'rotate(-2deg)', boxShadow: `2px 2px 0 ${t.shadow}` };
}
function weakCountBadge(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { flexShrink: 0, fontSize: '11px', fontWeight: 700, color: t.error, border: `2px solid ${t.error}`, borderRadius: '9999px', padding: '3px 10px', transform: 'rotate(2deg)' };
}
function intensity(v: number, t: ReturnType<typeof getCairnTheme>): string {
  if (v === 0) return t.surfaceAlt;
  const alpha = 0.3 + v * 0.23;
  const hex = t.pine.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16),
    g = parseInt(hex.substr(2, 2), 16),
    b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function relDate(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ── Empty state with the wobbling mascot ─────────────────────────── */
function EmptyOverview({ theme, isDark }: { theme: ReturnType<typeof getCairnTheme>; isDark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 20px', maxWidth: '420px', margin: '0 auto' }}>
      <svg
        width="140" height="170" viewBox="0 0 100 120"
        style={{ display: 'block', margin: '0 0 20px', animation: 'cairn-wobble 2.4s ease-in-out infinite', transformOrigin: '50% 100%' }}
      >
        <ellipse cx="50" cy="112" rx="30" ry="4" fill="#000000" opacity={isDark ? 0.28 : 0.18} />
        <rect x="18" y="90" width="64" height="22" rx="11" fill={theme.pine} transform="rotate(-3 50 101)" />
        <rect x="26" y="66" width="48" height="20" rx="10" fill={theme.lavender} transform="rotate(3 50 76)" />
        <circle cx="50" cy="42" r="20" fill={theme.orange} />
        <path d="M43 38 Q 44.5 35, 46 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        <path d="M54 38 Q 55.5 35, 57 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 45 Q 50 51, 58 45" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '32px', color: theme.ink, margin: '0 0 8px' }}>No stacks yet.</h2>
      <p style={{ fontSize: '15px', color: theme.muted, margin: '0 0 24px' }}>
        Add your first course and we’ll start tracking what sticks.
      </p>
      <button
        type="button"
        data-press
        onClick={() => navigate('/study/add')}
        style={{ background: theme.lavender, border: `2px solid ${theme.border}`, borderRadius: '9999px', padding: '14px 24px', fontSize: '15px', fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', boxShadow: `4px 4px 0 ${theme.shadow}` }}
      >
        ＋ Add your first course
      </button>
    </div>
  );
}
