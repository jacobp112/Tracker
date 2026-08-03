import './topbar.css';
import { createElement, Sun, Moon } from 'lucide';
import { currentTheme, setupThemeToggle } from './theme-toggle';

/* ── Topbar behaviour ─────────────────────────────────────────────
 * The theme toggle. One render function owns the button's whole presentation —
 * icon AND accessible name AND the <meta theme-color> — because they are views
 * of one piece of state and splitting them across listeners is how they drift.
 *
 * The name is an aria-label rather than an .sr-only child: replaceChildren()
 * necessarily destroys children, so a label inside the button was wiped on the
 * first repaint, leaving an icon-only control with no name at all. */

/* A second initTopbar() used to double-wire the same button: two click
 * listeners, two flips, one visible no-op. Vite replaces this module on every
 * save of topbar.css, so in dev the toggle would quietly stop working after the
 * first hot update and start working again after a full reload — the worst
 * shape of bug to chase. Tearing the previous wiring down first makes a repeat
 * call a no-op instead. */
let teardown: (() => void) | null = null;

export function initTopbar(): () => void {
  teardown?.();
  teardown = null;

  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return () => {};

  // The single, un-gated <meta name="theme-color">. render() keeps its content
  // pointed at the live --bg-page (read as a computed token, not hardcoded), so
  // the browser chrome follows the user's chosen theme, not just their OS.
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const render = (theme: 'light' | 'dark'): void => {
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    const icon = createElement(theme === 'dark' ? Sun : Moon);
    icon.setAttribute('aria-hidden', 'true');
    toggle.replaceChildren(icon);
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim();
    if (themeMeta && bg) themeMeta.setAttribute('content', bg);
  };
  render(currentTheme());

  teardown = setupThemeToggle(toggle, { onChange: render });
  return () => {
    teardown?.();
    teardown = null;
  };
}