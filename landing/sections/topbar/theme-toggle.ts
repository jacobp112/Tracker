import { applyTheme, THEME_STORAGE_KEY, type Theme } from '@/theme/theme';

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * The theme the page is CURRENTLY rendering, read from the data-theme attribute
 * that the pre-paint script in index.html writes and applyTheme keeps current.
 *
 * Deliberately not getInitialTheme(). That function answers a different
 * question — "which theme should we boot into" — by consulting storage and then
 * the system preference. It only agrees with the live theme for as long as
 * applyTheme happens to persist every change, and it would disagree outright
 * the moment a session-only or URL-driven theme override existed. data-theme is
 * the value the page actually paints from, so it is the value to branch on.
 */
export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

const asTheme = (value: string | null): Theme => (value === 'dark' ? 'dark' : 'light');

/**
 * Wire a button to flip the theme.
 *
 * `onChange` exists so the caller can keep its own presentation (icon,
 * accessible name) in sync as part of the same event, in a defined order.
 * Previously main.ts registered a SECOND click listener on the same button to
 * repaint the icon, which worked only because listeners fire in registration
 * order and this one happened to be attached first — an ordering dependency
 * nothing declared and no test could catch.
 *
 * The options argument is optional, so existing setupThemeToggle(button) calls
 * keep working unchanged.
 *
 * Returns a teardown function. Two of the three listeners live on `window`, so
 * they outlive the button and nothing else can reach them: under Vite HMR, or
 * in a test file that calls this once per case, every call used to leave its
 * predecessors attached and each external theme change fanned out to all of
 * them. Callers that never unmount can ignore the return value.
 */
export function setupThemeToggle(
  button: HTMLElement,
  opts: { onChange?: (theme: Theme) => void } = {},
): () => void {
  const change = (theme: Theme): void => {
    applyTheme(theme);
    opts.onChange?.(theme);
  };

  const onClick = (): void => change(nextTheme(currentTheme()));

  // The theme key is shared with the app on the same origin (see index.html's
  // pre-paint script). Without this, flipping the theme in the app tab and
  // returning here leaves the two disagreeing. The storage event fires only in
  // OTHER tabs, so this never re-fires from our own applyTheme — no loop.
  const onStorage = (e: StorageEvent): void => {
    if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
    change(asTheme(e.newValue));
  };

  // Someone who has never touched the toggle booted into their OS preference,
  // and until now stayed frozen there for the life of the tab — flipping the OS
  // to dark at sunset left this page bright. A stored value means the user made
  // an explicit choice, and an explicit choice outranks the system.
  const media =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const onSystemChange = (e: MediaQueryListEvent): void => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    change(e.matches ? 'dark' : 'light');
  };

  button.addEventListener('click', onClick);
  window.addEventListener('storage', onStorage);
  media?.addEventListener('change', onSystemChange);

  return () => {
    button.removeEventListener('click', onClick);
    window.removeEventListener('storage', onStorage);
    media?.removeEventListener('change', onSystemChange);
  };
}