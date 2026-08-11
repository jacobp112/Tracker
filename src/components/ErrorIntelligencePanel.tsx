import type { Store } from '@/domain/types';
import { patternStatus, errorUrgency, type DerivedErrorStatus, type UrgencyLevel } from '@/engine/errors';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";

interface ErrorIntelligencePanelProps {
  store: Store;
}

const STATUS_BADGES: Record<DerivedErrorStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'ACTIVE', bg: '#ef4444', text: '#ffffff' },
  verification_pending: { label: 'VERIFICATION PENDING', bg: '#f59e0b', text: '#ffffff' },
  verified_resolved: { label: 'VERIFIED RESOLVED', bg: '#10b981', text: '#ffffff' },
  regressed: { label: 'REGRESSED', bg: '#8b5cf6', text: '#ffffff' },
};

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#10b981',
};

export function ErrorIntelligencePanel({ store }: ErrorIntelligencePanelProps) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const now = new Date();

  if (store.error_patterns.length === 0) {
    return (
      <div
        style={{
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          borderRadius: '14px',
          padding: '20px',
          color: theme.muted,
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        No recurring error patterns detected yet. As you log sessions and sit assessments, Cairn automatically clusters mistakes semantically into patterns.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h3 style={{ fontFamily: SERIF, fontSize: '22px', margin: 0, color: theme.ink }}>
        Error Intelligence &amp; Pattern Lifecycle
      </h3>

      {store.error_patterns.map((pattern) => {
        const { status, reasons: statusReasons } = patternStatus(pattern, store, now);
        const urgency = errorUrgency(pattern, store, now);
        const badge = STATUS_BADGES[status];
        const urgencyColor = URGENCY_COLORS[urgency.level];

        return (
          <div
            key={pattern.pattern_id}
            style={{
              background: theme.surface,
              border: `2px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: `3px 4px 0 ${theme.shadow}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: urgencyColor,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {pattern.error_type} · Urgency: {urgency.level.toUpperCase()} ({urgency.when})
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 700, color: theme.ink }}>
                  "{pattern.signature}"
                </h4>
              </div>

              <span
                style={{
                  background: badge.bg,
                  color: badge.text,
                  borderRadius: '9999px',
                  padding: '3px 10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}
              >
                {badge.label}
              </span>
            </div>

            <div
              style={{
                background: theme.surfaceAlt,
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: theme.muted,
                lineHeight: 1.4,
              }}
            >
              <div style={{ marginBottom: '4px' }}>
                <strong style={{ color: theme.ink }}>Status Reason:</strong> {statusReasons.join('; ')}
              </div>
              <div>
                <strong style={{ color: theme.ink }}>Urgency Drivers:</strong> {urgency.reasons.join('; ')}
              </div>
              {status === 'verification_pending' && (
                <div style={{ marginTop: '6px', color: theme.orange, fontWeight: 600 }}>
                  Awaiting independent proof: Requires a passed test (tier ≥ {pattern.severity === 'high' ? 5 : 4}) to verify resolution.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
