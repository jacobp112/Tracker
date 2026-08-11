import { useState } from 'react';
import type { AssessmentDefinition } from '@/domain/assessment';
import type { Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

interface AssessmentIngestPreviewProps {
  definition: AssessmentDefinition;
  store: Store;
  onConfirmCommit: (confirmedDef: AssessmentDefinition) => void;
  onCancel: () => void;
}

export function AssessmentIngestPreview({
  definition,
  store,
  onConfirmCommit,
  onCancel,
}: AssessmentIngestPreviewProps) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  const topicTitles = new Map(allTopics(store).map(({ topic }) => [topic.topic_id, topic.title]));

  // Clone definition questions to allow local mapping confirmations
  const [def, setDef] = useState<AssessmentDefinition>(() => structuredClone(definition));

  const toggleConfirm = (qIndex: number, mIndex: number) => {
    setDef((prev) => {
      const next = structuredClone(prev);
      const m = next.questions[qIndex]?.topic_mappings[mIndex];
      if (m) m.confirmed = !m.confirmed;
      return next;
    });
  };

  const confirmAll = () => {
    setDef((prev) => {
      const next = structuredClone(prev);
      for (const q of next.questions) {
        for (const m of q.topic_mappings) {
          m.confirmed = true;
        }
      }
      return next;
    });
  };

  const confirmedCount = def.questions.flatMap((q) => q.topic_mappings).filter((m) => m.confirmed).length;
  const totalMappings = def.questions.flatMap((q) => q.topic_mappings).length;

  return (
    <div
      style={{
        background: theme.surface,
        border: `2px solid ${theme.border}`,
        borderRadius: '16px',
        padding: '24px 28px',
        maxWidth: '720px',
        margin: '0 auto',
        boxShadow: `6px 7px 0 ${theme.shadow}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: theme.pine,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Assessment Preview · Ingestion
          </span>
          <h2 style={{ fontFamily: SERIF, fontSize: '26px', margin: '4px 0 0 0', color: theme.ink }}>
            {def.title}
          </h2>
        </div>
        <button
          type="button"
          data-press
          onClick={confirmAll}
          style={{
            background: theme.surfaceAlt,
            border: `1.5px solid ${theme.border}`,
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            color: theme.ink,
          }}
        >
          Confirm all mappings
        </button>
      </div>

      <div
        style={{
          background: theme.surfaceAlt,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '20px',
          fontSize: '13px',
          color: theme.muted,
        }}
      >
        <span>
          <strong>Total Marks:</strong> {def.max_marks}
        </span>
        <span>
          <strong>Questions:</strong> {def.questions.length}
        </span>
        <span>
          <strong>Confirmed Mappings:</strong> {confirmedCount} / {totalMappings}
        </span>
      </div>

      <p style={{ fontSize: '13px', color: theme.muted, marginBottom: '16px', lineHeight: 1.4 }}>
        Only <strong>confirmed</strong> topic mappings will contribute evidence towards your learner state and readiness. Unconfirmed AI proposals are ignored until you confirm them below.
      </p>

      <div
        style={{
          maxHeight: '360px',
          overflowY: 'auto',
          border: `1.5px solid ${theme.border}`,
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {def.questions.map((q, qIdx) => (
          <div
            key={q.question_id}
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: theme.ink }}>
                Question {q.label}{' '}
                <span style={{ fontWeight: 500, fontSize: '12px', color: theme.muted }}>
                  ({q.marks_available} {q.marks_available === 1 ? 'mark' : 'marks'})
                </span>
              </span>
              {q.difficulty !== undefined && (
                <span style={{ fontSize: '11px', color: theme.muted }}>
                  Difficulty: {q.difficulty}/5
                </span>
              )}
            </div>

            {q.stem_ref && (
              <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: theme.muted, fontStyle: 'italic' }}>
                Ref: {q.stem_ref}
              </p>
            )}

            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              <span style={{ fontWeight: 600, color: theme.ink, display: 'block', marginBottom: '4px' }}>
                Topic Mappings:
              </span>
              {q.topic_mappings.length === 0 ? (
                <span style={{ color: theme.muted, fontStyle: 'italic' }}>No topic mapped</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {q.topic_mappings.map((m, mIdx) => {
                    const title = topicTitles.get(m.topic_id) ?? m.topic_id;
                    return (
                      <label
                        key={mIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: m.confirmed
                            ? isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5'
                            : theme.surfaceAlt,
                          border: `1px solid ${m.confirmed ? '#10b981' : theme.border}`,
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={m.confirmed}
                          onChange={() => toggleConfirm(qIdx, mIdx)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: 600, color: theme.ink }}>{title}</span>
                        <span style={{ fontSize: '11px', color: theme.muted, marginLeft: 'auto' }}>
                          {m.role} ({Math.round(m.weight * 100)}% weight)
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button
          type="button"
          data-press
          onClick={onCancel}
          style={{
            background: 'none',
            border: `2px solid ${theme.border}`,
            borderRadius: '9999px',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 600,
            color: theme.muted,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          data-press
          onClick={() => onConfirmCommit(def)}
          style={{
            background: theme.orange,
            border: `2px solid ${theme.border}`,
            borderRadius: '9999px',
            padding: '10px 24px',
            fontFamily: SANS,
            fontSize: '14px',
            fontWeight: 700,
            color: '#1a1a1a',
            cursor: 'pointer',
            boxShadow: `3px 3px 0 ${theme.shadow}`,
          }}
        >
          Save & Commit Assessment
        </button>
      </div>
    </div>
  );
}
