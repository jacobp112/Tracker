import { useMemo, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { toLocalDateKey } from '@/components/ActivityCalendar';
import type { Course, Topic } from '@/domain/types';
import {
  averageRetention,
  courseHealth,
  courseTopics,
  projectFinish,
  weakTopics,
  type TopicRef,
} from '@/engine/course';
import { activitySeries, retentionSeries } from '@/engine/history';
import { overconfidenceIndex, testEvents } from '@/engine/metrics';
import { projectedDue, retentionPct } from '@/engine/retention';
import { navigate } from '@/router';
import { useTheme } from '@/theme/useTheme';
import {
  buildMiniSparkPath,
  getCairnTheme,
  retentionColor,
  statusColor,
  statusLabel,
  type CairnTheme,
} from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function heatColor(level: number, isDark: boolean): string {
  const light = ['#f7f6e4', '#cfe8e0', '#8fc9ba', '#3d9a83', '#034f46'];
  const dark = ['#242419', '#254038', '#2d6a58', '#39a789', '#3ddbc0'];
  return (isDark ? dark : light)[level] ?? (isDark ? dark[0]! : light[0]!);
}

/**
 * Course dashboard — rebuilt to the approved Cairn mockup, pixel-for-pixel.
 * Rotated health-badge header, five-stat grid, the full activity heatmap
 * (day labels + month ruler + streak-stats column + legend), and the topic
 * matrix grid. Every value is derived live; logic/engine unchanged.
 */
export function CourseDashboard({
  course,
  onLogSession,
  onSelectTopic,
  onStartSession,
}: {
  course: Course;
  onLogSession: () => void;
  onSelectTopic: (topic: Topic) => void;
  /** Starts the timed session flow for a specific topic (the "Due today ·
   *  Review now" shortcut targets the most-overdue topic). Optional so
   *  existing callers/tests that only log sessions are unaffected. */
  onStartSession?: (topicId: string) => void;
}) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const [now] = useState(() => new Date());

  const refs = useMemo(() => courseTopics(course), [course]);
  const avgRet = averageRetention(refs, now);
  const chealth = courseHealth(refs, now);
  const dueRefs = refs.filter((r) => projectedDue(r.topic, now)?.overdue === true);
  const due = dueRefs.length;
  const projection = projectFinish(refs, now);

  const spark = useMemo(() => retentionSeries(course, 30, now), [course, now]);
  const retentionDelta =
    spark.length >= 2 ? Math.round(spark[spark.length - 1]!.value - spark[0]!.value) : 0;

  const calibrated = refs.filter((r) => testEvents(r.topic).length > 0);
  const meanOci =
    calibrated.length === 0
      ? null
      : Math.round(
          (calibrated.reduce((a, r) => a + overconfidenceIndex(r.topic), 0) / calibrated.length) * 100,
        ) / 100;

  const ranked = useMemo(() => weakTopics(refs, now), [refs, now]);
  const rankOf = new Map(ranked.map((r, i) => [r.topic.topic_id, i]));
  const weakTopicCount = ranked.length;
  // "Review now" targets the most-decayed overdue topic (weak-ranking order),
  // falling back to the first overdue topic if none are ranked as weak.
  const dueIds = new Set(dueRefs.map((r) => r.topic.topic_id));
  const nextDueTopicId = ranked.find((r) => dueIds.has(r.topic.topic_id))?.topic.topic_id ?? dueRefs[0]?.topic.topic_id;

  // ── Activity heatmap (last 91 days) ──────────────────────────────
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of activitySeries(course)) m.set(d.date, d.count);
    return m;
  }, [course]);
  const GRID = 91;
  const cellDate = (i: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (GRID - 1 - i));
    return d;
  };
  const grid = Array.from({ length: GRID }, (_, i) => {
    const d = cellDate(i);
    const c = counts.get(toLocalDateKey(d)) ?? 0;
    return { date: d, level: c === 0 ? 0 : Math.min(4, c) };
  });
  let curStreak = 0;
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i]!.level > 0) curStreak++;
    else break;
  }
  let longStreak = 0,
    run = 0;
  grid.forEach((g) => {
    if (g.level > 0) {
      run++;
      longStreak = Math.max(longStreak, run);
    } else run = 0;
  });
  const activeDays = grid.filter((g) => g.level > 0).length;

  const cols = Math.ceil(GRID / 7);
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let col = 0; col < cols; col++) {
    const d = cellDate(col * 7);
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      monthLabels.push({ col, label: d.toLocaleDateString(undefined, { month: 'short' }) });
    }
  }

  return (
    <div style={contentStyle()}>
      <button type="button" data-press onClick={() => navigate('/study')} style={backStyle(theme)}>
        ← Back to Study
      </button>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center', marginBottom: '28px', position: 'relative' }}>
        <div style={healthBadge(theme, isDark)}>
          <span style={{ fontFamily: SERIF, fontSize: '28px', lineHeight: 1 }}>{chealth ?? '—'}</span>
          <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Health</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
          <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '34px', color: theme.ink, margin: 0 }}>
            {course.title}
          </h1>
          {weakTopicCount > 0 && (
            <span style={subBadge(theme)}>
              {weakTopicCount} weak {weakTopicCount === 1 ? 'spot' : 'spots'}
            </span>
          )}
        </div>
        <button type="button" data-press onClick={onLogSession} style={logSessionBtn(theme)}>
          ＋ Log session
        </button>
      </div>

      {/* ── Stat grid ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard theme={theme} i={0} label="Avg retention" help="Mean predicted recall across every topic you have started. Not-started topics are excluded.">
          <BigVal theme={theme} empty={avgRet === null}>
            {avgRet === null ? '—' : `${Math.round(avgRet)}%`}
          </BigVal>
          {avgRet !== null && (
            <>
              <span style={deltaWrap(theme)}>
                Past 30 days{' '}
                <span style={{ fontWeight: 700, color: retentionDelta >= 0 ? theme.pine : theme.error }}>
                  {retentionDelta >= 0 ? '▲' : '▼'} {Math.abs(retentionDelta)}pts
                </span>
              </span>
              <div style={goalTrack(theme)}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, Math.round(avgRet))}%`, borderRadius: '9999px', background: retentionColor(Math.round(avgRet), theme) }} />
                <div style={{ position: 'absolute', top: '-3px', bottom: '-3px', left: '80%', width: '2px', background: theme.ink, borderRadius: '2px' }} />
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: theme.muted, marginTop: '2px' }}>Goal 80%</span>
            </>
          )}
          {avgRet === null && <Sub theme={theme}>Start a topic to begin tracking</Sub>}
        </StatCard>

        <StatCard theme={theme} i={1} label="Health" help="A blend of average retention and how much of the course has reached Mastered.">
          <BigVal theme={theme} empty={chealth === null}>{chealth ?? '—'}</BigVal>
          <Sub theme={theme} tone={chealth === null ? undefined : chealth >= 70 ? theme.pine : chealth >= 45 ? theme.orange : theme.error}>
            {chealth === null ? 'No active topics yet' : chealth >= 70 ? 'Holding steady' : chealth >= 45 ? 'Slipping in places' : 'Needs attention'}
          </Sub>
        </StatCard>

        <StatCard theme={theme} i={2} label="Calibration" help="How your self-rated confidence compares with measured recall. Above zero means overconfident; below means underconfident.">
          <BigVal theme={theme} empty={meanOci === null}>
            {meanOci === null ? '—' : `${meanOci > 0 ? '+' : ''}${meanOci.toFixed(2)}`}
          </BigVal>
          <Sub theme={theme} tone={meanOci === null ? undefined : Math.abs(meanOci) > 0.15 ? theme.orange : theme.pine}>
            {meanOci === null ? 'Log an exam to calibrate' : meanOci > 0.15 ? 'Overconfident' : meanOci < -0.15 ? 'Underconfident' : 'Well calibrated'}
          </Sub>
        </StatCard>

        <StatCard theme={theme} i={3} label="Due review" help="Topics whose predicted recall has decayed far enough that a review is scheduled for today.">
          <BigVal theme={theme} empty={due === 0}>{String(due)}</BigVal>
          {due === 0 ? (
            <Sub theme={theme} tone={theme.pine}>Nothing due — you’re clear</Sub>
          ) : (
            <button
              type="button"
              onClick={() => (onStartSession && nextDueTopicId ? onStartSession(nextDueTopicId) : onLogSession())}
              style={{ alignSelf: 'flex-start', marginTop: '2px', padding: 0, background: 'none', border: 'none', fontFamily: SANS, fontSize: '11.5px', fontWeight: 700, color: theme.error, cursor: 'pointer', textAlign: 'left' }}
            >
              Due today · Review now
            </button>
          )}
        </StatCard>

        <StatCard theme={theme} i={4} label="Projected finish" help="The date every topic is forecast to reach Mastered at your current pace.">
          <BigVal theme={theme} empty={projection.state !== 'range'}>
            {projection.state === 'range' ? `${fmtDate(projection.best)}–${fmtDate(projection.worst)}` : '—'}
          </BigVal>
          <Sub theme={theme}>
            {projection.state === 'range'
              ? `${projection.topicsPerWeek.toFixed(1)} topics/week`
              : projection.state === 'complete'
                ? 'Course complete'
                : 'Not enough data yet'}
          </Sub>
        </StatCard>
      </div>

      {/* ── Activity heatmap ───────────────────────────────────── */}
      <div style={heatPanel(theme)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
          <h2 style={panelTitleFlush(theme)}>Study activity</h2>
          <span style={heatRangeTag(theme)}>Last 90 days</span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 13px)', gap: '4px', fontSize: '10px', lineHeight: '13px', color: theme.muted, textAlign: 'right', paddingTop: '20px', flexShrink: 0 }}>
            {['', 'M', '', 'W', '', 'F', ''].map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1, minWidth: 0, overflowX: 'auto', paddingBottom: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 13px)`, gap: '4px', height: '14px', alignItems: 'end' }}>
              {monthLabels.map((m, i) => (
                <span key={i} style={{ gridColumn: String(m.col + 1), gridRow: '1', fontSize: '10px', fontWeight: 600, color: theme.muted, whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 13px)', gridAutoFlow: 'column', gap: '4px' }}>
              {grid.map((g, i) => (
                <div
                  key={i}
                  data-cell
                  title={`${fmtDate(g.date)} — ${g.level === 0 ? 'no study' : 'studied'}`}
                  style={{ width: '13px', height: '13px', borderRadius: '3px', background: heatColor(g.level, isDark), border: `1px solid ${g.level === 0 ? theme.border : 'transparent'}`, boxSizing: 'border-box' }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: '20px', borderLeft: `1px solid ${theme.border}`, flexShrink: 0, minWidth: '130px' }}>
            {[
              { n: curStreak, l: 'Current streak (days)' },
              { n: longStreak, l: 'Longest streak (days)' },
              { n: activeDays, l: 'Active days (90d)' },
            ].map((s, i) => (
              <div key={i}>
                <span style={{ display: 'block', fontFamily: SERIF, fontSize: '24px', color: theme.ink }}>{s.n}</span>
                <span style={{ fontSize: '11px', color: theme.muted }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', fontSize: '11px', color: theme.muted }}>
          Less
          {[0, 1, 2, 3, 4].map((v) => (
            <span key={v} style={{ width: '11px', height: '11px', borderRadius: '3px', background: heatColor(v, isDark), border: `1px solid ${v === 0 ? theme.border : 'transparent'}`, boxSizing: 'border-box' }} />
          ))}
          More
        </div>
        <p style={{ fontSize: '12px', color: theme.muted, margin: '6px 0 0' }}>
          Each square is a day; darker squares mean more time studied that day.
        </p>
      </div>

      {/* ── Topic matrix ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '104px 1fr 96px 72px 76px', alignItems: 'center', gap: '14px', padding: '0 16px 0 19px', marginTop: '20px' }}>
        {['Status', 'Topic', 'Confidence', 'Retention trend', 'Due'].map((h) => (
          <span key={h} style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.muted }}>
            {h}
          </span>
        ))}
      </div>
      {course.sections.map((section) => {
        const rows: TopicRef[] = section.topics
          .map((topic) => ({ topic, section }))
          .sort((a, b) => {
            const ra = rankOf.get(a.topic.topic_id) ?? Number.MAX_SAFE_INTEGER;
            const rb = rankOf.get(b.topic.topic_id) ?? Number.MAX_SAFE_INTEGER;
            return ra - rb;
          });
        return (
          <div key={section.section_id}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '19px', color: theme.ink, margin: '26px 0 12px' }}>
              {section.title}
            </h2>
            {rows.map(({ topic }) => (
              <TopicRow key={topic.topic_id} topic={topic} theme={theme} isDark={isDark} now={now} onSelect={onSelectTopic} weak={rankOf.has(topic.topic_id)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TopicRow({
  topic,
  theme,
  isDark,
  now,
  onSelect,
  weak,
}: {
  topic: Topic;
  theme: CairnTheme;
  isDark: boolean;
  now: Date;
  onSelect: (t: Topic) => void;
  weak: boolean;
}) {
  const label = statusLabel(topic.status);
  const sc = statusColor(label, theme, isDark);
  // Never-reviewed retention is undefined, not zero — show "—", never a 0% curve.
  const raw = retentionPct(topic, now);
  const ret = raw === null ? null : Math.round(raw);
  const p = projectedDue(topic, now);
  const dueNow = p?.overdue === true;
  const spark = ret === null ? null : buildMiniSparkPath(ret);
  const sparkCol = ret === null ? theme.muted : retentionColor(ret, theme);
  const isWeak = weak && ret !== null && ret < 55;

  let dueLabel = '—';
  if (p) {
    if (p.overdue) dueLabel = 'today';
    else {
      const days = Math.max(1, Math.ceil((p.date.getTime() - now.getTime()) / 86_400_000));
      dueLabel = `in ${days} ${days === 1 ? 'day' : 'days'}`;
    }
  }

  const leftBorder = sc.bg === 'transparent' ? theme.muted : sc.bg;
  const rowLabel = `${topic.title} — ${label}${ret === null ? '' : `, ${ret}% retention`}, confidence ${topic.conf}/5, due ${dueLabel}`;

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(topic);
    }
  };

  return (
    <div
      data-row
      role="button"
      tabIndex={0}
      aria-label={rowLabel}
      onClick={() => onSelect(topic)}
      onKeyDown={onKey}
      style={{
        display: 'grid', gridTemplateColumns: '104px 1fr 96px 72px 76px', alignItems: 'center', gap: '14px',
        padding: '13px 16px 13px 14px', background: dueNow ? (isDark ? '#251d17' : '#fff7ef') : theme.surface,
        border: `1px solid ${theme.border}`, borderLeft: `5px solid ${leftBorder}`, borderRadius: '10px',
        marginBottom: '8px', cursor: 'pointer',
        ['--cairn-hover' as string]: theme.hoverBg,
      }}
    >
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px',
          borderRadius: '9999px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
          background: sc.bg, color: sc.color, border: `2px solid ${sc.bg === 'transparent' ? theme.border : sc.border}`,
        }}
      >
        {label}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {topic.title}
          {isWeak && (
            <span style={{ fontSize: '10px', fontWeight: 700, color: theme.error, border: `1px solid ${theme.error}`, borderRadius: '9999px', padding: '1px 7px', marginLeft: '8px' }}>
              weak
            </span>
          )}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-start' }} title={`Confidence ${topic.conf}/5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={{ width: '6px', height: '6px', borderRadius: '9999px', background: n <= topic.conf ? theme.orange : theme.surfaceAlt, border: `1px solid ${n <= topic.conf ? theme.orange : theme.border}` }}
          />
        ))}
      </div>
      {spark ? (
        <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden="true">
          <path d={spark.d} fill="none" stroke={sparkCol} strokeWidth="2" strokeLinecap="round" />
          <circle cx={spark.endX} cy={spark.endY} r="2.5" fill={sparkCol} />
        </svg>
      ) : (
        <span style={{ fontSize: '13px', color: theme.muted }} aria-hidden="true">
          —
        </span>
      )}
      <span style={{ fontSize: '12px', fontWeight: dueNow ? 700 : 500, color: dueNow ? theme.error : theme.muted, whiteSpace: 'nowrap' }}>
        {dueLabel}
      </span>
    </div>
  );
}

/* ── small presentational helpers ─────────────────────────────────── */
function StatCard({ theme, i, label, help, children }: { theme: CairnTheme; i: number; label: string; help?: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'flex', flexDirection: 'column', gap: '5px', background: theme.surface, border: `2px solid ${theme.border}`,
        borderRadius: i % 2 === 0 ? '18px 6px 18px 6px' : '6px 18px 6px 18px', padding: '16px 18px 18px',
        boxShadow: `4px 5px 0 ${theme.shadow}`, transform: `rotate(${i % 3 === 0 ? '-0.5deg' : i % 3 === 1 ? '0.4deg' : '-0.2deg'})`,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.muted }}>
          {label}
        </span>
        {help && (
          <span
            title={help}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '15px', height: '15px', borderRadius: '9999px', border: `1px solid ${theme.border}`, fontSize: '9px', fontWeight: 700, color: theme.muted, cursor: 'help', flexShrink: 0, lineHeight: 1 }}
          >
            ?
          </span>
        )}
      </span>
      {children}
    </div>
  );
}
function BigVal({ theme, empty, children }: { theme: CairnTheme; empty?: boolean; children: ReactNode }) {
  return <span style={{ fontFamily: SERIF, fontSize: '32px', lineHeight: 1.05, color: empty ? theme.muted : theme.ink, letterSpacing: '-0.5px' }}>{children}</span>;
}
function Sub({ theme, tone, children }: { theme: CairnTheme; tone?: string; children: ReactNode }) {
  return <span style={{ fontSize: '11.5px', fontWeight: 600, color: tone ?? theme.muted, lineHeight: 1.35 }}>{children}</span>;
}

function contentStyle(): CSSProperties {
  return { flex: 1, width: '100%', maxWidth: '1440px', boxSizing: 'border-box', padding: '36px 40px 56px', position: 'relative' };
}
function backStyle(t: CairnTheme): CSSProperties {
  return { background: 'none', border: 'none', padding: 0, marginBottom: '18px', fontFamily: SANS, fontSize: '13px', fontWeight: 500, color: t.muted, cursor: 'pointer', textDecoration: 'underline' };
}
function healthBadge(t: CairnTheme, isDark: boolean): CSSProperties {
  return { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '84px', height: '84px', borderRadius: '9999px', background: t.pine, color: isDark ? '#0d1512' : '#ffffeb', border: `2px solid ${t.border}`, transform: 'rotate(-3deg)', boxShadow: `4px 4px 0 ${t.shadow}`, flexShrink: 0 };
}
function subBadge(t: CairnTheme): CSSProperties {
  return { background: t.lavender, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, color: '#1a1a1a', transform: 'rotate(-3deg)', boxShadow: `2px 2px 0 ${t.shadow}`, whiteSpace: 'nowrap', alignSelf: 'flex-start' };
}
function logSessionBtn(t: CairnTheme): CSSProperties {
  return { marginLeft: 'auto', background: t.orange, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px 24px', fontFamily: SANS, fontSize: '14px', fontWeight: 700, color: '#1a1a1a', cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
function deltaWrap(t: CairnTheme): CSSProperties {
  return { fontSize: '11px', fontWeight: 600, color: t.muted, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' };
}
function goalTrack(t: CairnTheme): CSSProperties {
  return { position: 'relative', height: '6px', borderRadius: '9999px', background: t.surfaceAlt, marginTop: '10px' };
}
function heatPanel(t: CairnTheme): CSSProperties {
  return { background: t.surface, border: `2px solid ${t.border}`, borderRadius: '14px 32px 14px 32px', padding: '24px', marginBottom: '28px', transform: 'rotate(0.2deg)', boxShadow: `5px 6px 0 ${t.shadow}` };
}
function heatRangeTag(t: CairnTheme): CSSProperties {
  return { flexShrink: 0, fontSize: '11px', fontWeight: 600, color: t.muted, background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: '9999px', padding: '3px 10px' };
}
function panelTitleFlush(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '20px', color: t.ink, margin: 0 };
}
