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

/** Semi-transparent tint of a hex theme colour — the ambient scene layers washes
 *  of the palette over the page without introducing new colours. */
function tintRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const STONE_COLORS = (t: CairnTheme) => [t.pine, t.orange, t.lavender, t.pine, t.orange];
const SPARKLE_COLORS = (t: CairnTheme) => [t.pine, t.orange, t.lavender];

/**
 * FocusMode — the distraction-light view a learner sits in while actually
 * studying, dressed as a calm sunlit scene (ported from the approved
 * FocusMode.dc.html design): a drifting sky + hills + cairn backdrop, a
 * breathing "stone pool" holding the clock, and a row of stones that fill as
 * focus accumulates.
 *
 * Presentation only — the logic is unchanged: a big timer (seeded from the
 * draft's elapsed seconds so a reload doesn't lose progress), pause/resume, and
 * an unresolved-errors checklist that is LOCAL-ONLY (ticking a box never writes
 * to the store — the real resolution record comes from the AI's session log at
 * wrap-up). The draft (elapsed + ticks) is persisted on change so a refresh
 * mid-session resumes cleanly. Ambient motion respects prefers-reduced-motion
 * (see cairn-mock.css) and stays transform/opacity-only for a light paint cost.
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
  const t = getCairnTheme(isDark);

  const timer = useStudyTimer({ mode: draft.timer_mode, pomodoro: draft.pomodoro, initialSeconds: draft.elapsed_seconds });
  const [checked, setChecked] = useState<string[]>(draft.checked_error_ids);

  useEffect(() => {
    saveFocusDraft({ ...draft, elapsed_seconds: timer.elapsedSeconds, checked_error_ids: checked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.elapsedSeconds, checked]);

  const toggle = (errorId: string) => {
    setChecked((prev) => (prev.includes(errorId) ? prev.filter((id) => id !== errorId) : [...prev, errorId]));
  };

  // A small happiness beat when a Pomodoro phase turns over (work↔break).
  const [celebrating, setCelebrating] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const prevPhaseRef = useRef(timer.phase);
  const celTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (draft.timer_mode !== 'pomodoro') return;
    if (timer.phase !== prevPhaseRef.current) {
      prevPhaseRef.current = timer.phase;
      setCelebrating(true);
      setCelebrateKey((k) => k + 1);
      clearTimeout(celTimer.current);
      celTimer.current = setTimeout(() => setCelebrating(false), 900);
    }
  }, [timer.phase, draft.timer_mode]);
  useEffect(() => () => clearTimeout(celTimer.current), []);

  const isPomodoro = draft.timer_mode === 'pomodoro';
  const isBreak = isPomodoro && timer.phase !== 'work';
  const accent = isBreak ? t.lavender : t.pine;
  const phaseTint = isBreak ? t.lavender : t.orange;

  // Stones fill one per 5 worked minutes, five to a "session" of 25 — a gentle
  // sense of progress that reads the real worked-seconds counter (count-up and
  // Pomodoro alike, since break time never accrues).
  const worked = timer.elapsedSeconds;
  const sessionNum = Math.floor(worked / 1500) + 1;
  const filledCount = Math.floor((worked % 1500) / 300);
  const stoneColors = STONE_COLORS(t);

  const moodLine = !isPomodoro
    ? 'Just you and the page.'
    : isBreak
      ? "Breathe. You've earned this."
      : 'Settle in — this one’s yours.';

  return (
    <div style={pageStyle(t)}>
      {/* Ambient scene — decorative, non-interactive, clipped to the page. */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }} aria-hidden>
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 0, transition: 'background 1.6s ease',
            background: `linear-gradient(180deg, ${t.bg} 0%, ${tintRgba(phaseTint, isDark ? 0.1 : 0.16)} 78%, ${tintRgba(phaseTint, isDark ? 0.16 : 0.24)} 100%)`,
          }}
        />
        <div data-drift style={cloudStyle(t, isDark, 1)} />
        <div data-drift style={cloudStyle(t, isDark, 2)} />
        <div style={hillStyle(t, isDark, 'back')} />
        <div style={hillStyle(t, isDark, 'front')} />
        <div style={{ position: 'absolute', bottom: '11%', right: '14%', display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: '2px', zIndex: 0, opacity: isDark ? 0.5 : 0.55 }}>
          {[30, 22, 15].map((sz, i) => (
            <div key={i} style={{ width: `${sz}px`, height: `${sz * 0.62}px`, borderRadius: '50% 50% 45% 45% / 60% 60% 40% 40%', background: t.muted }} />
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={cardStyle(t)}>
          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, margin: '0 0 6px' }}>
              {INTENT_LABEL[draft.intent]} session
            </p>
            <h1 style={{ fontFamily: SERIF, fontSize: '28px', color: t.ink, margin: 0, lineHeight: 1.15 }}>{draft.topic_title}</h1>
          </div>

          {/* Breathing stone pool holding the clock */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 22px' }}>
            <div
              data-breathe
              style={{
                width: '270px', height: '270px', boxSizing: 'border-box',
                borderRadius: isBreak ? '52% 48% 46% 54% / 48% 44% 56% 52%' : '46% 54% 58% 42% / 54% 42% 58% 46%',
                background: tintRgba(accent, isDark ? 0.22 : isBreak ? 0.28 : 0.16),
                border: `2px solid ${t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                transform: 'rotate(0.8deg)',
                animation: `${isBreak ? 'cairn-breathe-deep' : 'cairn-breathe'} ${isBreak ? '9s' : '6s'} ease-in-out infinite`,
                transition: 'background 1.2s ease, border-radius 1.2s ease',
              }}
            >
              {isPomodoro && (
                <p style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, margin: 0 }}>
                  {PHASE_LABEL[timer.phase]}
                </p>
              )}
              <div style={{ fontFamily: SANS, fontSize: '58px', fontWeight: 700, color: t.ink, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {formatClock(timer.elapsedSeconds)}
              </div>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '14px', color: t.muted, margin: '2px 0 6px' }}>{moodLine}</p>
              <button type="button" data-press onClick={timer.running ? timer.pause : timer.resume} style={pauseBtnStyle(t)}>
                {timer.running ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          {/* Stone-progress row */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
              {[0, 1, 2, 3, 4].map((i) => {
                const filled = i < filledCount;
                const justFilled = filled && i === filledCount - 1;
                return (
                  <div
                    key={i}
                    data-stonepop={justFilled ? '' : undefined}
                    style={{
                      width: '20px', height: '16px', borderRadius: '50% 50% 45% 45% / 65% 65% 35% 35%',
                      background: filled ? stoneColors[i] : 'transparent',
                      border: filled ? `2px solid ${t.border}` : `2px dashed ${t.muted}`,
                      opacity: filled ? 1 : 0.5,
                      animation: justFilled ? 'cairn-stone-pop 0.5s cubic-bezier(0.2,0.8,0.3,1) both' : 'none',
                    }}
                  />
                );
              })}
            </div>
            <p style={{ fontFamily: SANS, fontSize: '12px', color: t.muted, textAlign: 'center', margin: 0 }}>
              Session {sessionNum} · {filledCount} of 5 stones placed
            </p>
          </div>

          {/* Unresolved-errors checklist (local focus aid only) */}
          {unresolvedErrors.length > 0 ? (
            <div style={{ marginBottom: '10px' }}>
              <p style={sectionLabelStyle(t)}>Keep an eye on</p>
              {unresolvedErrors.map((err) => {
                const isChecked = checked.includes(err.error_id);
                return (
                  <label key={err.error_id} style={checklistRowStyle(t, isDark, isChecked)}>
                    <span
                      aria-hidden
                      data-checkpop={isChecked ? '' : undefined}
                      style={{
                        width: '19px', height: '19px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${t.border}`, background: isChecked ? t.pine : t.surface,
                        animation: isChecked ? 'cairn-check-settle 0.35s cubic-bezier(0.2,0.8,0.3,1) both' : 'none',
                      }}
                    >
                      {isChecked && <span style={{ color: t.onAccent, fontSize: '12px', fontWeight: 700, lineHeight: 1 }}>✓</span>}
                    </span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(err.error_id)}
                      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 }}
                    />
                    <span style={{ fontFamily: SANS, fontSize: '14px', color: t.ink, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.65 : 1 }}>
                      {err.description}
                    </span>
                  </label>
                );
              })}
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '12px', color: t.muted, margin: '10px 0 0' }}>
                Ticking is just for focus — your AI's session log records what actually changed.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '18px 10px', marginBottom: '10px', background: t.surfaceAlt, border: `1px dashed ${t.muted}`, borderRadius: '16px' }}>
              <div style={{ width: '26px', height: '20px', borderRadius: '50% 50% 45% 45% / 65% 65% 35% 35%', background: t.pine, opacity: isDark ? 0.85 : 1 }} />
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '14px', color: t.muted, margin: 0, textAlign: 'center' }}>
                Nothing to flag right now — full presence today.
              </p>
            </div>
          )}

          <button
            type="button"
            data-press
            onClick={() => onEnd(Math.floor(timer.elapsedSecondsRef.current / 60))}
            style={primaryBtnStyle(t)}
          >
            End session
          </button>
          <button type="button" data-press onClick={onDiscard} style={discardBtnStyle(t)}>
            Discard
          </button>
        </div>
      </div>

      {celebrating && (
        <div key={celebrateKey} aria-hidden style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: '260px', height: '80px', pointerEvents: 'none', zIndex: 2 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              data-sparkle
              style={{
                position: 'absolute', left: `${10 + i * 42}px`, top: `${i % 2 === 0 ? 10 : 30}px`,
                width: '10px', height: '10px', borderRadius: '50%', background: SPARKLE_COLORS(t)[i % 3],
                animation: `cairn-sparkle-pop 0.9s ease-out ${(i * 0.05).toFixed(2)}s both`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function pageStyle(t: CairnTheme): CSSProperties {
  return { position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box', fontFamily: SANS, background: t.bg };
}
function cloudStyle(t: CairnTheme, isDark: boolean, which: 1 | 2): CSSProperties {
  const base: CSSProperties = { position: 'absolute', borderRadius: '48% 52% 45% 55% / 55% 45% 58% 42%', zIndex: 0 };
  return which === 1
    ? { ...base, top: '12%', left: '8%', width: '220px', height: '80px', background: tintRgba(t.lavender, isDark ? 0.14 : 0.35), animation: 'cairn-drift1 48s ease-in-out infinite alternate' }
    : { ...base, top: '20%', right: '10%', width: '160px', height: '60px', background: tintRgba(t.orange, isDark ? 0.1 : 0.28), animation: 'cairn-drift2 62s ease-in-out infinite alternate' };
}
function hillStyle(t: CairnTheme, isDark: boolean, which: 'back' | 'front'): CSSProperties {
  return which === 'back'
    ? { position: 'absolute', left: '-10%', right: '-10%', bottom: '-6%', height: '38%', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', background: tintRgba(t.pine, isDark ? 0.16 : 0.09), zIndex: 0 }
    : { position: 'absolute', left: '-15%', right: '-15%', bottom: '-10%', height: '26%', borderRadius: '50% 50% 0 0 / 100% 100% 0 0', background: tintRgba(t.pine, isDark ? 0.24 : 0.15), zIndex: 0 };
}
function cardStyle(t: CairnTheme): CSSProperties {
  return { position: 'relative', width: '480px', maxWidth: '100%', background: t.surface, border: `2px solid ${t.border}`, borderRadius: '26px 8px 26px 8px', padding: '32px 32px 28px', boxShadow: `9px 10px 0 ${t.shadow}`, boxSizing: 'border-box', transform: 'rotate(-0.6deg)' };
}
function pauseBtnStyle(t: CairnTheme): CSSProperties {
  return { background: t.surface, color: t.ink, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '9px 22px', fontFamily: SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: `3px 3px 0 ${t.shadow}` };
}
function sectionLabelStyle(t: CairnTheme): CSSProperties {
  return { fontFamily: SANS, fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, margin: '0 0 10px' };
}
function checklistRowStyle(t: CairnTheme, isDark: boolean, isChecked: boolean): CSSProperties {
  return { position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', background: isChecked ? tintRgba(t.pine, isDark ? 0.18 : 0.1) : t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '8px', cursor: 'pointer', transition: 'background 0.2s ease' };
}
function primaryBtnStyle(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '18px', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px', fontFamily: SANS, fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
function discardBtnStyle(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginTop: '8px', background: 'none', border: 'none', padding: '8px', fontFamily: SANS, fontSize: '13px', fontWeight: 600, color: t.muted, cursor: 'pointer', textDecoration: 'underline' };
}
