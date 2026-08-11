import { useEffect, useState, type CSSProperties } from 'react';
import { useToast, type ToastAction } from '@/components/feedback';
import { detectSchema } from '@/core/detect';
import { COMMIT_VERB, ingest, SCHEMA_LABEL, type Preview } from '@/core/pipeline';
import { COURSE_PROMPT, examPrompt, sessionPrompt } from '@/domain/prompts';
import { courseTopics } from '@/engine/course';
import type { SchemaName } from '@/domain/schemas';
import type { Course, Store } from '@/domain/types';
import { navigate } from '@/router';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme, type CairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

export type AddKind = SchemaName | 'quick';

type Step =
  | { name: 'editing' }
  | { name: 'invalid'; errors: string[] }
  | { name: 'preview'; schemaName: SchemaName; value: unknown; preview: Preview };

const KIND_TITLE: Record<AddKind, string> = {
  course: 'Add a course',
  exam: 'Add an exam',
  session: 'Log a session',
  quick: 'Quick add',
};

/**
 * The paste-to-add modal — rebuilt to the approved mockup as a single overlay
 * with editing → preview → invalid → success steps. Wired to the REAL pipeline
 * (schema detect, validate, commit); logic unchanged, presentation only.
 */
export function AddFlow({
  kind,
  courseId,
  store,
  commitValue,
  undoLast,
  onClose,
  onCommitOverride,
  promptOverride,
}: {
  kind: AddKind;
  courseId?: string;
  store: Store;
  commitValue: (schemaName: SchemaName, value: unknown) => string | null;
  undoLast: () => string | null;
  onClose: () => void;
  /**
   * When provided, routes the confirm step's commit through this instead of
   * the plain `commitValue(schemaName, value)` call — used by the
   * start-session flow to commit via `commitSession` (real measured duration,
   * appended SessionRecord) while leaving every other AddFlow caller on the
   * ordinary pipeline commit.
   */
  onCommitOverride?: (value: unknown) => string | null;
  /** When set, replaces the copy-out prompt (start-session flow shows a
   *  wrap-up prompt here instead of the standalone paste-a-transcript one). */
  promptOverride?: string;
}) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const { toast } = useToast();

  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ name: 'editing' });
  const [done, setDone] = useState<{ summary: string; dest: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const accent = { course: theme.pine, exam: theme.orange, session: theme.lavender, quick: theme.pine }[kind];

  const promptFor = (): string => {
    if (promptOverride) return promptOverride;
    if (kind === 'course') return COURSE_PROMPT;
    if (kind === 'exam') return examPrompt(store);
    if (kind === 'session') {
      const course = store.courses.find((c) => c.course_id === courseId) ?? store.courses[0];
      if (!course) return COURSE_PROMPT;
      const topics = courseTopics(course).map((r) => ({ topic_id: r.topic.topic_id, title: r.topic.title }));
      return sessionPrompt(course.course_id, topics);
    }
    return COURSE_PROMPT;
  };

  const copyPrompt = () => {
    const t = promptFor();
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).catch(() => {});
    toast('Prompt copied to clipboard');
  };

  const preview = () => {
    const raw = text.trim();
    if (!raw) return;
    let schemaName: SchemaName | null = kind === 'quick' ? null : kind;
    if (kind === 'quick') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setStep({ name: 'invalid', errors: ['That doesn’t look like valid JSON — paste the AI’s full reply, including the { } braces.'] });
        return;
      }
      schemaName = detectSchema(parsed);
      if (!schemaName) {
        setStep({ name: 'invalid', errors: ['That’s valid JSON, but not a shape Cairn knows. Use a prompt from an Add screen, then paste the reply.'] });
        return;
      }
    }
    const result = ingest(raw, schemaName!, store);
    if (result.ok) setStep({ name: 'preview', schemaName: result.schemaName, value: result.value, preview: result.preview });
    else setStep({ name: 'invalid', errors: result.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)) });
  };

  const confirm = (schemaName: SchemaName, value: unknown) => {
    const error = onCommitOverride ? onCommitOverride(value) : commitValue(schemaName, value);
    if (error) {
      toast(error, 'error');
      return;
    }
    const undo: ToastAction = {
      label: 'Undo',
      onClick: () => {
        const err = undoLast();
        toast(err ?? 'Undone.', err ? 'error' : 'info');
      },
    };
    toast(COMMIT_VERB[schemaName], 'success', undo);
    const summary = step.name === 'preview' ? step.preview.summary : 'Added';
    const dest =
      schemaName === 'course' ? `/course/${(value as Course).course_id}` : schemaName === 'exam' ? '/exams' : '/study';
    setDone({ summary, dest });
  };

  const finishDone = () => {
    const dest = done?.dest;
    onClose();
    if (dest) navigate(dest);
  };

  const showEditing = step.name === 'editing' && !done;
  const showPreview = step.name === 'preview' && !done;
  const showInvalid = step.name === 'invalid' && !done;

  return (
    <div style={overlay()} onClick={onClose}>
      <div style={card(theme)} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={KIND_TITLE[kind]}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: accent, borderRadius: '24px 8px 0 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', marginTop: '4px' }}>
          <span style={{ width: '40px', height: '40px', borderRadius: '9999px', background: accent, border: `2px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-4deg)', flexShrink: 0, boxShadow: `2px 2px 0 ${theme.shadow}`, fontWeight: 700, color: '#1a1a1a' }}>
            ＋
          </span>
          <h2 style={{ fontFamily: SERIF, fontSize: '25px', color: theme.ink, margin: 0, flex: 1 }}>{KIND_TITLE[kind]}</h2>
          <button type="button" data-press onClick={onClose} aria-label="Close" style={closeBtn(theme)}>✕</button>
        </div>

        {done ? (
          <>
            <div style={{ background: theme.surfaceAlt, borderRadius: '14px', padding: '18px', marginBottom: '8px' }}>
              <p style={{ fontSize: '15px', color: theme.ink, margin: '0 0 6px' }}>Added — {done.summary}</p>
              <button type="button" onClick={() => { undoLast(); toast('Undone — removed.', 'info'); onClose(); }} style={undoLink(theme)}>
                Undo
              </button>
            </div>
            <button type="button" data-press onClick={finishDone} style={primaryBtn(theme)}>Done</button>
          </>
        ) : showPreview && step.name === 'preview' ? (
          <>
            <div style={{ background: theme.surfaceAlt, borderRadius: '14px', padding: '18px', marginBottom: '8px' }}>
              <p style={{ fontSize: '15px', color: theme.ink, margin: '0 0 10px', fontWeight: 600 }}>{step.preview.summary}</p>
              {step.preview.detail.length > 0 && (
                <p style={{ fontSize: '13px', color: theme.muted, margin: '0 0 10px' }}>{step.preview.detail.join(' · ')}</p>
              )}
              <span style={schemaTag(theme)}>{SCHEMA_LABEL[step.schemaName]}</span>
            </div>
            <button type="button" data-press onClick={() => confirm(step.schemaName, step.value)} style={primaryBtn(theme)}>
              Confirm &amp; add
            </button>
            <button type="button" data-press onClick={() => setStep({ name: 'editing' })} style={secondaryBtn(theme)}>← Back</button>
          </>
        ) : showInvalid && step.name === 'invalid' ? (
          <>
            {step.errors.map((err, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: theme.surfaceAlt, borderRadius: '12px', padding: '12px 14px', marginBottom: '10px', fontSize: '13px', color: theme.ink }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: theme.error, border: `1px solid ${theme.error}`, borderRadius: '9999px', padding: '1px 7px', flexShrink: 0 }}>fix</span>
                <span>{err}</span>
              </div>
            ))}
            <button type="button" data-press onClick={() => setStep({ name: 'editing' })} style={primaryBtn(theme)}>Try again</button>
          </>
        ) : (
          showEditing && (
            <>
              {kind !== 'quick' && (
                <div style={{ background: theme.surfaceAlt, border: `2px dashed ${theme.border}`, borderRadius: '16px 6px 16px 6px', padding: '16px', marginBottom: '18px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '13px', color: theme.ink }}>
                    <span style={stepBadge(theme)}>1</span>Copy the prompt and paste it to your AI tutor.
                  </p>
                  <button type="button" data-press onClick={copyPrompt} style={copyBtn(theme)}>Copy the prompt</button>
                </div>
              )}
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: theme.ink }}>
                <span style={stepBadge(theme)}>{kind === 'quick' ? '1' : '2'}</span>
                Paste the AI’s JSON reply here.
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the AI’s reply here…"
                aria-label="Paste the JSON here"
                spellCheck={false}
                style={{ width: '100%', minHeight: '160px', boxSizing: 'border-box', border: `2px solid ${theme.border}`, borderRadius: '16px 6px 16px 6px', padding: '14px', fontFamily: SANS, fontSize: '14px', background: theme.inputBg, color: theme.ink, resize: 'vertical' }}
              />
              <button type="button" data-press onClick={preview} disabled={!text.trim()} style={{ ...primaryBtn(theme), opacity: text.trim() ? 1 : 0.5, cursor: text.trim() ? 'pointer' : 'not-allowed' }}>
                Preview
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function overlay(): CSSProperties {
  // No backdrop-filter blur — paint-bound, see global.css .card rationale.
  return { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: '20px' };
}
function card(t: CairnTheme): CSSProperties {
  return { position: 'relative', width: '520px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', background: t.surface, border: `2px solid ${t.border}`, borderRadius: '24px 8px 24px 8px', padding: '30px', boxShadow: `9px 10px 0 ${t.shadow}`, boxSizing: 'border-box', transform: 'rotate(-0.4deg)', animation: 'palette-in .22s cubic-bezier(.2,.8,.3,1)' };
}
function closeBtn(t: CairnTheme): CSSProperties {
  return { background: t.bg, border: `2px solid ${t.border}`, borderRadius: '9999px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '15px', color: t.ink, boxShadow: `2px 2px 0 ${t.shadow}` };
}
function stepBadge(t: CairnTheme): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '9999px', background: t.orange, color: '#1a1a1a', fontSize: '11px', fontWeight: 700, marginRight: '8px' };
}
function copyBtn(t: CairnTheme): CSSProperties {
  return { background: t.lavender, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#1a1a1a', cursor: 'pointer', boxShadow: `2px 2px 0 ${t.shadow}` };
}
function primaryBtn(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '16px', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px', fontFamily: SANS, fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
function secondaryBtn(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '10px', background: 'none', border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '12px', fontFamily: SANS, fontSize: '14px', fontWeight: 600, color: t.ink, cursor: 'pointer' };
}
function schemaTag(t: CairnTheme): CSSProperties {
  return { display: 'inline-block', fontSize: '11px', fontWeight: 700, color: t.muted, background: t.bg, border: `1px solid ${t.border}`, borderRadius: '9999px', padding: '3px 10px' };
}
function undoLink(t: CairnTheme): CSSProperties {
  return { fontSize: '13px', color: t.muted, textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none', padding: 0 };
}
