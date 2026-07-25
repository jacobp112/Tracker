# Elevating the Cairn Landing Page — Design + Motion Research Report

## (a) Executive Summary — the design direction

Cairn should aim for the "quiet, engineered, obviously-expensive" register occupied by Vercel/Geist, Linear, and the personal sites of Rauno Freiberg and Emil Kowalski — where craft is proved through precision, restraint, and physical-feeling motion rather than spectacle. The single strongest move is not to add effects but to make the three product recreations (Overview ring, retention matrix, validation card) feel physically real: draw the ring, count the numbers in tabular mono, fill the bars, and give each surface one honest 1px inset top-edge highlight and layered shadow. Motion should obey a strict decision rule drawn from Emil Kowalski's writing: every animation must justify itself (state change, feedback, spatial continuity, or explanation) or it is deleted; as Kowalski puts it in "Great animations," "The best type of easing for this purpose is ease-out… Your animations should also usually be shorter than 300ms," with entrance/reveal choreography as the one place slightly slower (0.6s) motion is allowed. Depth and texture come from cheap fakes — precomposited static gradients, a single SVG/PNG grain overlay, and box-shadow layering — never from `backdrop-filter`, which is banned in scroll regions because it measurably dropped this app's scroll from ~53 to ~13 FPS. The palette stays a restrained neutral canvas with the one blue accent; the indigo `--accent-2` and any gradient token stay incidental. The recommended stack keeps the landing page vanilla TS + Vite and adds motion through native CSS (scroll-driven animations behind `@supports`, `@property`, Web Animations API) plus a tiny hand-rolled cursor/lerp helper — avoiding React, GSAP's revocable license, and Lenis's accessibility costs. Everything degrades cleanly under `prefers-reduced-motion` using the existing 0.01ms discipline. The result reads as a calm instrument for serious autodidacts, not a marketed SaaS.

## (b) Reference teardown

| Exemplar | What makes it read as high-craft | Exact motion / build technique | Fit for Cairn |
|---|---|---|---|
| **Linear** | Dark-first canvas, Inter, tight tracking, "small elegant motion," restraint as identity; gradient used as punctuation not decoration | Short scroll-reveals (opacity + small translateY), GPU transform/opacity only; subtle page-load stagger | High — same Inter/tight-tracking DNA; borrow reveal restraint, not the purple sphere |
| **Stripe** | Editorial type, generous scale, the famous animated hero gradient | Per Kevin Hufnagl's reverse-engineering (kevinhufnagl.com), the hero is "a minimalistic implementation of WebGL which they called minigl and a Gradient Class," a ~10KB/~800-line file; the exzenter/gradient-stripe teardown confirms the shader "employs Fractal Brownian Motion… layers multiple octaves of Simplex noise… the coordinate system is modulated by a sinusoidal mesh… applying sin() and cos() functions to the UV coordinates with time-based offsets." Crucially, Hufnagl notes "they implemented a ScrollObserver to disable the effect when the gradient is not visible inside the viewport." | Technique only — a full-bleed animated mesh violates Cairn's "no gradient-blob hero" rule. Steal the *discipline* (off-screen pause, all-GPU) not the look |
| **Vercel / Geist** | "The ink IS the brand" — near-black #171717 on #fafafa, no marketing accent, tabular mono numerals everywhere, precise 1px grid lines, pill CTAs | Subtle functional motion; number/metric emphasis via Geist Mono tabular figures; grid as architecture | Very high — Cairn's mono-number rule and one-accent restraint are the same instinct. This is the closest spiritual match |
| **Raycast** | Dark luminous surfaces, keyboard-first calm | Deliberate *absence* of animation on high-frequency actions. Kowalski: "never animate keyboard initiated actions… I use Raycast frequently and can't imagine how frustrating it would be if every time I opened it, I was greeted with a 500ms enter animation. Raycast has no animations and it feels right." | High — validates NOT animating the "Open the app" keyboard path |
| **Family (iOS)** | "Snappy interface," spring-native motion; the drawer Kowalski recreated on web | Springs for direct manipulation; height + opacity co-animated with an easing that "feels right" | Medium — springs suit the ring/press micro-interactions, used sparingly |
| **Rauno Freiberg (rauno.me, Vaul, Sonner, cmdk)** | Obsessive interaction detail; his stated maxims "Make it fast. Make it beautiful. Make it consistent. Make it carefully. Make it timeless. Make it soulful."; author of the Web Interface Guidelines | Staggered text, spatial tooltips, theme-motion; hand-built micro-interactions; cmdk command menu | High — his Web Interface Guidelines are the reference for focus/keyboard/robustness |
| **Emil Kowalski (animations.dev, Sonner)** | Motion taste as the differentiator; cohesive feel | ease-out default, <300ms UI, interruptible transitions, reduced-motion → opacity-only; springs for natural motion | Very high — adopt his ruleset wholesale as Cairn's motion constitution |
| **Retool / Resend / Clerk / Vanta (dev-tool peers)** | Dense, honest product UI shown as real components; tabular data; muted palettes | In-product mockups animated with restraint (data fills, status cues) rather than decorative motion | High — directly models the three recreations |

Key cross-cutting lesson: none of the calm developer-tool references rely on scroll-hijacking or heavy WebGL for the *content*; the spectacle sites (Stripe hero) quarantine their one effect and pause it off-screen. Cairn should behave like the dev-tool cohort.

## (c) Motion system — named, reusable patterns

All map onto existing tokens where possible. `--ease: cubic-bezier(0.2,0.8,0.2,1)` (ease-out family, correct per Kowalski's "never ease-in for UI"), `--spring: cubic-bezier(0.34,1.56,0.64,1)`.

1. **Reveal (entrance).** Existing: opacity 0→1 + translateY(14px)→0, `--dur-reveal: 0.6s`, `--ease`, staggered `calc(var(--i) * --reveal-step)` (70ms). Keep. This is the workhorse. Cap stagger chains at ~6 elements. Trigger with IntersectionObserver (already shipped) or, progressively, `animation-timeline: view()`.
2. **Text reveal (hero headline only).** Per-line mask: wrap each line in `overflow:hidden`, child `transform: translateY(110%)→0`, `transition: transform 0.8s cubic-bezier(0.16,1,0.3,1)`. Requires `display:inline-block` on spans. Use once, on the hero. Restraint note: per-word/char reveals read as "template" — line-level is more editorial and calmer.
3. **Number count-up.** For ring "82", retention "74%", deltas: animate a registered `@property --num { syntax:'<integer>'; }` (or JS rAF) over `--dur-data: 0.9s`, ease-out, rendered in JetBrains Mono tabular figures. Must show final value immediately under reduced motion.
4. **Ring draw.** SVG circle, `stroke-dasharray = circumference`, animate `stroke-dashoffset` from full→target over `--dur-draw: 1.1s`, `transform: rotate(-90deg)` origin center so it starts at 12 o'clock. Pairs with the count-up.
5. **Bar fill.** Retention bars animate `transform: scaleX()` (compositor-only) or width via `--w` custom property, `--dur-data`, `--ease`. Under reduced motion snap to `--w` (already the shipped pattern).
6. **Press micro-interaction.** `transform: scale(0.97)` on `:active`, `--dur-micro: 0.15s`. Never `scale(0)`; start ≥0.9.
7. **Hover lift (cards).** `--shadow-card` → `--shadow-card-hover` + translateY(-2px), `--dur-standard: 0.25s`. Compositor-friendly.
8. **Cursor-aware lighting (hero recreation only).** Track pointer into `--x/--y` CSS vars; a `::before` radial-gradient highlight follows with ~0.15 lerp. Keep alpha ≤0.06 so it's felt not seen. Desktop pointer only; disabled on touch and reduced-motion.
9. **When NOT to animate.** Never animate keyboard-initiated actions (the "Open the app" shortcut path), never animate on every high-frequency interaction, never let motion block input (all transitions interruptible). Theme toggle uses `--dur-theme: 0.4s` on color only.

Choreography principles: ease-out for entrances and user-triggered state changes; asymmetric timing (fast out, slightly slower in) where relevant; stagger creates reading direction (top-to-bottom, left-to-right); animate only `transform`/`opacity` to stay on the compositor. As Kowalski explains, "animate with transform and opacity as they only trigger the third rendering step (composite), while padding or margin triggers all three (layout, paint, composite)."

## (d) Bringing the three recreations to life

- **Overview ring (the one `--shadow-hero` surface).** On first scroll-into-view: ring draws (pattern 4, 1.1s) while "82" counts up (pattern 3, 0.9s) in JetBrains Mono; the three due-topics list reveals with 70ms stagger; optional cursor-light (pattern 8) at ≤0.06 alpha. This is where the "wow budget" is spent. Honesty: keep health 82, due topics 41/53/58%, Study+Exams only, no "Work logged."
- **Retention matrix.** Avg-retention stat counts up to 74% with the +4% delta chip fading in after; topic rows reveal top-down; bars fill (pattern 5). Diagnostic badges pop in last (scale 0.9→1). Numbers all tabular mono.
- **Validation card + new FAILURE state (deliverable I.1).** Build the validation-failure recreation for Step 2: a plain-English error naming the offending field and the fix, with a red diagnostic tag, rendered with the same token vocabulary as the success card. This is a high-leverage change: the page currently asserts strictness three times but never demonstrates it. Animate the ✓ counts ticking up on the success card; on the failure card, the error line reveals with a very short shake-free fade (no attention-grabbing motion — strictness reads as calm competence).

"It's real" cues: pixel-precise 1px inset top highlight (`--edge`), tabular figures, honest values. Subtle perspective/tilt is optional but easily overdone — recommend skipping tilt to stay calm.

## (e) Depth, light, texture — tasteful versions (and the backdrop-filter ban)

**Hard constraint B:** No `backdrop-filter` anywhere in a scroll region. Measured cost on this app: scrolling dropped from ~53 FPS to ~13 FPS (paint-bound). The 0.75-alpha `--surface` already reads as glass without blur. Any frosted-glass recommendation is rejected except for the non-scrolling ⌘K modal.

Cheap-fake toolkit (all GPU-cheap / composite-only or one-time paint):
- **Grain/noise:** one static SVG `feTurbulence` (`type='fractalNoise' baseFrequency≈0.65–0.9 numOctaves='3' stitchTiles='stitch'`) rendered once to a data-URI or PNG, tiled as a fixed overlay at ~3–6% opacity. Do NOT re-run the filter per frame. New token proposal: `--noise-alpha: 0.04`.
- **Radial washes:** the existing `--wash-1`/`--wash-2` (rgba ~0.05) as static `background` layers — no animation, no blur.
- **Depth:** `--shadow-card` / `--shadow-card-hover` / the single `--shadow-hero` do all the elevation work. Layered soft shadows > blur.
- **Edge highlight:** the 1px inset top edge via `box-shadow: inset 0 1px 0 var(--edge)` — the core material cue.
- **Spotlight/aurora (restrained):** only via `mask-image`/`radial-gradient` on an isolated, non-scrolling layer, alpha ≤0.06.
- **Verify with DevTools:** enable Paint Flashing (should stay dark during scroll); Performance panel → confirm no "Layout"/"Paint" during animations, only "Composite Layers"; animate only transform/opacity.

Dark-mode luminosity: `--surface: rgba(30,30,32,0.55)` + `--edge: rgba(255,255,255,0.08)` inset highlight gives the lifted-glass look with zero blur.

## (f) Tech-stack & architecture recommendation

**Decision: keep the landing page vanilla TS + Vite (option i). Do NOT convert to React; do NOT add Lenis; do NOT add GSAP.**

Rationale by option:
- **(i) Vanilla TS + native/tiny-lib motion — RECOMMENDED.** Migration cost: ~zero (build on existing `reveal.ts`/`theme-toggle.ts`/`clipboard.ts`). First-paint cost: lowest — current JS is a few KB; motion via CSS scroll-driven animations + WAAPI adds ~0. Maintenance: existing Vitest suite stays valid. First paint stays fast; blocking inline `data-theme` script preserved.
- **(ii) Full React conversion — REJECTED.** Migration cost: high (rewrite all modules + the colocated Vitest suite). First-paint cost: React + ReactDOM lands at roughly 100–150KB min+gzip before any application code. No commensurate benefit for a largely static page.
- **(iii) Islands (Preact/compat mounted only on interactive regions) — acceptable fallback if component ergonomics demand JSX.** Preact core is ~4.7KB min+gzip (11.7KB minified; the "3kB" figure is Preact's own GitHub tagline, "Fast 3kB alternative to React with the same modern API," which slightly understates the real min+gzip). `preact/compat` adds ~+2KB (a documentation estimate) but is side-effectful and not tree-shakeable. Only justified if the recreations become genuinely stateful; islands keep the static shell fast and hydrate just the ring/matrix.

Animation libraries considered (all figures min+gzip, 2026 versions):
- **Native CSS + WAAPI — CHOSEN.** 0KB, hardware-accelerated, self-hosted by definition, no CDN, no license. Covers reveals, ring draw, count-up (`@property`), bars, hover/press.
- **Motion (`motion`, v12.42.2)** — full React import ~34KB (per motion.dev: "impossible for bundlers to tree shake it any smaller than 34kb"); LazyMotion + `m` ~4.6KB; `useAnimate` mini 2.3KB ("the smallest animation library available for React"). Only relevant under islands; not needed for CSS-doable effects.
- **GSAP core (v3.15.0) ~23KB + ScrollTrigger (~18.3KB per Bundlephobia-attributed sources; a second source estimates ~10KB — figures conflict)** — powerful but REJECTED on values grounds. GSAP became 100% free including all former Club plugins as of April 30 2025, but under a Webflow-owned license: the GSAP Standard License states "Webflow may terminate this GSAP License and revoke your access in its discretion if you fail to comply," and "All intellectual property rights in GSAP Products… remain the exclusive property of Webflow." For a product whose entire pitch is "own your data, no lock-in," a revocable, non-OSI license is a poor values fit. Technically also overkill vs native CSS here.
- **Lenis (v1.3.11, <4KB / ~3–3.6KB)** — REJECTED. The page already deleted a JS smooth-scroll handler because `preventDefault()` broke hash updates, history and focus transfer; native `scroll-behavior: smooth` + `scroll-margin-top` is retained. Lenis is well-built and keeps sticky/anchors intact, but adds a rAF scroll loop, must be fully disabled under reduced-motion, caps at 60FPS on Safari (30 in Low Power Mode), and the calm dev-tool references don't rely on it. Not worth it here.
- **CSS scroll-driven animations** — use behind `@supports (animation-timeline: view())`. Support 2026: Chrome/Edge 115+ full, Safari 26 full (threaded scroll-driven animations added in 26.4), Firefox still behind `layout.css.scroll-driven-animations.enabled` flag in stable (Firefox 152, June 2026) though it's an Interop 2026 priority; caniuse ~82–85% global. Fallback: element visible in final state (the IntersectionObserver reveal already provides this).
- **`@property`** — Baseline / universally supported in 2026 (~95%+). Use for count-up and any animatable custom property; fallback is the static final value.
- **View Transitions** — same-page shipped in Chrome/Safari; Firefox partial early 2026. Not needed for a single scrolling page.
- **Icons:** hand-authored inline SVG (no icon-font CDN). No emoji icons (guardrail).

**Fonts (constraint C):** keep self-hosted `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono`; zero third-party font/script/analytics CDN. Families are registered as `'Inter Variable'` / `'JetBrains Mono Variable'` — keep the token aliases.

## (g) Accessibility & robustness — per-effect reduced-motion degradation

Preserve the shipped discipline: durations set to **0.01ms not `none`** (so `transitionend`/`animationend` still fire and JS state machines don't deadlock); reveal elements forced visible (`opacity:1!important; transform:none!important`); progress bars snap to `--w`; `scroll-behavior` forced `auto`.

| Effect | Reduced-motion degrade-to |
|---|---|
| Reveal | Instant visible (opacity 1, no translate) |
| Hero text reveal | Instant visible, no mask slide |
| Count-up | **Final value rendered immediately** (never blank) |
| Ring draw | Ring shown at final offset instantly |
| Bar fill | Snap to `--w` |
| Cursor light | Disabled entirely (also on touch) |
| Hover lift / press | Retain (opacity/very short) or reduce to color only |
| Theme toggle | Color change only, 0.01ms |

Other robustness: keyboard operability and visible focus states on both CTAs, nav, theme toggle, copy button (follow Rauno's Web Interface Guidelines); the desktop CTA stays a genuine `<button disabled>` with future-tense copy and must not look available (constraint I.2 / J); colour contrast checked in both themes (`--ink` on `--bg-page` passes; verify `--ink-secondary`/`--ink-muted` on surfaces); avoid layout shift by reserving space for revealed elements (translateY not display toggling); count-up must not cause reflow (fixed-width tabular mono). Note the CSS Fonts 4 gotcha: a body-level `font-feature-settings: 'tnum' 0` silently cancels `font-variant-numeric: tabular-nums` on descendants — re-enable tabular-nums explicitly on every measured-number element.

## (h) Section-by-section elevation plan (nine bands)

Wow budget: spend it on **Hero + the three recreations**. Everything else stays quiet.

1. **Top bar.** Highest-impact: a hairline bottom border that gains a hair more contrast on scroll (`--border`→`--border-strong`) via IntersectionObserver sentinel — signals depth without blur. Restraint: no shrink/hide animation; keyboard focus order intact.
2. **Hero.** Wow spend. Line-masked headline reveal (pattern 2) once; Overview ring draws + counts up; two CTAs with press micro-interaction; optional cursor-light ≤0.06 alpha. Restraint: one effect at a time, no floating blobs, single `--shadow-hero` stays here.
3. **Problem (one line).** Highest-impact: a slow, single-line reveal with generous measure (~60–70ch) and `--fs-prop`/`--fs-title`. Restraint: no decoration; let the sentence breathe.
4. **How it works (3 steps).** Add the **validation FAILURE recreation** to Step 2 (deliverable I.1) — the biggest content upgrade on the page. Copy-block gets a real copy-to-clipboard press state; ✓ counts tick up. Restraint: steps reveal as a 3-stagger, not individually animated.
5. **Memory model / retention matrix.** Count-up avg-retention + delta chip, bars fill, badges last. Restraint: data animates once on entry, never loops.
6. **Exams recalibrate.** Highest-impact: a small before/after decay-curve visual where the curve redraws (stroke-dashoffset) to a shallower slope when a test event lands. Restraint: single subtle redraw, tabular numbers.
7. **Privacy (no accounts/backend/network/one JSON).** Keep austere — four crisp lines, mono for any count. Restraint: this section's credibility comes from plainness; near-zero motion.
8. **Choose your way in.** Two cards; "Open the app" gets hover-lift + press; "Download for desktop" stays visibly disabled (dimmed, `disabled` button, future-tense) — must not look available. No-sync honesty line in `--ink-secondary`.
9. **Closer.** Wordmark, both CTAs once more, quiet footer. Restraint: a single gentle reveal; no finale animation.

## (i) React Bits / component-kit resolution (constraint H)

Reusable as *mechanism* (safe — these are generic techniques, not a house style): count-up/number ticker, split-text stagger reveal, spotlight/cursor-gradient card, shiny/gradient-text (used once, sparingly), scroll-reveal wrappers. Rebuild these by hand from the underlying CSS/SVG/WAAPI so they carry no library fingerprint.

Carries a recognizable "house style" — AVOID (would make Cairn look like every other AI-kit site): animated aurora/gradient-mesh backgrounds, particle/sparkles fields, floating 3D blobs, "shiny border beam" cards, tilt-on-hover 3D cards, marquee logo walls, and anything with the default neon-on-black palette. React Bits' own documentation warns: "Less Is More: Using more than 2-3 components on a page is not advised, it can overload your page with animations, potentially impacting performance or UX." For Cairn the working number is effectively the handful of *mechanisms* above, hand-built.

## (j) Prioritised list — the ~15 highest-leverage changes (most impactful first)

1. **Make the Overview ring physical:** draw (stroke-dashoffset, 1.1s) + count-up "82" in tabular mono (0.9s), on scroll-in. Biggest single "well-made" lever.
2. **Add the validation FAILURE recreation to Step 2** — demonstrates strictness the page only asserts; fixes the middle-card visual gap.
3. **Animate the retention matrix data** — count-up avg 74%, +4% delta chip, bars fill, badges last; all tabular mono.
4. **Enforce the tabular-mono numeral rule everywhere** and fix the `font-feature-settings 'tnum' 0` cancellation gotcha so `tabular-nums` actually applies.
5. **Line-masked hero headline reveal** (once, 0.8s expo-out) — editorial, calm.
6. **Keep it vanilla TS; add motion via native CSS scroll-driven animations behind `@supports` + WAAPI** — zero bundle, fast first paint, existing Vitest suite intact.
7. **Ban backdrop-filter; add one static SVG-noise overlay (~4% alpha) + keep layered shadows** for tasteful depth at composite-only cost.
8. **Standardise the reveal system on tokens** (`--dur-reveal` 0.6s, `--ease`, 70ms stagger, ≤6-item chains) and verify compositor-only via DevTools Paint Flashing.
9. **Press + hover-lift micro-interactions** on CTAs and cards (`scale(0.97)` 0.15s; shadow-card→hover 0.25s).
10. **Reject Lenis; keep native `scroll-behavior: smooth` + `scroll-margin-top`** — preserves hash/history/focus/find-in-page.
11. **Reject GSAP on values grounds** (Webflow-owned, revocable, non-OSI) — conflicts with Cairn's no-lock-in pitch; native CSS covers the needs.
12. **Cursor-aware hero light at ≤0.06 alpha**, desktop-only, off under reduced-motion/touch — felt, not seen.
13. **Per-effect reduced-motion degradation** using the 0.01ms discipline; count-ups render final value immediately; bars snap to `--w`.
14. **Exams section decay-curve redraw** — one subtle stroke-dashoffset redraw to a shallower slope on test event.
15. **Top-bar hairline that firms on scroll** (`--border`→`--border-strong`) and keep the desktop CTA a genuine disabled button — depth and honesty without spectacle.

## Caveats

- Bundle/size figures are 2026 values from named sources (Motion's three figures are confirmed verbatim from motion.dev; GSAP 3.15.0 and Motion 12.42.2 versions from npm/Snyk). The GSAP ScrollTrigger figure is disputed between sources (~18.3KB Bundlephobia-attributed vs ~10KB approximate) and GSAP is not recommended regardless. Preact/compat's ~2KB is a documentation estimate — the submodule is side-effectful and not independently measurable on Bundlephobia.
- CSS scroll-driven animations are not yet Baseline because Firefox stable keeps them behind a flag as of June 2026 (~82–85% global); always ship behind `@supports` with the IntersectionObserver reveal as the fallback.
- The Stripe mesh-gradient and most React-Bits "background" effects are documented here as *technique references only*; they are explicitly out of scope for Cairn's aesthetic and would violate the no-gradient-blob guardrail if used literally.
- "Number/health" values in all recreations must remain the honest derived figures (82; 41/53/58%; 74% / +4%) and Study+Exams-only; do not introduce removed Fitness/Jobs/Work-logged content.
- Kowalski's motion guidance and Rauno's Web Interface Guidelines are opinionated primary sources reflecting a specific (widely respected) taste; they are recommendations, not standards — but they align tightly with Cairn's existing restraint and are safe to adopt wholesale.