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
 */
export function setupThemeToggle(
  button: HTMLElement,
  opts: { onChange?: (theme: Theme) => void } = {},
): void {
  button.addEventListener('click', () => {
    const theme = nextTheme(currentTheme());
    applyTheme(theme);
    opts.onChange?.(theme);
  });

  // The theme key is shared with the app on the same origin (see index.html's
  // pre-paint script). Without this, flipping the theme in the app tab and
  // returning here leaves the two disagreeing. The storage event fires only in
  // OTHER tabs, so this never re-fires from our own applyTheme — no loop.
  window.addEventListener('storage', (e) => {
    if (e.key !== THEME_STORAGE_KEY || !e.newValue) return;
    const theme: Theme = e.newValue === 'dark' ? 'dark' : 'light';
    applyTheme(theme);
    opts.onChange?.(theme);
  });
}
