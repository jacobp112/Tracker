import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useToast } from '@/components/feedback';
import { buildSessionContext, startSessionPrompt } from '@/engine/session';
import type { Course, Section, SessionIntent, SessionScope, Topic } from '@/domain/types';
import type { PomodoroConfig, TimerMode } from '@/hooks/useStudyTimer';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme, type CairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

const INTENT_LABEL: Record<SessionIntent, string> = {
  remediate: 'Remediate',
  retention: 'Retention',
  new_content: 'New content',
  adaptive: 'Adaptive',
};

const SCOPE_LABEL: Record<SessionScope, string> = {
  clean_slate: 'Clean slate',
  topic: 'This topic',
  section: 'This section',
  course: 'Whole course',
};

const DEFAULT_POMODORO: PomodoroConfig = { work_minutes: 25, break_minutes: 5, long_break_minutes: 15 };

/**
 * StartSession — the "before you dive in" briefing modal. Lets the learner
 * pick an intent + scope + timer mode, previews the exact AI briefing that
 * would be generated for that combination, and hands the chosen config back
 * to the caller via onBegin. Presentation only; the briefing text itself
 * comes straight from the real engine (buildSessionContext/startSessionPrompt).
 */
export function StartSession({
  course,
  section,
  topic,
  onBegin,
  onClose,
}: {
  course: Course;
  section: Section;
  topic: Topic;
  onBegin: (cfg: { intent: SessionIntent; scope: SessionScope; timer_mode: TimerMode; pomodoro?: PomodoroConfig }) => void;
  onClose: () => void;
}) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const { toast } = useToast();

  const [intent, setIntent] = useState<SessionIntent>('adaptive');
  const [scope, setScope] = useState<SessionScope>('topic');
  const [timerMode, setTimerMode] = useState<TimerMode>('count_up');
  const [pomodoro, setPomodoro] = useState<PomodoroConfig>(DEFAULT_POMODORO);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const prompt = useMemo(
    () => startSessionPrompt(buildSessionContext(course, section, topic, intent, scope, new Date()), intent, scope),
    [course, section, topic, intent, scope],
  );

  const copyPrompt = () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(prompt).catch(() => {});
    toast('Briefing copied');
  };

  const begin = () => {
    onBegin({ intent, scope, timer_mode: timerMode, pomodoro: timerMode === 'pomodoro' ? pomodoro : undefined });
  };

  const setPomodoroField = (field: keyof PomodoroConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value);
    setPomodoro((p) => ({ ...p, [field]: Number.isFinite(n) && n > 0 ? n : p[field] }));
  };

  return (
    <div style={overlay()} onClick={onClose}>
      <div
        style={card(theme)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Start session — ${topic.title}`}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: theme.pine, borderRadius: '24px 8px 0 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px', marginTop: '4px' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: '25px', color: theme.ink, margin: 0, flex: 1 }}>Start session</h2>
          <button type="button" data-press onClick={onClose} aria-label="Close" style={closeBtn(theme)}>✕</button>
        </div>

        <p style={{ fontSize: '13px', color: theme.muted, margin: '0 0 6px' }}>{course.title}</p>

        <Field label="Intent" theme={theme}>
          <ChoiceRow theme={theme} value={intent} labels={INTENT_LABEL} onChange={setIntent} />
        </Field>

        <Field label="Scope" theme={theme}>
          <ChoiceRow theme={theme} value={scope} labels={SCOPE_LABEL} onChange={setScope} />
        </Field>

        <Field label="Timer" theme={theme}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-press
              aria-pressed={timerMode === 'count_up'}
              onClick={() => setTimerMode('count_up')}
              style={choiceBtn(theme, timerMode === 'count_up')}
            >
              Count up
            </button>
            <button
              type="button"
              data-press
              aria-pressed={timerMode === 'pomodoro'}
              onClick={() => setTimerMode('pomodoro')}
              style={choiceBtn(theme, timerMode === 'pomodoro')}
            >
              Pomodoro
            </button>
          </div>
          {timerMode === 'pomodoro' && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              <NumberField label="Work (min)" value={pomodoro.work_minutes} onChange={setPomodoroField('work_minutes')} theme={theme} />
              <NumberField label="Break (min)" value={pomodoro.break_minutes} onChange={setPomodoroField('break_minutes')} theme={theme} />
              <NumberField label="Long break (min)" value={pomodoro.long_break_minutes} onChange={setPomodoroField('long_break_minutes')} theme={theme} />
            </div>
          )}
        </Field>

        <Field label="Briefing preview" theme={theme}>
          <pre style={previewBox(theme)}>{prompt}</pre>
          <button type="button" data-press onClick={copyPrompt} style={copyBtn(theme)}>Copy</button>
        </Field>

        <button type="button" data-press onClick={begin} style={primaryBtn(theme)}>Begin focus</button>
      </div>
    </div>
  );
}

function Field({ label, theme, children }: { label: string; theme: CairnTheme; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, margin: '0 0 8px' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function ChoiceRow<T extends string>({
  theme,
  value,
  labels,
  onChange,
}: {
  theme: CairnTheme;
  value: T;
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {(Object.keys(labels) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          data-press
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          style={choiceBtn(theme, value === key)}
        >
          {labels[key]}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  theme: CairnTheme;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: theme.muted }}>
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={onChange}
        style={{ width: '72px', border: `2px solid ${theme.border}`, borderRadius: '10px', padding: '6px 8px', fontFamily: SANS, fontSize: '13px', background: theme.inputBg, color: theme.ink }}
      />
    </label>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function overlay(): CSSProperties {
  // No backdrop-filter blur — paint-bound, see global.css .card rationale.
  return { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 90, padding: '20px' };
}
function card(t: CairnTheme): CSSProperties {
  return { position: 'relative', width: '560px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', background: t.surface, border: `2px solid ${t.border}`, borderRadius: '24px 8px 24px 8px', padding: '30px', boxShadow: `9px 10px 0 ${t.shadow}`, boxSizing: 'border-box', transform: 'rotate(-0.4deg)', animation: 'palette-in .22s cubic-bezier(.2,.8,.3,1)' };
}
function closeBtn(t: CairnTheme): CSSProperties {
  return { background: t.bg, border: `2px solid ${t.border}`, borderRadius: '9999px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '15px', color: t.ink, boxShadow: `2px 2px 0 ${t.shadow}` };
}
function choiceBtn(t: CairnTheme, selected: boolean): CSSProperties {
  return {
    border: `2px solid ${t.border}`,
    borderRadius: '9999px',
    padding: '8px 14px',
    fontFamily: SANS,
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    background: selected ? t.pine : 'none',
    color: selected ? t.onAccent : t.ink,
    boxShadow: selected ? `2px 2px 0 ${t.shadow}` : 'none',
  };
}
function copyBtn(t: CairnTheme): CSSProperties {
  return { background: t.lavender, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#1a1a1a', cursor: 'pointer', boxShadow: `2px 2px 0 ${t.shadow}`, marginTop: '10px' };
}
function primaryBtn(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '4px', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px', fontFamily: SANS, fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
function previewBox(t: CairnTheme): CSSProperties {
  return { background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: '14px', padding: '14px', fontFamily: 'monospace', fontSize: '12px', color: t.ink, whiteSpace: 'pre-wrap', maxHeight: '220px', overflowY: 'auto', margin: 0 };
}
