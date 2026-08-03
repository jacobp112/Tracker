/*
 * Landing page entry — a thin orchestrator.
 *
 * Everything specific to a section lives in that section's folder
 * (landing/sections/<name>/): its HTML partial, its scoped CSS, and its JS.
 * This file wires the shared, cross-section pieces and hands control to each
 * section's own init.
 *
 * FONTS: the two Fontsource packages register the self-hosted faces (EB
 * Garamond + Figtree). tokens.css (via base.css) points --font-display /
 * --font-sans at them, plus the metric-matched @font-face fallbacks. The app
 * entry (src/main.tsx) imports the same two packages.
 *
 * CSS ORDER: base.css (reset, tokens, page-gutter, .band/.card/button
 * primitives, reveal) then wispr.css (the shared Wispr theme layer) load first;
 * each section's scoped stylesheet is pulled in by its own module below, after
 * the shared sheets, so a section's rules win over the shared defaults.
 */
import '@fontsource/eb-garamond';
import '@fontsource-variable/figtree';

import './styles/base.css';
import './styles/wispr.css';

/* Sections, in DOM order. Each import runs the section's module, which pulls in
 * its own stylesheet; sections with behaviour also expose an init() called
 * below. Static sections (problem, privacy, choose, footer) are imported purely
 * for their co-located stylesheet. */
import { initTopbar } from './sections/topbar/topbar';
import { initHero } from './sections/hero/hero';
import './sections/problem/problem';
import { initHow } from './sections/how/how';
import { initMemory } from './sections/memory/memory';
import { initExams } from './sections/exams/exams';
import './sections/privacy/privacy';
import './sections/choose/choose';
import './sections/footer/footer';

/* The one genuinely page-wide behaviour: the reveal system observes every
 * .reveal across all sections, so it belongs to the page, not to any section. */
import { setupReveals } from './lib/reveal';

/* The .js flag is set by the blocking inline script in index.html, before first
 * paint — not here. A deferred module runs after paint, which is the exact
 * flash the head script exists to prevent. */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

initTopbar();
setupReveals(document.querySelectorAll('.reveal'), { reducedMotion });
initHero(reducedMotion);
initHow(reducedMotion);
initMemory(reducedMotion);
initExams(reducedMotion);
