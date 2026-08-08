import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { FocusDraft } from '@/core/focusDraft';
import { saveFocusDraft } from '@/core/focusDraft';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme, type CairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

const INTENT_LABEL: Record<FocusDraft['intent'], string> = {
  remediate: 'Remediate',
  retention: 'Retention',
  new_content: 'New content',
  adaptive: 'Adaptive',
};

const PHASE_LABEL: Record<'work' | 'break' | 'long_break', string> = {
  work: 'Work',
  break: 'Break',
  long_break: 'Long break',
};

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * FocusMode — the distraction-light view a learner sits in while actually
 * studying. Big timer (seeded from the draft's elapsed seconds so a reload
 * doesn't lose progress), pause/resume, and an unresolved-errors checklist
 * that is LOCAL-ONLY: ticking a box never writes to the store — it's just a
 * personal "have I looked at this yet" aid. The real resolution record comes
 * from the AI's session log at wrap-up. The draft (elapsed + ticks) is
 * persisted on change so a refresh mid-session can resume cleanly.
 */
export function FocusMode({
  draft,
  unresolvedErrors,
  onEnd,
  onDiscard,
}: {
  draft: FocusDraft;
  unresolvedErrors: { error_id: string; description: string }[];
  onEnd: (measuredMinutes: number) => void;
  onDiscard: () => void;
}) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  const timer = useStudyTimer({ mode: draft.timer_mode, pomodoro: draft.pomodoro, initialSeconds: draft.elapsed_seconds });
  const [checked, setChecked] = useState<string[]>(draft.checked_error_ids);

  // useStudyTimer's own elapsedSeconds only reaches this component through a
  // React re-render, so reading it from an onClick closure can be a tick (or,
  // under batched/rapid updates, more) behind the true count. "End session"
  // reports a measured duration that feeds the study log, so it reads a plain
  // ref that this effect keeps ticking in lockstep with the same
  // running/phase conditions the hook itself uses — accurate the instant the
  // button is pressed, independent of render timing.
  const measuredRef = useRef(draft.elapsed_seconds);
  useEffect(() => {
    if (!timer.running || timer.phase !== 'work') return;
    const id = setInterval(() => { measuredRef.current += 1; }, 1000);
    return () => clearInterval(id);
  }, [timer.running, timer.phase]);

  useEffect(() => {
    saveFocusDraft({ ...draft, elapsed_seconds: timer.elapsedSeconds, checked_error_ids: checked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.elapsedSeconds, checked]);

  const toggle = (errorId: string) => {
    setChecked((prev) => (prev.includes(errorId) ? prev.filter((id) => id !== errorId) : [...prev, errorId]));
  };

  return (
    <div style={page(theme)}>
      <div style={card(theme)}>
        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, margin: '0 0 6px' }}>
          {INTENT_LABEL[draft.intent]} session
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: '30px', color: theme.ink, margin: '0 0 24px' }}>{draft.topic_title}</h1>

        <div style={{ textAlign: 'center', margin: '10px 0 28px' }}>
          <div style={{ fontFamily: SANS, fontSize: '64px', fontWeight: 700, color: theme.ink, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {formatClock(timer.elapsedSeconds)}
          </div>
          {draft.timer_mode === 'pomodoro' && (
            <p style={{ fontSize: '13px', fontWeight: 700, color: theme.muted, margin: '6px 0 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {PHASE_LABEL[timer.phase]}
            </p>
          )}
          <button type="button" data-press onClick={timer.running ? timer.pause : timer.resume} style={pauseBtn(theme)}>
            {timer.running ? 'Pause' : 'Resume'}
          </button>
        </div>

        {unresolvedErrors.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.muted, margin: '0 0 10px' }}>
              Keep an eye on
            </p>
            {unresolvedErrors.map((err) => (
              <label key={err.error_id} style={checklistRow(theme)}>
                <input
                  type="checkbox"
                  checked={checked.includes(err.error_id)}
                  onChange={() => toggle(err.error_id)}
                  style={{ width: '18px', height: '18px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '14px', color: theme.ink }}>{err.description}</span>
              </label>
            ))}
            <p style={{ fontSize: '12px', color: theme.muted, margin: '10px 0 0', fontStyle: 'italic' }}>
              Ticking is just for focus — your AI's session log records what actually changed.
            </p>
          </div>
        )}

        <button
          type="button"
          data-press
          onClick={() => onEnd(Math.floor(measuredRef.current / 60))}
          style={primaryBtn(theme)}
        >
          End session
        </button>
        <button type="button" data-press onClick={onDiscard} style={discardBtn(theme)}>
          Discard
        </button>
      </div>
    </div>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function page(t: CairnTheme): CSSProperties {
  return { minHeight: '100vh', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' };
}
function card(t: CairnTheme): CSSProperties {
  return { position: 'relative', width: '480px', maxWidth: '100%', background: t.surface, border: `2px solid ${t.border}`, borderRadius: '24px 8px 24px 8px', padding: '36px', boxShadow: `9px 10px 0 ${t.shadow}`, boxSizing: 'border-box' };
}
function pauseBtn(t: CairnTheme): CSSProperties {
  return { marginTop: '18px', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '10px 24px', fontFamily: SANS, fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: `3px 3px 0 ${t.shadow}` };
}
function checklistRow(t: CairnTheme): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: '10px', background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer' };
}
function primaryBtn(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '20px', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px', fontFamily: SANS, fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
function discardBtn(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '10px', background: 'none', border: 'none', padding: '8px', fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: t.muted, cursor: 'pointer', textDecoration: 'underline' };
}
