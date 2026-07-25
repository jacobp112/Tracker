import './fonts.css';

// Preload only the two above-the-fold faces. Static <link rel="preload"> in the
// HTML can't reference the fingerprinted node_modules woff2, so we resolve the
// hashed URLs with Vite's ?url import and inject the preloads here (the plan's
// sanctioned fallback). Do NOT preload every weight — just these two.
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';

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
