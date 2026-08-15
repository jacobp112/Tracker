import type { Recommendation, EvidenceRef } from '@/engine/recommend';
import type { Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SANS = 'var(--font-sans)';
const SERIF = "'EB Garamond', var(--font-display)";

interface RecommendationCardProps {
  recommendation: Recommendation;
  store: Store;
  isPrimary?: boolean;
  onAction: (rec: Recommendation) => void;
}

const ACTION_LABELS: Record<Recommendation['action'], string> = {
  remediate: 'Remediate Error',
  prerequisite: 'Fix Prerequisite',
  retrieve: 'Practice Retrieval',
  review: 'Review Topic',
  learn: 'Start New Topic',
  assess: 'Sit Assessment',
};

const ACTION_BADGE_BG: Record<Recommendation['action'], string> = {
  remediate: '#ef4444',
  prerequisite: '#f97316',
  retrieve: '#3b82f6',
  review: '#8b5cf6',
  learn: '#10b981',
  assess: '#ec4899',
};

const PRIORITY_TONES: Record<Recommendation['priority'], string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#10b981',
};

const WHEN_LABELS: Record<Recommendation['when'], string> = {
  today: 'Today',
  within_48h: 'Within 48h',
  this_week: 'This week',
  next_cycle: 'Next cycle',
};

function resolveEvidenceLabels(evidence: EvidenceRef[], store: Store): string[] {
  const topicsById = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic.title]));
  const patternsById = new Map(store.error_patterns.map((p) => [p.pattern_id, p.signature]));
  const assessmentsById = new Map(store.assessment_refs.map((a) => [a.assessment_id, a.title]));

  const labels: string[] = [];
  for (const ev of evidence) {
    if (ev.kind === 'topic') {
      const title = topicsById.get(ev.id);
      if (title) labels.push(`Topic: ${title}`);
    } else if (ev.kind === 'pattern') {
      const sig = patternsById.get(ev.id);
      if (sig) labels.push(`Error: "${sig}"`);
    } else if (ev.kind === 'assessment') {
      const title = assessmentsById.get(ev.id);
      if (title) labels.push(`Assessment: ${title}`);
    }
  }
  return [...new Set(labels)];
}

export function RecommendationCard({
  recommendation,
  store,
  isPrimary = false,
  onAction,
}: RecommendationCardProps) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  const evidenceLabels = resolveEvidenceLabels(recommendation.evidence, store);
  const actionLabel = ACTION_LABELS[recommendation.action];
  const priorityColor = PRIORITY_TONES[recommendation.priority];

  if (isPrimary) {
    return (
      <div
        style={{
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          borderRadius: '16px 36px 16px 36px',
          padding: '24px 28px',
          marginBottom: '28px',
          boxShadow: `6px 7px 0 ${theme.shadow}`,
          position: 'relative',
          transform: 'rotate(-0.3deg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span
            style={{
              background: ACTION_BADGE_BG[recommendation.action],
              color: '#ffffff',
              borderRadius: '9999px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              boxShadow: `2px 2px 0 ${theme.shadow}`,
            }}
          >
            What to do next: {actionLabel}
          </span>
          <span
            style={{
              background: isDark ? '#262626' : '#f3f4f6',
              color: priorityColor,
              border: `1px solid ${priorityColor}`,
              borderRadius: '9999px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {recommendation.priority.toUpperCase()} · {WHEN_LABELS[recommendation.when]}
          </span>
          <span style={{ fontSize: '12px', color: theme.muted, marginLeft: 'auto', fontWeight: 600 }}>
            Est. {recommendation.est_duration_minutes} mins
          </span>
        </div>

        <h3
          style={{
            fontFamily: SERIF,
            fontSize: '28px',
            lineHeight: 1.15,
            color: theme.ink,
            margin: '0 0 10px 0',
            letterSpacing: '-0.3px',
          }}
        >
          {recommendation.target.title}
        </h3>

        <p style={{ margin: '0 0 14px 0', fontSize: '14.5px', color: theme.ink, lineHeight: 1.45 }}>
          {recommendation.reason}
        </p>

        {evidenceLabels.length > 0 && (
          <div
            style={{
              background: theme.surfaceAlt,
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '18px',
              fontSize: '12.5px',
              color: theme.muted,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <strong style={{ color: theme.ink, fontWeight: 600 }}>Supporting Evidence:</strong>
            {evidenceLabels.map((lbl, idx) => (
              <span
                key={idx}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                {lbl}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-press
            onClick={() => onAction(recommendation)}
            style={{
              background: theme.orange,
              border: `2px solid ${theme.border}`,
              borderRadius: '9999px',
              padding: '12px 24px',
              fontFamily: SANS,
              fontSize: '14px',
              fontWeight: 700,
              color: '#1a1a1a',
              cursor: 'pointer',
              boxShadow: `3px 3px 0 ${theme.shadow}`,
            }}
          >
            Start {actionLabel} →
          </button>
        </div>
      </div>
    );
  }

  // Secondary recommendation (compact view)
  return (
    <div
      style={{
        background: theme.surface,
        border: `2px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: `3px 4px 0 ${theme.shadow}`,
      }}
    >
      <div style={{ flex: 1, minWidth: '220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: ACTION_BADGE_BG[recommendation.action],
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {actionLabel}
          </span>
          <span style={{ fontSize: '10px', color: priorityColor, fontWeight: 700 }}>
            • {recommendation.priority}
          </span>
          <span style={{ fontSize: '11px', color: theme.muted }}>
            • Est. {recommendation.est_duration_minutes}m
          </span>
        </div>

        <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 600, color: theme.ink }}>
          {recommendation.target.title}
        </h4>
        <p style={{ margin: 0, fontSize: '12.5px', color: theme.muted, lineHeight: 1.3 }}>
          {recommendation.reason}
        </p>
      </div>

      <button
        type="button"
        data-press
        onClick={() => onAction(recommendation)}
        style={{
          background: theme.lavender,
          border: `2px solid ${theme.border}`,
          borderRadius: '9999px',
          padding: '8px 16px',
          fontFamily: SANS,
          fontSize: '12.5px',
          fontWeight: 700,
          color: '#1a1a1a',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
