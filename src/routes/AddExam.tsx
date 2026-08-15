import { useState } from 'react';
import { useToast } from '@/components/feedback';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { Button, Card, SecondaryButton } from '@/components/primitives';
import { COMMIT_VERB } from '@/core/pipeline';
import { localDateInputToISO, todayLocalDateInput } from '@/core/dates';
import { examPrompt } from '@/domain/prompts';
import type { ErrorType, Exam, ExamBreakdownEntry, Store } from '@/domain/types';
import { allTopics } from '@/domain/types';
import type { LevelUp } from '@/engine/leveling';
import { navigate } from '@/router';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SANS = 'var(--font-sans)';
const SERIF = "'EB Garamond', var(--font-display)";

interface BreakdownRow {
  topic_id: string;
  points_earned: number;
  points_possible: number;
  errors: { type: ErrorType; description: string }[];
}

/**
 * Add exam result — Document 4 E5-S1 + BYO-AI Usability Fallback.
 * Provides a 2-mode view:
 *  1. Quick Form: Direct UI form for logging exam scores and per-topic breakdowns
 *     without requiring external AI JSON formatting.
 *  2. Paste JSON: The original PasteValidateInput workflow for pasting raw LLM JSON.
 */
export function AddExam({
  store,
  commitValue,
  undoLast,
}: {
  store: Store;
  commitValue: (
    schemaName: 'exam',
    value: unknown,
    onLevelUps?: (ups: LevelUp[]) => void,
  ) => string | null;
  undoLast: () => string | null;
}) {
  const { toast } = useToast();
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  const availableTopics = allTopics(store).map((t) => ({
    topic_id: t.topic.topic_id,
    title: t.topic.title,
    courseTitle: t.course.title,
  }));

  const [modeTab, setModeTab] = useState<'form' | 'paste'>('form');

  // Quick Form State
  const [title, setTitle] = useState('Exam Result');
  const [dateStr, setDateStr] = useState(() => todayLocalDateInput());
  const [isCold, setIsCold] = useState(true);

  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(availableTopics[0]?.topic_id ?? '');
  const [earnedInput, setEarnedInput] = useState<number>(8);
  const [possibleInput, setPossibleInput] = useState<number>(10);
  const [errType, setErrType] = useState<ErrorType>('conceptual');
  const [errDesc, setErrDesc] = useState<string>('');
  const [stagedErrors, setStagedErrors] = useState<{ type: ErrorType; description: string }[]>([]);

  const addStagedError = () => {
    if (!errDesc.trim()) return;
    setStagedErrors((prev) => [...prev, { type: errType, description: errDesc.trim() }]);
    setErrDesc('');
  };

  const removeStagedError = (idx: number) => {
    setStagedErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    if (!selectedTopicId) {
      toast('Please select a topic', 'error');
      return;
    }
    if (possibleInput <= 0) {
      toast('Points possible must be greater than 0', 'error');
      return;
    }
    if (earnedInput < 0) {
      toast('Points earned cannot be negative', 'error');
      return;
    }
    if (earnedInput > possibleInput) {
      toast('Points earned cannot exceed points possible', 'error');
      return;
    }

    setRows((prev) => [
      ...prev,
      {
        topic_id: selectedTopicId,
        points_earned: earnedInput,
        points_possible: possibleInput,
        errors: [...stagedErrors],
      },
    ]);

    setStagedErrors([]);
    setErrDesc('');
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalEarned = rows.reduce((a, r) => a + r.points_earned, 0);
  const totalPossible = rows.reduce((a, r) => a + r.points_possible, 0);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast('Please enter an exam title', 'error');
      return;
    }

    if (rows.length === 0) {
      toast('Please add at least one topic score to the breakdown', 'error');
      return;
    }

    const linked_topic_ids = Array.from(new Set(rows.map((r) => r.topic_id)));

    const breakdown: ExamBreakdownEntry[] = rows.map((r) => ({
      topic_id: r.topic_id,
      points_earned: r.points_earned,
      points_possible: r.points_possible,
      ...(r.errors.length > 0
        ? {
            errors: r.errors.map((err) => ({
              error_type: err.type,
              description: err.description,
            })),
          }
        : {}),
    }));

    const examPayload: Exam = {
      schema_version: '1.0',
      exam_id: `exam_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      title: title.trim(),
      date: localDateInputToISO(dateStr),
      linked_topic_ids,
      score: totalEarned,
      max_score: totalPossible,
      cold: isCold,
      breakdown,
    };

    const error = commitValue('exam', examPayload, (ups) => {
      for (const up of ups) {
        toast(`${up.topic.title} reached level ${up.to}`, 'success');
      }
    });

    if (error) {
      toast(error, 'error');
      return;
    }

    toast(COMMIT_VERB.exam, 'success', {
      label: 'Undo',
      onClick: () => {
        const err = undoLast();
        toast(err ?? 'Undone.', err ? 'error' : 'info');
      },
    });
    navigate('/exams');
  };

  return (
    <div className="content">
      <div className="breadcrumb">
        <span>Exams</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="current">Add exam result</span>
      </div>
      <div className="page-head">
        <p style={{ margin: 0, fontSize: '15px', color: theme.muted }}>
          Record graded paper scores and per-topic breakdowns. Objective test pass/fail indicators are automatically derived by the engine.
        </p>
      </div>

      <div className="section" style={{ marginTop: '16px' }}>
        <Card style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button
              type="button"
              data-press
              aria-pressed={modeTab === 'form'}
              onClick={() => setModeTab('form')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '9999px',
                border: `2px solid ${theme.border}`,
                background: modeTab === 'form' ? theme.pine : 'transparent',
                color: modeTab === 'form' ? theme.onAccent : theme.ink,
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: SANS,
              }}
            >
              Quick Form
            </button>
            <button
              type="button"
              data-press
              aria-pressed={modeTab === 'paste'}
              onClick={() => setModeTab('paste')}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: '9999px',
                border: `2px solid ${theme.border}`,
                background: modeTab === 'paste' ? theme.pine : 'transparent',
                color: modeTab === 'paste' ? theme.onAccent : theme.ink,
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: SANS,
              }}
            >
              Paste JSON
            </button>
          </div>

          {modeTab === 'form' ? (
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ flex: 2, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted }}>
                  Exam Title
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Physics Midterm"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `2px solid ${theme.border}`,
                      background: theme.surfaceAlt,
                      color: theme.ink,
                      fontFamily: SANS,
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  />
                </label>

                <label style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted }}>
                  Date
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: `2px solid ${theme.border}`,
                      background: theme.surfaceAlt,
                      color: theme.ink,
                      fontFamily: SANS,
                      fontSize: '13.5px',
                      fontWeight: 600,
                    }}
                  />
                </label>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: theme.surfaceAlt,
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1.5px solid ${theme.border}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={isCold}
                  onChange={(e) => setIsCold(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: theme.ink }}>Cold Sitting</strong>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Unaided attempt sat without recent review or mark scheme peeking</span>
                </div>
              </label>

              {/* ── Topic Score Add Section ────────────────────────────── */}
              <div style={{ background: theme.surfaceAlt, border: `1.5px solid ${theme.border}`, borderRadius: '14px', padding: '16px' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: theme.pine, marginBottom: '12px' }}>
                  ＋ Add Topic Breakdown Row
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted }}>
                    Topic
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${theme.border}`,
                        background: theme.surface,
                        color: theme.ink,
                        fontFamily: SANS,
                        fontSize: '13.5px',
                        fontWeight: 600,
                      }}
                    >
                      {availableTopics.map((t) => (
                        <option key={t.topic_id} value={t.topic_id}>
                          {t.courseTitle} → {t.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted }}>
                      Points Earned
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={earnedInput}
                        onChange={(e) => setEarnedInput(Number(e.target.value))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.border}`,
                          background: theme.surface,
                          color: theme.ink,
                          fontSize: '14px',
                          fontWeight: 700,
                        }}
                      />
                    </label>

                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted }}>
                      Points Possible
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        value={possibleInput}
                        onChange={(e) => setPossibleInput(Number(e.target.value))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${theme.border}`,
                          background: theme.surface,
                          color: theme.ink,
                          fontSize: '14px',
                          fontWeight: 700,
                        }}
                      />
                    </label>
                  </div>

                  {/* Optional Error Tagging */}
                  <div style={{ background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: '8px', padding: '10px' }}>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted, marginBottom: '6px' }}>
                      Tag Mistakes for this Topic ({stagedErrors.length})
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={errType}
                        onChange={(e) => setErrType(e.target.value as ErrorType)}
                        style={{ padding: '5px 8px', borderRadius: '6px', border: `1px solid ${theme.border}`, fontSize: '12px' }}
                      >
                        <option value="conceptual">conceptual</option>
                        <option value="procedural">procedural</option>
                        <option value="careless">careless</option>
                        <option value="knowledge_gap">knowledge_gap</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Error description..."
                        value={errDesc}
                        onChange={(e) => setErrDesc(e.target.value)}
                        style={{ flex: 1, minWidth: '120px', padding: '5px 8px', borderRadius: '6px', border: `1px solid ${theme.border}`, fontSize: '12px' }}
                      />
                      <button
                        type="button"
                        onClick={addStagedError}
                        style={{ background: theme.pine, color: theme.onAccent, border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        + Tag
                      </button>
                    </div>

                    {stagedErrors.map((err, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11.5px' }}>
                        <span style={{ fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>{err.type}</span>
                        <span style={{ color: theme.ink, flex: 1 }}>{err.description}</span>
                        <button type="button" onClick={() => removeStagedError(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                      </div>
                    ))}
                  </div>

                  <Button type="button" onClick={addRow} style={{ marginTop: '4px' }}>
                    Add Topic Score to Breakdown
                  </Button>
                </div>
              </div>

              {/* ── Added Breakdown Summary Table ─────────────────────── */}
              {rows.length > 0 && (
                <div style={{ background: theme.surfaceAlt, borderRadius: '12px', padding: '14px', border: `1.5px solid ${theme.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: theme.muted }}>
                      Breakdown Summary ({rows.length} {rows.length === 1 ? 'topic' : 'topics'})
                    </span>
                    <span style={{ fontFamily: SERIF, fontSize: '18px', fontWeight: 700, color: theme.pine }}>
                      Total: {totalEarned} / {totalPossible} ({totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {rows.map((row, idx) => {
                      const topicObj = availableTopics.find((t) => t.topic_id === row.topic_id);
                      const pct = row.points_possible > 0 ? Math.round((row.points_earned / row.points_possible) * 100) : 0;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: theme.surface,
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                          }}
                        >
                          <div>
                            <strong style={{ display: 'block', fontSize: '13px', color: theme.ink }}>
                              {topicObj?.title ?? row.topic_id}
                            </strong>
                            <span style={{ fontSize: '11px', color: theme.muted }}>
                              {topicObj?.courseTitle} · {row.errors.length} {row.errors.length === 1 ? 'error' : 'errors'} tagged
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontFamily: SERIF, fontSize: '16px', fontWeight: 700, color: theme.ink }}>
                              {row.points_earned} / {row.points_possible} ({pct}%)
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRow(idx)}
                              style={{ background: 'none', border: 'none', color: theme.error, cursor: 'pointer', fontWeight: 700 }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <SecondaryButton type="button" onClick={() => navigate('/exams')} style={{ flex: 1 }}>
                  Cancel
                </SecondaryButton>
                <Button type="submit" style={{ flex: 2 }}>
                  Add exam result
                </Button>
              </div>
            </form>
          ) : (
            <PasteValidateInput
              schemaName="exam"
              store={store}
              prompt={examPrompt(store)}
              confirmLabel="Add exam result"
              onCommit={(value) => {
                const error = commitValue('exam', value, (ups) => {
                  for (const up of ups) {
                    toast(`${up.topic.title} reached level ${up.to}`, 'success');
                  }
                });
                if (error) {
                  toast(error, 'error');
                  return;
                }
                toast(COMMIT_VERB.exam, 'success', {
                  label: 'Undo',
                  onClick: () => {
                    const err = undoLast();
                    toast(err ?? 'Undone.', err ? 'error' : 'info');
                  },
                });
                navigate('/exams');
              }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
