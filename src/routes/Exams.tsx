import { useState, useEffect, type CSSProperties } from 'react';
import type { Store } from '@/domain/types';
import type { AssessmentDefinition, AssessmentAttempt } from '@/domain/assessment';
import { examViews } from '@/engine/exams';
import { readinessForAssessment } from '@/engine/readiness';
import { getAssessmentRepo } from '@/core/assessment-store';
import { mergeAttempt } from '@/core/assessment-merge';
import { cloneStore } from '@/core/storage';
import { useToast } from '@/components/feedback';
import { navigate } from '@/router';
import { useTheme } from '@/theme/useTheme';
import { errorTypeColor, errorTypeLabel, getCairnTheme, scoreColor, type CairnTheme } from '@/theme/cairnMock';
import { AssessmentSittingModal } from '@/components/AssessmentSittingModal';
import { ReadinessCard } from '@/components/ReadinessCard';
import { ErrorIntelligencePanel } from '@/components/ErrorIntelligencePanel';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

type ExamView = ReturnType<typeof examViews>[number];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface ExamsProps {
  store: Store;
  replaceStore?: (next: Store) => string | null;
}

/**
 * Exams — rebuilt to the approved mockup: rotated graded-paper cards with a
 * rotated score chip, a pass-mark track, and per-part rows (name + track,
 * marks, error-type tag, boosted / flagged-weak). Real examViews data + Assessment Repo.
 */
export function Exams({ store, replaceStore }: ExamsProps) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const { toast } = useToast();
  const views = examViews(store);

  const [definitions, setDefinitions] = useState<AssessmentDefinition[]>([]);
  const [activeDefForSitting, setActiveDefForSitting] = useState<AssessmentDefinition | null>(null);

  useEffect(() => {
    getAssessmentRepo()
      .allDefinitions()
      .then(setDefinitions)
      .catch(() => {});
  }, []);

  const handleStartSitting = (assessmentId: string) => {
    const def = definitions.find((d) => d.assessment_id === assessmentId);
    if (def) {
      setActiveDefForSitting(def);
    } else {
      toast('Assessment definition is loading or unavailable.', 'error');
    }
  };

  const handleSubmitAttempt = async (attempt: AssessmentAttempt) => {
    if (!activeDefForSitting) return;
    try {
      const repo = getAssessmentRepo();
      await repo.putAttempt(attempt);
      const draft = cloneStore(store);
      mergeAttempt(draft, activeDefForSitting, attempt);
      if (replaceStore) {
        replaceStore(draft);
      }
      setActiveDefForSitting(null);
      toast('Assessment attempt submitted! Question evidence recorded and un-smeared.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to record attempt.', 'error');
    }
  };

  if (views.length === 0 && store.assessment_refs.length === 0) {
    return (
      <div style={contentStyle()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 20px', maxWidth: '420px', margin: '0 auto' }}>
          <svg width="140" height="170" viewBox="0 0 100 120" style={{ display: 'block', margin: '0 0 20px', animation: 'cairn-wobble 2.4s ease-in-out infinite', transformOrigin: '50% 100%' }}>
            <ellipse cx="50" cy="112" rx="30" ry="4" fill="#000000" opacity={isDark ? 0.28 : 0.18} />
            <rect x="18" y="90" width="64" height="22" rx="11" fill={theme.pine} transform="rotate(-3 50 101)" />
            <rect x="26" y="66" width="48" height="20" rx="10" fill={theme.lavender} transform="rotate(3 50 76)" />
            <circle cx="50" cy="42" r="20" fill={theme.orange} />
          </svg>
          <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '32px', color: theme.ink, margin: '0 0 8px' }}>No exams yet.</h2>
          <p style={{ fontSize: '15px', color: theme.muted, margin: '0 0 24px' }}>
            Add one and we’ll track its effect on your topics as marks come in.
          </p>
          <button type="button" data-press onClick={() => navigate('/exams/add')} style={ctaStyle(theme)}>
            ＋ Add an exam result
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={contentStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: theme.muted }}>
          {views.length} {views.length === 1 ? 'paper' : 'papers'} logged · {store.assessment_refs.length} assessment definitions
        </span>
        <button type="button" data-press onClick={() => navigate('/exams/add')} style={addBtn(theme)}>
          ＋ Add paper / assessment
        </button>
      </div>

      {/* ── Past Paper Assessments & Readiness ──────────────────── */}
      {store.assessment_refs.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontFamily: SERIF, fontSize: '24px', margin: '0 0 16px 0', color: theme.ink }}>
            Past Paper Assessments &amp; Readiness
          </h3>
          {store.assessment_refs.map((ref) => {
            const report = readinessForAssessment(ref, store, new Date());
            return (
              <div key={ref.assessment_id} style={{ marginBottom: '20px' }}>
                <ReadinessCard report={report} title={ref.title} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    data-press
                    onClick={() => handleStartSitting(ref.assessment_id)}
                    style={{
                      background: theme.orange,
                      border: `2px solid ${theme.border}`,
                      borderRadius: '9999px',
                      padding: '10px 22px',
                      fontFamily: SANS,
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: '#1a1a1a',
                      cursor: 'pointer',
                      boxShadow: `3px 3px 0 ${theme.shadow}`,
                    }}
                  >
                    Sit &amp; Mark Assessment →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Legacy Aggregate Exams ──────────────────────────────── */}
      {views.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontFamily: SERIF, fontSize: '24px', margin: '0 0 16px 0', color: theme.ink }}>
            Exam Results History
          </h3>
          {views.map((view, i) => (
            <ExamCard key={view.exam.exam_id} view={view} i={i} theme={theme} />
          ))}
        </div>
      )}

      {/* ── Error Intelligence Section ──────────────────────────── */}
      <div style={{ marginTop: '40px' }}>
        <ErrorIntelligencePanel store={store} />
      </div>

      {/* ── Sitting Modal ────────────────────────────────────────── */}
      {activeDefForSitting && (
        <AssessmentSittingModal
          definition={activeDefForSitting}
          onSubmitAttempt={handleSubmitAttempt}
          onClose={() => setActiveDefForSitting(null)}
        />
      )}
    </div>
  );
}

function ExamCard({ view, i, theme }: { view: ExamView; i: number; theme: CairnTheme }) {
  const { exam, scorePct, groups } = view;
  const ratio = scorePct / 100;
  const col = scoreColor(ratio, theme);
  const topicCount = groups.reduce((a, g) => a + g.topics.length, 0);

  return (
    <div
      data-card
      style={{
        background: theme.surface, border: `2px solid ${theme.border}`,
        borderRadius: i % 2 === 0 ? '16px 40px 16px 40px' : '40px 16px 40px 16px', padding: '22px 24px',
        marginBottom: '20px', boxShadow: `5px 6px 0 ${theme.shadow}`, transform: `rotate(${i % 2 === 0 ? '-0.3deg' : '0.3deg'})`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', marginBottom: '14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: '23px', color: theme.ink, margin: '0 0 8px', lineHeight: 1.15 }}>{exam.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: theme.ink, background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: '9999px', padding: '2px 10px' }}>
              {fmtDate(exam.date)}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: theme.muted }}>
              Covers: {groups.map((g) => g.courseTitle).join(', ')} ({topicCount} {topicCount === 1 ? 'topic' : 'topics'})
            </span>
          </div>
        </div>
        <div
          style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minWidth: '92px', padding: '10px 14px', borderRadius: '9999px', background: col,
            color: ratio >= 0.8 ? theme.onAccent : '#1a1a1a', border: `2px solid ${theme.border}`,
            boxShadow: `3px 3px 0 ${theme.shadow}`, transform: 'rotate(-3deg)',
          }}
        >
          <span style={{ fontFamily: SERIF, fontSize: '22px', lineHeight: 1.05, whiteSpace: 'nowrap' }}>
            {exam.score}/{exam.max_score}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.75, marginTop: '1px' }}>{scorePct}%</span>
        </div>
      </div>

      <div style={{ position: 'relative', height: '8px', borderRadius: '9999px', background: theme.surfaceAlt, border: `1px solid ${theme.border}`, marginBottom: '16px', overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${scorePct}%`, borderRadius: '9999px', background: col }} />
        <div style={{ position: 'absolute', top: '-4px', bottom: '-4px', left: '70%', width: '2px', background: theme.ink, opacity: 0.45, borderRadius: '2px' }} />
      </div>

      {groups.map((group) => (
        <div key={group.courseId ?? group.courseTitle} style={{ display: 'flex', flexDirection: 'column' }}>
          {groups.length > 1 && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: theme.muted, margin: '4px 0 6px' }}>{group.courseTitle}</div>
          )}
          {group.topics.map((part) => {
            const hasMarks = part.earned !== null && part.possible !== null;
            const r = hasMarks && part.possible ? part.earned! / part.possible : ratio;
            const boosted = part.effect === 'boosted';
            const partCol = scoreColor(r, theme);
            const firstError = part.errors && part.errors.length > 0 ? errorTypeLabel(part.errors[0]!.error_type) : null;
            return (
              <div
                key={part.topicId}
                style={{ display: 'grid', gridTemplateColumns: '1fr 62px 168px', alignItems: 'center', gap: '12px', padding: '9px 10px', margin: '0 -10px', borderRadius: '10px', borderBottom: `1px solid ${theme.border}` }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{part.title}</span>
                  {hasMarks && (
                    <div style={{ height: '4px', borderRadius: '9999px', background: theme.surfaceAlt, overflow: 'hidden', maxWidth: '220px' }}>
                      <div style={{ width: `${Math.round(r * 100)}%`, height: '100%', borderRadius: '9999px', background: partCol }} />
                    </div>
                  )}
                </div>
                <span style={{ fontFamily: SERIF, fontSize: '17px', color: hasMarks ? partCol : theme.muted, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {hasMarks ? `${part.earned}/${part.possible}` : '—'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                  {firstError && (
                    <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap', background: errorTypeColor(firstError, theme), color: firstError === 'Careless' || firstError === 'Conceptual' ? '#ffffeb' : '#1a1a1a' }}>
                      {firstError}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', color: boosted ? theme.pine : theme.error }}>
                    {boosted ? '▲ boosted' : '▼ flagged weak'}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function contentStyle(): CSSProperties {
  return { flex: 1, width: '100%', maxWidth: '1440px', boxSizing: 'border-box', padding: '36px 40px 56px', position: 'relative' };
}
function addBtn(t: CairnTheme): CSSProperties {
  return { marginLeft: 'auto', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '12px 20px', fontFamily: SANS, fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: `3px 3px 0 ${t.shadow}` };
}
function ctaStyle(t: CairnTheme): CSSProperties {
  return { background: t.lavender, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px 24px', fontSize: '15px', fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
