/*
 * Landing page entry.
 *
 * CSS IMPORT ORDER IS LOAD-BEARING. Do not reorder without reading this.
 *
 *   1. The two Fontsource packages register the @font-face rules for the
 *      self-hosted variable faces. Without these imports NOTHING declares a
 *      web font and the whole page renders in the fallback stack — silently,
 *      and convincingly, on macOS.
 *   2. base.css inlines tokens.css, which declares --font-sans / --font-mono
 *      pointing at the family names 'Inter' and 'JetBrains Mono'.
 *   3. fonts.css re-points those two tokens at the names Fontsource actually
 *      registers ('Inter Variable', 'JetBrains Mono Variable').
 *
 * Steps 2 and 3 both write :root, so specificity ties and the LAST declaration
 * wins. fonts.css after base.css, always — the other way round, tokens.css
 * overwrites the aliases and every .mono-num on the page (the hero ring, every
 * retention percentage) drops to SF Mono.
 */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/base.css';
import './fonts.css';
import './styles/sections.css';
import './styles/recreations.css';

import { createElement, Sun, Moon } from 'lucide';
import { setupReveals } from './reveal';
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
  const render = (theme: 'light' | 'dark'): void => {
    // Name the outcome, not the widget: "Switch to dark theme", not "Toggle".
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    const icon = createElement(theme === 'dark' ? Sun : Moon);
    icon.setAttribute('aria-hidden', 'true');
    toggle.replaceChildren(icon);
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  };
  render(currentTheme());
  setupThemeToggle(toggle, { onChange: render });
}

setupReveals(document.querySelectorAll('.reveal'), { reducedMotion });

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
