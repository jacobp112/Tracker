import { useEffect, useRef, type CSSProperties } from 'react';
import type { Confidence, Topic, TopicStatus } from '@/domain/types';
import { topicLevelHighWater } from '@/engine/leveling';
import { badges, health, overconfidenceIndex, shouldShowHealth } from '@/engine/metrics';
import { retentionPct } from '@/engine/retention';
import { useTheme } from '@/theme/useTheme';
import {
  buildDecayPath,
  errorTypeColor,
  errorTypeLabel,
  getCairnTheme,
  statusColor,
  statusLabel,
  type CairnTheme,
} from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';

const STATUS_OPTIONS: TopicStatus[] = ['not_started', 'learning', 'practising', 'mastered'];
const CONFIDENCES: Confidence[] = [1, 2, 3, 4, 5];
const CONFIDENCE_WORD = ['', 'shaky', 'unsure', 'getting there', 'solid', 'rock solid'];

const KIND: Record<string, { label: string; tone: 'pass' | 'fail' | 'neutral' }> = {
  study_review: { label: 'Reviewed', tone: 'neutral' },
  test_pass: { label: 'Passed', tone: 'pass' },
  test_fail: { label: 'Failed', tone: 'fail' },
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Topic detail — rebuilt to the approved mockup as a right-slide drawer.
 * Header card, retention decay curve, status segmented + confidence selector,
 * level/XP card, health + overconfidence chips, badges, and the review-history
 * + error-log tables. Wired to the real store + existing handlers (promote,
 * quick review, resolve error); logic unchanged, presentation only.
 */
export function TopicDetail({
  topic,
  sectionTitle,
  onClose,
  onResolveError,
  onPromote,
  onQuickReview,
  onStartSession,
  now = new Date(),
}: {
  topic: Topic | null;
  sectionTitle: string;
  onClose: () => void;
  onResolveError: (topicId: string, errorId: string) => void;
  onPromote: (topicId: string, status: TopicStatus) => void;
  onQuickReview: (topicId: string, confidence: Confidence) => void;
  onStartSession?: (topicId: string) => void;
  now?: Date;
}) {
  const { theme: mode } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);

  // Keep the last topic so the panel keeps its content while sliding out.
  const lastRef = useRef<Topic | null>(null);
  if (topic) lastRef.current = topic;
  const t = topic ?? lastRef.current;
  const open = topic !== null;

  // Escape closes the drawer (the overlay handles click-away).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ret = t ? retentionPct(t, now) : null;
  const retNum = ret ?? 0;
  const statusStr = t ? statusLabel(t.status) : 'Not started';
  const level = t ? topicLevelHighWater(t, now) : 1;
  const xpPct = (retNum % 20) / 20 * 100;
  const confidencePct = (t?.conf ?? 0) * 20;
  const overconf = Math.round(confidencePct - retNum);
  const showOverconf = overconf > 15;
  const healthVal = t && shouldShowHealth(t) ? health(t, now) : null;
  const curve = buildDecayPath(retNum);
  const areaPath = `${curve.d} L ${curve.endX} ${curve.h} L 18 ${curve.h} Z`;
  const oci = t ? overconfidenceIndex(t) : 0;
  const topicBadges = t ? badges(t) : [];
  const gradId = `curveGrad-${t?.topic_id ?? 'x'}`;

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        style={{
          // No backdrop-filter blur: re-blurring the whole page behind the drawer
          // on every scroll/paint frame is paint-bound and froze the renderer
          // (matches the .card rationale in global.css). A plain dim reads fine.
          position: 'fixed', inset: 0, background: open ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
          pointerEvents: open ? 'auto' : 'none', transition: 'background 0.25s', zIndex: 60,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t ? `${t.title} detail` : 'Topic detail'}
        aria-hidden={!open}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '460px', maxWidth: '92vw',
          background: theme.surface, borderLeft: `2px solid ${theme.border}`, boxShadow: '-8px 0 0 rgba(0,0,0,0.15)',
          transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease-out',
          zIndex: 61, overflowY: 'auto', overscrollBehavior: 'contain', padding: '30px 28px 52px', boxSizing: 'border-box',
        }}
      >
        {t && (
          <>
            {/* Header card */}
            <div style={headerCard(theme)}>
              <div style={{ position: 'absolute', top: '-24px', right: '-24px', width: '90px', height: '90px', borderRadius: '9999px', background: statusColor(statusStr, theme, isDark).bg === 'transparent' ? theme.orange : statusColor(statusStr, theme, isDark).bg, opacity: 0.35 }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '27px', color: theme.ink, margin: 0 }}>{t.title}</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 600, color: theme.muted }}>
                    {sectionTitle ? `${sectionTitle} · ` : ''}Currently {statusStr}
                  </p>
                </div>
                <button type="button" data-press onClick={onClose} aria-label="Close" style={closeBtn(theme)}>
                  ✕
                </button>
              </div>
            </div>

            {onStartSession && (
              <button
                type="button"
                data-press
                onClick={() => onStartSession(t.topic_id)}
                style={startSessionBtn(theme)}
              >
                ▶ Start session
              </button>
            )}

            {/* Retention curve */}
            <div style={curveCard(theme)}>
              <p style={sectionLabel(theme)}>Retention curve</p>
              <svg width="100%" height="160" viewBox={`0 0 ${curve.w} ${curve.h}`}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.pine} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={theme.pine} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="18" y1={curve.h} x2={curve.nextX} y2={curve.h} stroke={theme.border} strokeWidth="1" opacity="0.3" />
                <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
                <path d={curve.d} fill="none" stroke={theme.pine} strokeWidth="3" strokeLinecap="round" />
                <circle cx={curve.endX} cy={curve.endY} r="5" fill={theme.pine} stroke={theme.surfaceAlt} strokeWidth="2" />
                <text x={curve.endX} y={curve.endY} dy="-10" textAnchor="middle" style={{ fontSize: '10px', fill: theme.ink, fontFamily: SANS, fontWeight: 700 }}>
                  {ret === null ? 'no data' : `${Math.round(retNum)}%`}
                </text>
                <line x1={curve.nextX} y1="0" x2={curve.nextX} y2={curve.h} stroke={theme.muted} strokeWidth="1.5" strokeDasharray="4 4" />
                <text x={curve.nextX} y="12" fontSize="10" fill={theme.muted} textAnchor="middle" fontFamily={SANS}>next review</text>
              </svg>
            </div>

            {/* Status + confidence controls */}
            <div style={controlCard(theme)}>
              <p style={sectionLabel(theme)}>Status</p>
              <div style={{ display: 'flex', gap: '6px', background: theme.surfaceAlt, borderRadius: '9999px', padding: '4px', marginBottom: '20px' }}>
                {STATUS_OPTIONS.map((opt) => {
                  const label = statusLabel(opt);
                  const active = opt === t.status;
                  const c = statusColor(label, theme, isDark);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onPromote(t.topic_id, opt)}
                      aria-pressed={active}
                      style={{
                        flex: 1, padding: '9px 6px', borderRadius: '9999px',
                        border: `2px solid ${active ? c.border : 'transparent'}`, background: active ? c.bg : 'transparent',
                        color: active ? c.color : theme.muted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <p style={sectionLabel(theme)}>Confidence</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', alignItems: 'center' }}>
                {CONFIDENCES.map((n) => {
                  const on = n <= t.conf;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onQuickReview(t.topic_id, n)}
                      aria-label={`Log a review at confidence ${n} of 5`}
                      style={{
                        width: '38px', height: '38px', borderRadius: '9999px', border: `2px solid ${theme.border}`,
                        background: on ? theme.orange : 'transparent', color: on ? '#1a1a1a' : theme.muted,
                        fontWeight: 700, cursor: 'pointer', fontFamily: SANS,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
                <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 600, color: theme.muted }}>{CONFIDENCE_WORD[t.conf] ?? ''}</span>
              </div>
            </div>

            {/* Level / XP */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: theme.surfaceAlt, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '9999px', background: theme.lavender, border: `2px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SERIF, fontSize: '20px', color: '#1a1a1a', flexShrink: 0 }}>
                {level}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.ink }}>
                  Level {level} · strength {t.strength.toFixed(1)}
                </p>
                <div style={{ marginTop: '6px', height: '10px', borderRadius: '9999px', background: theme.surface, overflow: 'hidden' }}>
                  <div style={{ width: `${xpPct}%`, height: '100%', background: theme.pine, borderRadius: '9999px' }} />
                </div>
              </div>
            </div>

            {/* Health + overconfidence */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
              <div style={{ flex: 1, minWidth: '140px', background: theme.surfaceAlt, borderRadius: '12px', padding: '12px 14px' }}>
                <span style={{ fontFamily: SERIF, fontSize: '22px', color: theme.ink, display: 'block' }}>
                  {healthVal === null ? '—' : `${healthVal}%`}
                </span>
                <span style={{ fontSize: '11px', color: theme.muted }}>Health</span>
              </div>
              {showOverconf && (
                <div style={{ flex: 1, minWidth: '140px', background: theme.surfaceAlt, border: `2px solid ${theme.error}`, borderRadius: '12px', padding: '12px 14px' }}>
                  <span style={{ fontFamily: SERIF, fontSize: '22px', color: theme.error, display: 'block' }}>+{overconf}</span>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Overconfidence</span>
                </div>
              )}
              {!showOverconf && (
                <div style={{ flex: 1, minWidth: '140px', background: theme.surfaceAlt, borderRadius: '12px', padding: '12px 14px' }}>
                  <span style={{ fontFamily: SERIF, fontSize: '22px', color: theme.ink, display: 'block' }}>{oci >= 0 ? '+' : ''}{oci.toFixed(2)}</span>
                  <span style={{ fontSize: '11px', color: theme.muted }}>Calibration</span>
                </div>
              )}
            </div>

            {/* Badges */}
            {topicBadges.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
                {topicBadges.map((b) => (
                  <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: theme.lavender, border: `2px solid ${theme.border}`, borderRadius: '9999px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: '#1a1a1a' }}>
                    {b.label}
                  </span>
                ))}
              </div>
            )}

            {/* Review history */}
            <h3 style={tableTitle(theme)}>Review history ({t.review_history.length})</h3>
            <div style={tableCard(theme)}>
              {t.review_history.length === 0 ? (
                <p style={{ fontSize: '13px', color: theme.muted, padding: '8px 4px' }}>Nothing logged yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: '13px', marginBottom: '10px' }}>
                  <span style={th(theme)}>Date</span>
                  <span style={th(theme)}>Outcome</span>
                  <span style={th(theme)}>Confidence</span>
                  {[...t.review_history].reverse().map((e) => {
                    const k = KIND[e.kind] ?? { label: e.kind, tone: 'neutral' as const };
                    const col = k.tone === 'pass' ? theme.pine : k.tone === 'fail' ? theme.error : theme.muted;
                    return (
                      <div key={e.event_id} style={{ display: 'contents' }}>
                        <span style={td(theme)}>{fmt(e.date)}</span>
                        <span style={td(theme)}>
                          <span style={{ fontWeight: 700, color: col }}>
                            {e.test ? `${k.label} ${e.test.score}/${e.test.out_of}` : k.label}
                          </span>
                        </span>
                        <span style={td(theme)}>{e.confidence_reported}/5</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error log */}
            <h3 style={tableTitle(theme)}>Error log ({t.error_log.filter((e) => !e.resolved).length} active)</h3>
            <div style={tableCard(theme)}>
              {t.error_log.length === 0 ? (
                <p style={{ fontSize: '13px', color: theme.muted, padding: '8px 4px' }}>No mistakes logged.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontSize: '13px', marginBottom: '10px' }}>
                  <span style={th(theme)}>Mistake</span>
                  <span style={th(theme)}>Type</span>
                  <span style={th(theme)}>Date</span>
                  {[...t.error_log].reverse().map((e) => {
                    const typeLabel = errorTypeLabel(e.error_type);
                    return (
                      <button
                        key={e.error_id}
                        type="button"
                        onClick={() => onResolveError(t.topic_id, e.error_id)}
                        title={e.resolved ? 'Mark unresolved' : 'Mark resolved'}
                        aria-label={`${e.description} — ${typeLabel}. ${e.resolved ? 'Resolved' : 'Unresolved'}. Toggle.`}
                        style={{
                          display: 'contents', font: 'inherit', textAlign: 'left', cursor: 'pointer',
                        }}
                      >
                        <span style={{ ...td(theme), opacity: e.resolved ? 0.45 : 1, textDecoration: e.resolved ? 'line-through' : 'none' }}>
                          {e.description}
                        </span>
                        <span style={{ ...td(theme), opacity: e.resolved ? 0.45 : 1 }}>
                          <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700, background: errorTypeColor(typeLabel, theme), color: typeLabel === 'Careless' || typeLabel === 'Conceptual' ? '#ffffeb' : '#1a1a1a' }}>
                            {typeLabel}
                          </span>
                        </span>
                        <span style={{ ...td(theme), opacity: e.resolved ? 0.45 : 1 }}>{fmt(e.date)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function headerCard(t: CairnTheme): CSSProperties {
  return { position: 'relative', background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: '18px 6px 18px 6px', padding: '18px 20px', marginBottom: '22px', transform: 'rotate(-0.6deg)', boxShadow: `4px 5px 0 ${t.shadow}`, overflow: 'hidden' };
}
function startSessionBtn(t: CairnTheme): CSSProperties {
  return { width: '100%', boxSizing: 'border-box', marginBottom: '22px', background: t.pine, color: t.onAccent, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '13px', fontFamily: SANS, fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: `3px 3px 0 ${t.shadow}` };
}
function closeBtn(t: CairnTheme): CSSProperties {
  return { background: t.bg, border: `2px solid ${t.border}`, borderRadius: '9999px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: '15px', color: t.ink, boxShadow: `2px 2px 0 ${t.shadow}`, transform: 'rotate(4deg)' };
}
function curveCard(t: CairnTheme): CSSProperties {
  return { position: 'relative', background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: '10px 26px 10px 26px', padding: '18px 18px 14px', marginBottom: '22px', transform: 'rotate(0.5deg)', boxShadow: `5px 6px 0 ${t.shadow}` };
}
function controlCard(t: CairnTheme): CSSProperties {
  return { background: t.surfaceAlt, border: `2px solid ${t.border}`, borderRadius: '20px 8px 20px 8px', padding: '18px 18px 6px', marginBottom: '22px', boxShadow: `4px 5px 0 ${t.shadow}`, transform: 'rotate(-0.4deg)' };
}
function sectionLabel(t: CairnTheme): CSSProperties {
  return { fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted, margin: '0 0 10px' };
}
function tableCard(t: CairnTheme): CSSProperties {
  return { background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: '14px', padding: '4px 14px 8px', marginBottom: '4px' };
}
function tableTitle(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '18px', color: t.ink, margin: '18px 0 10px' };
}
function th(t: CairnTheme): CSSProperties {
  return { textAlign: 'left', color: t.muted, fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', padding: '6px 4px', borderBottom: `1px solid ${t.border}` };
}
function td(t: CairnTheme): CSSProperties {
  return { padding: '8px 4px', borderBottom: `1px solid ${t.border}`, color: t.ink, display: 'flex', alignItems: 'center' };
}
