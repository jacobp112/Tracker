/**
 * Theme resolution — Document 3 §2.3.
 *
 * The *initial* theme is applied by an inline script in index.html before
 * first paint, so this module must not re-derive it on mount (that would
 * reintroduce the flash it exists to prevent). It reads back what the script
 * already resolved and takes over from there.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'studyos-theme';

/** What the pre-paint script put on <html>, falling back to system. */
export function getInitialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return prefersDark() ? 'dark' : 'light';
}

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/** Read the user's explicit choice, if they have made one. */
export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    // Storage can throw in private mode / when cookies are blocked. A theme
    // preference is not worth breaking the app over — fall back to system.
    return null;
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session, it just won't persist.
  }
}
