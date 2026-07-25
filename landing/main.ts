import './fonts.css';
import './styles/base.css';
import './styles/sections.css';
import './styles/recreations.css';

// Preload only the two above-the-fold faces. Static <link rel="preload"> in the
// HTML can't reference the fingerprinted node_modules woff2, so we resolve the
// hashed URLs with Vite's ?url import and inject the preloads here (the plan's
// sanctioned fallback). Do NOT preload every weight — just these two.
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';

import { createElement, Sun, Moon } from 'lucide';
import { getInitialTheme } from '@/theme/theme';
import { setupReveals } from './reveal';
import { copyText } from './clipboard';
import { setupThemeToggle } from './theme-toggle';

for (const href of [interUrl, monoUrl]) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.crossOrigin = 'anonymous';
  link.href = href;
  document.head.appendChild(link);
}

// Signals JS is present so CSS can opt into the hidden→reveal treatment
// (progressive enhancement: no-JS keeps all content visible).
document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Theme toggle: the app's module flips + persists the theme; here we also keep
// the sun/moon glyph in sync with the current theme (light → moon, dark → sun).
const toggle = document.getElementById('theme-toggle');
if (toggle) {
  const paintIcon = () => {
    toggle.replaceChildren(createElement(getInitialTheme() === 'dark' ? Sun : Moon));
  };
  paintIcon();
  setupThemeToggle(toggle);
  toggle.addEventListener('click', paintIcon);
}

setupReveals(document.querySelectorAll('.reveal'), { reducedMotion });

const copyBtn = document.getElementById('copy-prompt');
const promptText = document.getElementById('prompt-text');
if (copyBtn && promptText) {
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(promptText.textContent ?? '');
    copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
    window.setTimeout(() => (copyBtn.textContent = 'Copy'), 1600);
  });
}

// Smooth in-page anchor scrolling for the top-bar nav (spec §10), reduced-motion
// aware so it never fights a user's stated preference.
for (const link of document.querySelectorAll<HTMLAnchorElement>('.topnav a[href^="#"]')) {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href')?.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  });
}
