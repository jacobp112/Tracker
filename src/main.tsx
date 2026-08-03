import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/* Self-hosted Wispr Flow faces (no CDN). These register 'EB Garamond' and
 * 'Figtree Variable'; tokens.css points --font-display / --font-sans at them. */
import '@fontsource/eb-garamond';
import '@fontsource-variable/figtree';

import './styles/global.css';
import './styles/components.css';
import './styles/shell.css';
import './styles/palette.css';
import './styles/dashboard.css';
import './styles/overview.css';
import './styles/ingest.css';
import './styles/exams.css';
/* Wispr Flow app reskin — LAST, so its flat-with-borders component overrides
 * win the cascade over the stylesheets above. */
import './styles/wispr-app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Triggers the orchestrated entrance (Document 3 §2.6). Double-rAF so the
// initial paint lands first and the transition actually runs.
requestAnimationFrame(() =>
  requestAnimationFrame(() => document.body.classList.add('loaded')),
);
