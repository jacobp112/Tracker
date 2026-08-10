/*
 * Cairn design-mockup theme + helpers — ported verbatim from the approved
 * design file (landing/files to merge/Cairn_Dashboard_dc.html) so the app's
 * screens render pixel-for-pixel to that design. The inline-style approach
 * mirrors the mockup exactly; values are the mockup's own theme object.
 *
 * This governs presentation only — every screen still reads the real store and
 * derives its numbers from the engine. Nothing here changes app logic.
 */

import type { CSSProperties } from 'react';

export interface CairnTheme {
  bg: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  muted: string;
  border: string;
  pine: string;
  orange: string;
  lavender: string;
  hoverBg: string;
  activeBg: string;
  inputBg: string;
  error: string;
  shadow: string;
  focus: string;
  select: string;
  scroll: string;
  onAccent: string;
}

const DARK: CairnTheme = {
  bg: '#15150f', surface: '#1e1e16', surfaceAlt: '#242419', ink: '#f5f3e6', muted: '#a6a394',
  border: '#4d4b3c', pine: '#3ddbc0', orange: '#ffb85c', lavender: '#e2c2ff', hoverBg: '#2a2a1e',
  activeBg: '#2c2c1f', inputBg: '#1a1a13', error: '#ff8a70', shadow: '#000000', focus: '#3ddbc0',
  select: '#3d3a5c', scroll: '#55544a', onAccent: '#0d1512',
};

const LIGHT: CairnTheme = {
  bg: '#ffffeb', surface: '#ffffff', surfaceAlt: '#f7f6e4', ink: '#1a1a1a', muted: '#77776a',
  border: '#1a1a1a', pine: '#034f46', orange: '#ffa946', lavender: '#f0d7ff', hoverBg: '#f0efd9',
  activeBg: '#f0d7ff', inputBg: '#ffffff', error: '#b5432f', shadow: '#1a1a1a', focus: '#ffa946',
  select: '#f0d7ff', scroll: '#77776a', onAccent: '#ffffeb',
};

export function getCairnTheme(isDark: boolean): CairnTheme {
  return isDark ? DARK : LIGHT;
}

/** Title-case status label the mockup uses. Real store is snake_case. */
export type MockStatus = 'Not started' | 'Learning' | 'Practising' | 'Mastered';
export function statusLabel(status: string): MockStatus {
  switch (status) {
    case 'mastered':
      return 'Mastered';
    case 'practising':
      return 'Practising';
    case 'learning':
      return 'Learning';
    default:
      return 'Not started';
  }
}

/** Title-case error-type label. Real store is snake_case. */
export function errorTypeLabel(type: string): string {
  const map: Record<string, string> = {
    conceptual: 'Conceptual',
    procedural: 'Procedural',
    careless: 'Careless',
    knowledge_gap: 'Knowledge gap',
  };
  return map[type] ?? type;
}

export function retentionColor(pct: number, theme: CairnTheme): string {
  if (pct < 35) return theme.error;
  if (pct < 65) return theme.orange;
  return theme.pine;
}

export function statusColor(
  status: MockStatus,
  theme: CairnTheme,
  isDark: boolean,
): { bg: string; color: string; border: string } {
  const map: Record<MockStatus, { bg: string; color: string; border: string }> = {
    'Not started': { bg: 'transparent', color: theme.muted, border: theme.border },
    Learning: { bg: theme.orange, color: '#1a1a1a', border: theme.border },
    Practising: { bg: theme.lavender, color: '#1a1a1a', border: theme.border },
    Mastered: { bg: theme.pine, color: isDark ? '#0d1512' : '#ffffeb', border: theme.border },
  };
  return map[status];
}

export function errorTypeColor(type: string, theme: CairnTheme): string {
  const map: Record<string, string> = {
    Conceptual: theme.pine,
    Procedural: theme.orange,
    Careless: theme.error,
    'Knowledge gap': theme.lavender,
  };
  return map[type] ?? theme.muted;
}

/** Ink colour that reads on an error-type chip fill. */
export function errorTagInk(type: string): string {
  return type === 'Careless' || type === 'Conceptual' ? '#ffffeb' : '#1a1a1a';
}

/** Heatmap / streak intensity — a translucent pine ramp over surfaceAlt. */
export function intensityColor(v: number, theme: CairnTheme): string {
  if (v === 0) return theme.surfaceAlt;
  const alpha = 0.3 + v * 0.23;
  const hex = theme.pine.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function scoreColor(ratio: number, theme: CairnTheme): string {
  if (ratio >= 0.8) return theme.pine;
  if (ratio >= 0.6) return theme.orange;
  return theme.error;
}

/** The big retention decay curve (drawer). Ported verbatim. */
export function buildDecayPath(retention: number): {
  d: string;
  endX: number;
  endY: number;
  nextX: number;
  nextY: number;
  w: number;
  h: number;
} {
  const w = 380,
    h = 160,
    pad = 18;
  const start = Math.min(96, retention + 45);
  const x0 = pad,
    y0 = h - pad - (start / 100) * (h - 2 * pad);
  const x1 = w - pad - 70,
    y1 = h - pad - (retention / 100) * (h - 2 * pad);
  const cx1 = x0 + (x1 - x0) * 0.35,
    cy1 = y0 + (y1 - y0) * 0.1;
  const cx2 = x0 + (x1 - x0) * 0.75,
    cy2 = y0 + (y1 - y0) * 0.9;
  const futureY = Math.max(pad, y1 + (y1 - y0) * 0.25);
  return {
    d: `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`,
    endX: x1,
    endY: y1,
    nextX: x1 + 55,
    nextY: futureY,
    w,
    h,
  };
}

/** The 64×24 retention mini-sparkline in a topic row. Ported verbatim. */
export function buildMiniSparkPath(retention: number): { d: string; endX: number; endY: number } {
  const w = 64,
    h = 24,
    pad = 3;
  const start = retention === 0 ? 0 : Math.min(95, retention + 55);
  const x0 = pad,
    y0 = h - pad - (start / 100) * (h - 2 * pad);
  const x1 = w - pad,
    y1 = h - pad - (retention / 100) * (h - 2 * pad);
  const cx = (x0 + x1) / 2;
  return {
    d: `M ${x0} ${y0} Q ${cx} ${y0 + (y1 - y0) * 0.15}, ${x1} ${y1}`,
    endX: x1,
    endY: y1,
  };
}

/** Course-accent → colour, cycled across the study grid + sidebar. */
export type CourseAccent = 'pine' | 'orange' | 'lavender' | 'stone';
export function accentColor(accent: CourseAccent, theme: CairnTheme, isDark: boolean): string {
  return { pine: theme.pine, orange: theme.orange, lavender: theme.lavender, stone: isDark ? '#55544a' : '#77776a' }[
    accent
  ];
}

/** Initials tile style (course rows/cards). Ported verbatim. */
export function tileStyle(
  accent: CourseAccent,
  theme: CairnTheme,
  isDark: boolean,
  size: number,
): CSSProperties {
  const map: Record<CourseAccent, { bg: string; color: string }> = {
    pine: { bg: theme.pine, color: isDark ? '#0d1512' : '#ffffeb' },
    orange: { bg: theme.orange, color: '#1a1a1a' },
    lavender: { bg: theme.lavender, color: '#1a1a1a' },
    stone: { bg: isDark ? '#55544a' : '#77776a', color: '#ffffeb' },
  };
  const c = map[accent];
  return {
    width: size + 'px',
    height: size + 'px',
    borderRadius: '10px',
    background: c.bg,
    color: c.color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 700,
    fontSize: size < 34 ? '11px' : '14px',
    flexShrink: 0,
  };
}

/** Cycle a course's accent by index, matching the mockup's stack feel. */
export const COURSE_ACCENTS: CourseAccent[] = ['pine', 'lavender', 'orange', 'stone'];
export function accentForIndex(i: number): CourseAccent {
  return COURSE_ACCENTS[i % COURSE_ACCENTS.length]!;
}
