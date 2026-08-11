import { useMemo, useState, type CSSProperties } from 'react';
import type { Store } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme, type CairnTheme } from '@/theme/cairnMock';
import { performanceByDifficulty, performanceByNovelty, type DimensionBucket } from '@/engine/performance';
import { allReviewEvents, performanceSummary, unstablePrerequisites, type UnstableUpstream } from '@/engine/performance-view';

const SERIF = "'EB Garamond', var(--font-display)";
const round = (x: number) => String(Math.round(x));

/** A metric value or an honest em dash when it's null (below its min-data guard). */
function dash(x: number | null | undefined): string {
  return x === null || x === undefined ? '—' : round(x);
}

export function Performance({ store }: { store: Store }) {
  const { theme: mode } = useTheme();
  const theme = getCairnTheme(mode === 'dark');
  const [now] = useState(() => new Date());

  const events = useMemo(() => allReviewEvents(store), [store]);
  const summary = useMemo(() => performanceSummary(events), [events]);
  const byDifficulty = useMemo(() => performanceByDifficulty(events), [events]);
  const byNovelty = useMemo(() => performanceByNovelty(events), [events]);
  const unstable = useMemo(() => unstablePrerequisites(store, now), [store, now]);

  const hasAssessments = events.some((e) => e.assessment);
  if (!hasAssessments) {
    return (
      <div style={content()}>
        <h1 style={pageTitle(theme)}>Performance</h1>
        <p style={{ fontSize: '15px', color: theme.muted, maxWidth: '520px' }}>
          No performance data yet. When your tutor marks assessments with difficulty,
          independence, transfer and quality, this page shows how effectively you can
          use what you know — separate from how well you retain it.
        </p>
      </div>
    );
  }

  const indep = summary.independent;
  const indepValue =
    indep && indep.sufficient && indep.independent.accuracy !== null
      ? round(indep.independent.accuracy * 100)
      : '—';

  const cards: Array<{ label: string; value: string; sub: string }> = [
    { label: 'Performance Health', value: dash(summary.performanceHealth), sub: 'effective use of knowledge' },
    { label: 'Cold Performance', value: summary.cold ? round(summary.cold.score) : '—', sub: 'unfamiliar · unaided' },
    { label: 'Independent Performance', value: indepValue, sub: indep ? `${indep.independent.n} independent attempts` : 'no data' },
    { label: 'Transfer Ability', value: summary.transfer ? round(summary.transfer.score) : '—', sub: summary.transfer ? `${summary.transfer.n} attempts` : 'not enough data' },
    { label: 'Performance Quality', value: summary.quality ? round(summary.quality.score) : '—', sub: 'reasoning · clarity · method' },
    { label: 'Novel-Task Success', value: summary.novelTaskSuccess ? `${round(summary.novelTaskSuccess.rate * 100)}%` : '—', sub: summary.novelTaskSuccess ? `${summary.novelTaskSuccess.n} novel tasks` : 'not enough data' },
  ];

  return (
    <div style={content()}>
      <h1 style={pageTitle(theme)}>Performance</h1>
      <p style={{ fontSize: '15px', color: theme.muted, maxWidth: '560px', margin: '0 0 28px' }}>
        How effectively you can use what you know — independent application, transfer, and
        performance at rising difficulty and novelty. Separate from retention.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {cards.map((c) => (
          <div key={c.label} style={card(theme)}>
            <span style={cardLabel(theme)}>{c.label}</span>
            <span style={{ fontFamily: SERIF, fontSize: '34px', lineHeight: 1.05, color: theme.ink }}>{c.value}</span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: theme.muted }}>{c.sub}</span>
          </div>
        ))}
      </div>

      <DimensionSection title="Performance by difficulty" unit="Difficulty" buckets={byDifficulty} theme={theme} />
      <DimensionSection title="Performance by novelty" unit="Novelty" buckets={byNovelty} theme={theme} />

      {unstable.length > 0 && <PrereqSection items={unstable} theme={theme} />}
    </div>
  );
}

function DimensionSection({ title, unit, buckets, theme }: { title: string; unit: string; buckets: DimensionBucket[]; theme: CairnTheme }) {
  return (
    <div style={panel(theme)}>
      <h2 style={panelTitle(theme)}>{title}</h2>
      {buckets.length === 0 ? (
        <p style={{ fontSize: '13px', color: theme.muted }}>No independent attempts yet.</p>
      ) : (
        buckets.map((b) => {
          const rate = b.successRate === null ? null : Math.round(b.successRate * 100);
          return (
            <div key={b.level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <span style={{ width: '96px', fontSize: '13px', color: theme.ink }}>{unit} {b.level}</span>
              <div style={{ flex: 1, height: '10px', borderRadius: '9999px', background: theme.surfaceAlt, overflow: 'hidden' }}>
                <div style={{ width: `${rate ?? 0}%`, height: '100%', background: theme.pine, borderRadius: '9999px' }} />
              </div>
              <span style={{ width: '64px', textAlign: 'right', fontSize: '13px', color: theme.muted }}>
                {rate === null ? '—' : `${rate}%`} · n={b.n}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function PrereqSection({ items, theme }: { items: UnstableUpstream[]; theme: CairnTheme }) {
  return (
    <div style={panel(theme)}>
      <h2 style={panelTitle(theme)}>Upstream instability</h2>
      <p style={{ fontSize: '12px', color: theme.muted, margin: '-6px 0 10px' }}>
        Topics you're struggling with whose prerequisites look shaky — the root may be upstream.
      </p>
      {items.map((it) => (
        <div key={it.topic_id} style={{ padding: '8px 0', borderBottom: `1px solid ${theme.border}` }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.ink }}>{it.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.muted }}>
            {it.report.upstream.filter((u) => u.unstable).map((u) => u.title).join(', ')}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── style builders (lean; align with Overview.tsx's theme usage) ── */
function content(): CSSProperties {
  return { flex: 1, width: '100%', maxWidth: '1440px', boxSizing: 'border-box', padding: '36px 40px 56px' };
}
function pageTitle(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '34px', color: t.ink, margin: '0 0 6px' };
}
function card(t: CairnTheme): CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap: '6px', background: t.surface, border: `2px solid ${t.border}`, borderRadius: '14px', padding: '16px 18px 18px', boxShadow: `4px 5px 0 ${t.shadow}`, boxSizing: 'border-box' };
}
function cardLabel(t: CairnTheme): CSSProperties {
  return { fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.muted };
}
function panel(t: CairnTheme): CSSProperties {
  return { background: t.surface, border: `2px solid ${t.border}`, borderRadius: '14px', padding: '22px 24px', marginBottom: '24px', boxShadow: `4px 5px 0 ${t.shadow}`, boxSizing: 'border-box' };
}
function panelTitle(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '20px', color: t.ink, margin: '0 0 14px' };
}
