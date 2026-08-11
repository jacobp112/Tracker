import type { ReadinessReport, ReadinessCriterion } from '@/engine/readiness';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";

interface ReadinessCardProps {
  report: ReadinessReport;
  title?: string;
}

const VERDICT_LABELS: Record<ReadinessReport['verdict'], string> = {
  ready: 'READY TO SIT',
  not_ready: 'NOT READY',
  insufficient_evidence: 'INSUFFICIENT EVIDENCE',
};

const VERDICT_COLORS: Record<ReadinessReport['verdict'], { bg: string; text: string; border: string }> = {
  ready: { bg: '#10b981', text: '#ffffff', border: '#059669' },
  not_ready: { bg: '#ef4444', text: '#ffffff', border: '#dc2626' },
  insufficient_evidence: { bg: '#f59e0b', text: '#ffffff', border: '#d97706' },
};

const STATE_ICONS: Record<ReadinessCriterion['state'], { icon: string; color: string }> = {
  pass: { icon: '✓', color: '#10b981' },
  fail: { icon: '✕', color: '#ef4444' },
  unknown: { icon: '?', color: '#f59e0b' },
};

export function ReadinessCard({ report, title }: ReadinessCardProps) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  const style = VERDICT_COLORS[report.verdict];

  return (
    <div
      style={{
        background: theme.surface,
        border: `2px solid ${theme.border}`,
        borderRadius: '14px',
        padding: '18px 22px',
        marginBottom: '16px',
        boxShadow: `4px 5px 0 ${theme.shadow}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Assessment Readiness Check
          </span>
          {title && (
            <h4 style={{ fontFamily: SERIF, fontSize: '20px', margin: '2px 0 0 0', color: theme.ink }}>
              {title}
            </h4>
          )}
        </div>

        <span
          style={{
            background: style.bg,
            color: style.text,
            borderRadius: '9999px',
            padding: '4px 14px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            boxShadow: `2px 2px 0 ${theme.shadow}`,
          }}
        >
          {VERDICT_LABELS[report.verdict]}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {report.criteria.map((c) => {
          const st = STATE_ICONS[c.state];
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: theme.surfaceAlt,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12.5px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  borderRadius: '9999px',
                  background: st.color,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '11px',
                  flexShrink: 0,
                }}
              >
                {st.icon}
              </span>

              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: theme.ink }}>
                  {c.id.replace(/_/g, ' ')}
                  {c.blocking && (
                    <span style={{ fontSize: '10px', color: theme.muted, marginLeft: '6px' }}>
                      (blocking)
                    </span>
                  )}
                </span>
                <span style={{ display: 'block', color: theme.muted, fontSize: '11.5px' }}>
                  {c.detail}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
