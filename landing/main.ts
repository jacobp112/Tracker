/*
 * Landing page entry.
 *
 * CSS IMPORT ORDER IS LOAD-BEARING. Do not reorder without reading this.
 *
 *   1. The two Fontsource packages register the @font-face rules for the
 *      self-hosted variable faces (EB Garamond + Figtree). Without these
 *      imports NOTHING declares a web font and the whole page renders in the
 *      fallback stack — silently, and convincingly, on macOS. The app entry
 *      (src/main.tsx) imports the same two packages.
 *   2. base.css inlines the shared tokens.css, which declares --font-display /
 *      --font-sans / --font-mono pointing at the registered family names, plus
 *      the metric-matched @font-face fallbacks. tokens.css is the single source
 *      of truth for the Wispr theme, shared with the app.
 *   3. wispr.css (last) holds only the landing-specific component overrides
 *      (nav pill, chambers, comparison pair, display-serif headings) and wins
 *      the cascade over the section stylesheets by loading after them.
 */
import '@fontsource/eb-garamond';
import '@fontsource-variable/figtree';
import './styles/base.css';
import './styles/sections.css';
import './styles/recreations.css';
import './styles/how.css';
import './styles/wispr.css';

import { createElement, Sun, Moon } from 'lucide';
import { setupReveals } from './reveal';
import { setupDataAnimations } from './animate';
import { setupCursorLight } from './cursor-light';
import { setupHowSequence } from './scrub';
import { copyText } from './clipboard';
import { currentTheme, setupThemeToggle } from './theme-toggle';

/*
 * The ?url preload injection that used to live here is gone.
 *
 * It imported the hashed woff2 paths and appended <link rel="preload"> at
 * runtime — from a deferred module, i.e. after the stylesheet had already been
 * parsed and the browser had already discovered the same font files. Near-zero
 * gain, plus two hardcoded Fontsource filenames that break silently on any
 * upstream rename.
 *
 * If LCP measurement later justifies a real preload, do it at build time with a
 * transformIndexHtml plugin that injects the emitted asset URLs into <head>, or
 * move the woff2 into public/ and reference stable paths. Don't reinstate the
 * runtime version.
 */

/* The .js flag is set by the blocking inline script in index.html, before first
 * paint. It was also being set here, which was dead code: by the time a
 * deferred module runs the page has already painted, which is the exact flash
 * the head script exists to prevent. Removed so nobody "tidies up" the head
 * script believing this line covers it. */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Theme toggle ─────────────────────────────────────────────────
 * One render function owns the button's whole presentation — icon AND
 * accessible name — because they are two views of one piece of state and
 * splitting them across two click listeners is how they drift apart.
 *
 * The name is an aria-label rather than an .sr-only child: replaceChildren()
 * necessarily destroys children, so a label living inside the button was wiped
 * on the first repaint, leaving an icon-only control with no name at all.
 */
const toggle = document.getElementById('theme-toggle');
if (toggle) {
  // The single, un-gated <meta name="theme-color">. render() keeps its content
  // pointed at the live --bg-page, so the browser chrome follows the user's
  // chosen theme rather than only their OS preference. Reading the computed
  // token (rather than hardcoding #f5f5f7 / #000000) means the two can't drift.
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const render = (theme: 'light' | 'dark'): void => {
    // Name the outcome, not the widget: "Switch to dark theme", not "Toggle".
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    const icon = createElement(theme === 'dark' ? Sun : Moon);
    icon.setAttribute('aria-hidden', 'true');
    toggle.replaceChildren(icon);
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    // applyTheme has already set data-theme by the time onChange fires, so the
    // computed value reflects the theme being rendered.
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-page').trim();
    if (themeMeta && bg) themeMeta.setAttribute('content', bg);
  };
  render(currentTheme());
  setupThemeToggle(toggle, { onChange: render });
}

setupReveals(document.querySelectorAll('.reveal'), { reducedMotion });

/* Data-driven recreations (ring draw, count-ups, bar fills) animate once on
 * scroll-into-view. Reduced motion snaps them to final; no-JS shows final via
 * the CSS fallbacks. Each group opts in with [data-animate]. */
setupDataAnimations(document.querySelectorAll('[data-animate]'), { reducedMotion });

/* ── Replay the decay curve ───────────────────────────────────────
 * The curve draws itself once when it first scrolls into view (animate.ts adds
 * .is-drawn). This control runs that sequence again on demand. Two guards:
 *  - reduced motion has nothing to replay — the sequence is snapped to its end
 *    state — so the button is hidden rather than left as a dead control;
 *  - it only replays while the figure is actually on screen: an Intersection
 *    observer tracks visibility, so a click can't fire a draw the user can't see
 *    (it would finish before they scrolled back to it).
 */
const decayCurve = document.querySelector('.decay-curve');
const decayReplay = document.getElementById('decay-replay') as HTMLButtonElement | null;
if (decayCurve && decayReplay) {
  if (reducedMotion) {
    decayReplay.hidden = true;
  } else {
    let inView = false;
    if (typeof IntersectionObserver !== 'undefined') {
      new IntersectionObserver((entries) => {
        for (const e of entries) inView = e.isIntersecting;
      }).observe(decayCurve);
    } else {
      inView = true; // no observer to gate on — don't disable the control
    }
    decayReplay.addEventListener('click', () => {
      if (!inView) return;
      decayCurve.classList.remove('is-drawn');
      // Force a reflow so the class removal commits before it goes back on;
      // otherwise the browser coalesces the two and the transitions never restart.
      void (decayCurve as HTMLElement).offsetWidth;
      decayCurve.classList.add('is-drawn');
    });
  }
}

/* Cursor-aware light on the hero recreation. Desktop fine-pointer only, and off
 * under reduced motion — setupCursorLight is a no-op when disabled, so touch
 * devices never wire pointer listeners. */
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const heroMock = document.getElementById('mock-overview');
if (heroMock) setupCursorLight(heroMock, { enabled: finePointer && !reducedMotion });

/* ── How-it-works scrubbed sequence ───────────────────────────────
 * The #how section is a tall track that pins its stage and scrubs a four-beat
 * sequence on scroll. setupHowSequence unpins and paints the final frame under
 * reduced motion or a narrow viewport, matching the CSS/no-JS fallback — so the
 * story is always fully readable, scrub or not. */
const howSection = document.getElementById('how');
if (howSection) setupHowSequence(howSection, { reducedMotion });

/* ── Copy the prompt ──────────────────────────────────────────────
 * Copies the FULL prompt from the <template>, not the visible excerpt. The
 * excerpt ends mid-schema; copying it handed the user a prompt their AI cannot
 * satisfy, with nothing to indicate why.
 *
 * Note the .content read: a <template>'s parsed children live in its
 * DocumentFragment, so tpl.textContent is the empty string. This is the single
 * easiest way to reintroduce a silently-empty clipboard.
 */
const copyBtn = document.getElementById('copy-prompt');
const promptFull = document.getElementById('prompt-full') as HTMLTemplateElement | null;
const copyStatus = document.getElementById('copy-status');

if (copyBtn && promptFull) {
  const prompt = promptFull.content.textContent?.trim() ?? '';
  let resetTimer: number | undefined;

  copyBtn.addEventListener('click', async () => {
    const ok = prompt.length > 0 && (await copyText(prompt));

    /* Outcome goes in the role="status" region, not the button's own label.
     * Rewriting the label renamed the element the user was focused on, so a
     * screen reader announced a rename mid-interaction rather than a result.
     *
     * The failure message names the fix, per the app's own rule that no
     * failure path is allowed to be vague. */
    if (copyStatus) {
      copyStatus.textContent = ok
        ? 'Copied'
        : 'Copy blocked by your browser — select the prompt and copy it manually.';
      copyStatus.classList.toggle('is-error', !ok);
    }

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      if (copyStatus) {
        copyStatus.textContent = '';
        copyStatus.classList.remove('is-error');
      }
    }, 4000);
  });
}

/*
 * In-page anchor scrolling is now `html { scroll-behavior: smooth }` in
 * base.css. The JS handler that used to live here called preventDefault(), so:
 * the URL hash never updated (no linkable section, no history entry, back
 * button did nothing) and focus stayed on the nav link, meaning a keyboard
 * user's next Tab resumed from the top bar instead of the section they had
 * just navigated to. The native behaviour gets all three right for free, and
 * tokens.css already forces scroll-behavior:auto under reduced motion.
 */
