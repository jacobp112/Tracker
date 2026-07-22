/** Icon set — inline SVG, currentColor, stroke-based. Lifted from the approved mockup. */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const;

export const OverviewIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const StudyIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
    <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
  </svg>
);

export const FitnessIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    <rect x="2" y="10" width="4" height="4" rx="1" />
    <rect x="18" y="10" width="4" height="4" rx="1" />
  </svg>
);

export const ExamsIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="4" y="3" width="12" height="18" rx="1.5" />
    <path d="M9 3v18M18 7h2a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2" />
  </svg>
);

export const JobsIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18" />
  </svg>
);

export const AddIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const SearchIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const BellIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

export const SunIcon = () => (
  <svg className="sun" viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = () => (
  <svg className="moon" viewBox="0 0 24 24" {...S}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const HealthIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <path d="M20.8 8.6c0 4-4.6 7.6-8.8 10.4C7.8 16.2 3.2 12.6 3.2 8.6a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8Z" />
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const DueIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M3 11h18M8 3v4M16 3v4" />
  </svg>
);

export const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" {...S}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);

/* ── Badge tone glyphs (Document 2 §8 diagnostic badges) ───────────
 * currentColor throughout, so each inherits its badge's tone ink. Shape carries
 * the meaning alongside colour (Doc 3 §6): check = good, triangle = caution,
 * circle = problem. Rounded caps/joins so they read cleanly at ~12px. */
const G = { ...S, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const BadgeOkIcon = () => (
  <svg viewBox="0 0 24 24" {...G}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const BadgeWarnIcon = () => (
  <svg viewBox="0 0 24 24" {...G}>
    <path d="M12 4 3 19h18L12 4Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </svg>
);

export const BadgeBadIcon = () => (
  <svg viewBox="0 0 24 24" {...G}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);
