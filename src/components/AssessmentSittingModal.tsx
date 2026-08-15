import { useState } from 'react';
import type { AssessmentDefinition, AssessmentAttempt, QuestionResult, SittingConditions } from '@/domain/assessment';
import type { ErrorType } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

interface AssessmentSittingModalProps {
  definition: AssessmentDefinition;
  onSubmitAttempt: (attempt: AssessmentAttempt) => void;
  onClose: () => void;
}

let attemptCounter = 0;
function makeAttemptId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${(attemptCounter++).toString(36)}`.slice(0, 10);
  return `attempt_${rand}`;
}

export function AssessmentSittingModal({
  definition,
  onSubmitAttempt,
  onClose,
}: AssessmentSittingModalProps) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  const [step, setStep] = useState<'conditions' | 'marking'>('conditions');

  // Sitting conditions state
  const [conditions, setConditions] = useState<SittingConditions>({
    timed: true,
    closed_book: true,
    cold: true,
    assistance_used: false,
    ai_used: false,
    mark_scheme_seen: false,
  });

  // Question results state (keyed by question_id)
  const [marks, setMarks] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const q of definition.questions) {
      init[q.question_id] = q.marks_available; // default full marks
    }
    return init;
  });

  // Error tagging state per question
  const [errors, setErrors] = useState<Record<string, { type: ErrorType; description: string }[]>>({});
  const [newErrType, setNewErrType] = useState<ErrorType>('conceptual');
  const [newErrDesc, setNewErrDesc] = useState<string>('');
  const [activeQForErr, setActiveQForErr] = useState<string | null>(null);

  const addErrorToQ = (qId: string) => {
    if (!newErrDesc.trim()) return;
    setErrors((prev) => ({
      ...prev,
      [qId]: [...(prev[qId] ?? []), { type: newErrType, description: newErrDesc.trim() }],
    }));
    setNewErrDesc('');
    setActiveQForErr(null);
  };

  const removeErrorFromQ = (qId: string, idx: number) => {
    setErrors((prev) => ({
      ...prev,
      [qId]: (prev[qId] ?? []).filter((_, i) => i !== idx),
    }));
  };

  const handleMarkChange = (qId: string, maxMarks: number, valueStr: string) => {
    const val = Number(valueStr);
    if (!Number.isFinite(val)) return;
    const clamped = Math.max(0, Math.min(maxMarks, val));
    setMarks((prev) => ({ ...prev, [qId]: clamped }));
  };

  const handleSubmit = () => {
    const question_results: QuestionResult[] = definition.questions.map((q) => {
      const qErrs = errors[q.question_id] ?? [];
      const firstErr = qErrs[0];
      return {
        question_id: q.question_id,
        marks_awarded: marks[q.question_id] ?? 0,
        notes: qErrs.map((e) => `${e.type}: ${e.description}`).join('; ') || undefined,
        proposed_error_signature: firstErr?.description,
      };
    });

    const attempt: AssessmentAttempt = {
      schema_version: '4.0.0',
      attempt_id: makeAttemptId(),
      assessment_id: definition.assessment_id,
      sat_at: new Date().toISOString(),
      conditions,
      question_results,
      status: 'marked',
    };

    onSubmitAttempt(attempt);
  };

  const totalEarned = Object.values(marks).reduce((a, b) => a + b, 0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 95,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          borderRadius: '20px',
          padding: '28px',
          maxWidth: '780px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: `8px 9px 0 ${theme.shadow}`,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: theme.pine, textTransform: 'uppercase' }}>
              Past Paper Assessment Sitting
            </span>
            <h2 style={{ fontFamily: SERIF, fontSize: '26px', margin: '4px 0 0 0', color: theme.ink }}>
              {definition.title}
            </h2>
          </div>
          <button
            type="button"
            data-press
            onClick={onClose}
            style={{
              background: theme.surfaceAlt,
              border: `2px solid ${theme.border}`,
              borderRadius: '9999px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {step === 'conditions' ? (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.ink, marginBottom: '12px' }}>
              1. Sitting Conditions
            </h3>
            <p style={{ fontSize: '13px', color: theme.muted, marginBottom: '18px', lineHeight: 1.4 }}>
              Record exact conditions under which this paper was sat. Independent, unaided sittings provide high-tier evidence; assistance or mark scheme peeking disqualifies independence.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: theme.surfaceAlt,
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: `1px solid ${theme.border}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={conditions.cold}
                  onChange={(e) => setConditions({ ...conditions, cold: e.target.checked })}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: theme.ink }}>Cold Sitting</strong>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Unaided, unfamiliar test items</span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: theme.surfaceAlt,
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: `1px solid ${theme.border}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={conditions.assistance_used}
                  onChange={(e) => setConditions({ ...conditions, assistance_used: e.target.checked })}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: theme.ink }}>Assistance Used</strong>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Notes, textbook, or human help</span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: theme.surfaceAlt,
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: `1px solid ${theme.border}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={conditions.ai_used}
                  onChange={(e) => setConditions({ ...conditions, ai_used: e.target.checked })}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: theme.ink }}>AI Tutor Used</strong>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Hinting or explanation from AI</span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: theme.surfaceAlt,
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: `1px solid ${theme.border}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={conditions.mark_scheme_seen}
                  onChange={(e) => setConditions({ ...conditions, mark_scheme_seen: e.target.checked })}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: theme.ink }}>Mark Scheme Seen</strong>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Peeked at mark scheme during sitting</span>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                data-press
                onClick={() => setStep('marking')}
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
                }}
              >
                Continue to Marking →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: theme.ink, margin: 0 }}>
                2. Mark Question-by-Question
              </h3>
              <span style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 700, color: theme.pine }}>
                Total: {totalEarned} / {definition.max_marks} marks ({Math.round((totalEarned / definition.max_marks) * 100)}%)
              </span>
            </div>

            <div
              style={{
                maxHeight: '440px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginBottom: '20px',
                paddingRight: '6px',
              }}
            >
              {definition.questions.map((q) => {
                const qErrs = errors[q.question_id] ?? [];
                return (
                  <div
                    key={q.question_id}
                    style={{
                      background: theme.surfaceAlt,
                      border: `1.5px solid ${theme.border}`,
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '15px', color: theme.ink }}>
                        Question {q.label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: theme.muted }}>Marks Awarded:</span>
                        <input
                          type="number"
                          min={0}
                          max={q.marks_available}
                          step={0.5}
                          value={marks[q.question_id] ?? 0}
                          onChange={(e) => handleMarkChange(q.question_id, q.marks_available, e.target.value)}
                          style={{
                            width: '64px',
                            padding: '4px 8px',
                            border: `1.5px solid ${theme.border}`,
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '14px',
                            textAlign: 'center',
                          }}
                        />
                        <span style={{ fontSize: '13px', color: theme.muted }}>/ {q.marks_available}</span>
                      </div>
                    </div>

                    {/* Mark scheme criteria guidance */}
                    {q.mark_scheme.criteria.length > 0 && (
                      <div
                        style={{
                          background: theme.surface,
                          border: `1px dashed ${theme.border}`,
                          borderRadius: '6px',
                          padding: '10px 12px',
                          marginBottom: '10px',
                        }}
                      >
                        <strong style={{ display: 'block', fontSize: '11.5px', color: theme.muted, textTransform: 'uppercase', marginBottom: '6px' }}>
                          Mark Scheme Criteria:
                        </strong>
                        <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: theme.ink }}>
                          {q.mark_scheme.criteria.map((c) => (
                            <li key={c.criterion_id} style={{ marginBottom: '2px' }}>
                              <strong>[{c.label ?? c.kind}]</strong> ({c.marks}m) — {c.descriptor}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Error tagging */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: theme.muted }}>
                          Tagged Errors ({qErrs.length}):
                        </span>
                        <button
                          type="button"
                          data-press
                          onClick={() => setActiveQForErr(activeQForErr === q.question_id ? null : q.question_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: theme.pine,
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          + Tag Error
                        </button>
                      </div>

                      {qErrs.map((err, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                            border: '1px solid #ef4444',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            marginTop: '6px',
                            fontSize: '12px',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', fontSize: '10px' }}>
                            {err.type}
                          </span>
                          <span style={{ color: theme.ink, flex: 1 }}>{err.description}</span>
                          <button
                            type="button"
                            onClick={() => removeErrorFromQ(q.question_id, idx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {activeQForErr === q.question_id && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={newErrType}
                            onChange={(e) => setNewErrType(e.target.value as ErrorType)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${theme.border}`,
                              fontSize: '12px',
                            }}
                          >
                            <option value="conceptual">conceptual</option>
                            <option value="procedural">procedural</option>
                            <option value="careless">careless</option>
                            <option value="knowledge_gap">knowledge_gap</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Error description..."
                            value={newErrDesc}
                            onChange={(e) => setNewErrDesc(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: `1px solid ${theme.border}`,
                              fontSize: '12px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => addErrorToQ(q.question_id)}
                            style={{
                              background: theme.pine,
                              color: theme.onAccent,
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep('conditions')}
                style={{
                  background: 'none',
                  border: `2px solid ${theme.border}`,
                  borderRadius: '9999px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: theme.muted,
                }}
              >
                ← Back to Conditions
              </button>
              <button
                type="button"
                data-press
                onClick={handleSubmit}
                style={{
                  background: theme.orange,
                  border: `2px solid ${theme.border}`,
                  borderRadius: '9999px',
                  padding: '12px 28px',
                  fontFamily: SANS,
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1a1a1a',
                  cursor: 'pointer',
                  boxShadow: `3px 3px 0 ${theme.shadow}`,
                }}
              >
                Submit Attempt & Record Evidence →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
