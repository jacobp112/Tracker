import { useEffect, type CSSProperties } from 'react';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

/**
 * Celebration — the mockup's "Set in stone." moment, shown when a topic is
 * promoted to Mastered. Presentation only; the promotion itself is the real
 * store action that triggered this.
 */
export function Celebration({ topicName, onClose }: { topicName: string; onClose: () => void }) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={overlay()} onClick={onClose}>
      <div style={card(theme)} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Topic mastered">
        <svg width="110" height="130" viewBox="0 0 100 120" style={{ margin: '0 auto', display: 'block' }}>
          <ellipse cx="50" cy="112" rx="30" ry="4" fill="#000000" opacity={isDark ? 0.28 : 0.18} />
          <rect x="18" y="90" width="64" height="22" rx="11" fill={theme.pine} transform="rotate(-3 50 101)" />
          <rect x="26" y="66" width="48" height="20" rx="10" fill={theme.lavender} transform="rotate(3 50 76)" />
          <circle cx="50" cy="42" r="20" fill={theme.orange} />
          <path d="M43 38 Q 44.5 35, 46 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <path d="M54 38 Q 55.5 35, 57 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          <path d="M42 45 Q 50 51, 58 45" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <h2 style={{ fontFamily: SERIF, fontSize: '30px', color: theme.ink, margin: '16px 0 8px' }}>Set in stone.</h2>
        <p style={{ fontSize: '15px', color: theme.muted, margin: '0 0 24px' }}>
          {topicName} just reached Mastered. That’s one less thing to worry about.
        </p>
        <button type="button" data-press onClick={onClose} style={btn(theme)}>Keep going</button>
      </div>
    </div>
  );
}

function overlay(): CSSProperties {
  // No backdrop-filter blur — paint-bound, see global.css .card rationale.
  return { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '20px' };
}
function card(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { background: t.surface, border: `2px solid ${t.border}`, borderRadius: '24px 8px 24px 8px', padding: '40px', textAlign: 'center', maxWidth: '380px', boxShadow: `8px 8px 0 ${t.shadow}`, transform: 'rotate(-1deg)', animation: 'palette-in .26s cubic-bezier(.2,.8,.3,1)' };
}
function btn(t: ReturnType<typeof getCairnTheme>): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '14px', fontFamily: SANS, fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: `4px 4px 0 ${t.shadow}` };
}
