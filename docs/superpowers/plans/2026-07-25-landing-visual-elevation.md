# Cairn Landing Page — Visual Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the (already correct, vanilla) landing page to a premium, "quiet-engineered" standard by making the three product recreations physically animate and by adding restrained, token-driven motion and depth — all vanilla CSS/WAAPI, no React, no WebGL, no new runtime dependencies.

**Architecture:** Keep the page vanilla TS + Vite. Add one small, unit-tested animation module (`landing/animate.ts`) that drives count-ups, the ring draw, and bar fills on scroll-into-view via an injectable `IntersectionObserver` (mirroring the existing `reveal.ts` pattern), plus one small cursor-light helper. All visual effects are CSS transitions/`@property` toggled by a class or CSS variable; JS only sets the target and the trigger. Every effect degrades under `prefers-reduced-motion` to its final state (never hidden), reusing the app's 0.01ms discipline.

**Tech Stack:** Vanilla TypeScript (strict), Vite 5 multi-page, Vitest + jsdom, native CSS (transitions, `@property`, `stroke-dashoffset`, `mask`/`overflow` line reveals), WAAPI/`requestAnimationFrame`. Icons remain inline SVG via `lucide`. No GSAP, no Lenis, no Motion, no three.js/R3F.

**Design source:** `docs/Landing/compass_artifact_wf-6b80a6a9-0343-58e2-896b-abcbbc6565e4_text_markdown.md` (the research report; sections cited as "research §x"). Values below are copied from it.

## Global Constraints

Every task's requirements implicitly include these:

- **Vanilla only.** No React, no WebGL/three.js/R3F, no GSAP, no Lenis, no Motion. No new runtime dependencies (research §f).
- **No `backdrop-filter`** anywhere in a scroll region (measured 53→13 FPS regression). The 0.75-alpha `--surface` already reads as glass (research §e).
- **Animate only `transform` and `opacity`** (and `stroke-dashoffset`/`width` on the recreations, entering once). Verify compositor-only via DevTools Paint Flashing (research §c, §e).
- **`prefers-reduced-motion` is a hard gate.** Durations collapse to 0.01ms (not `none`, so `transitionend` still fires); reveals forced visible; count-ups render their **final value immediately** (never blank); bars/rings snap to final; cursor-light disabled (research §g).
- **Reuse tokens.** Colour/type/spacing/radius/shadow/motion come from `src/styles/tokens.css` via `landing/styles/base.css`. Never restate raw values. Existing motion tokens: `--ease` `cubic-bezier(0.2,0.8,0.2,1)`, `--spring` `cubic-bezier(0.34,1.56,0.64,1)`, `--dur-micro` 0.15s, `--dur-standard` 0.25s, `--dur-reveal` 0.6s, `--dur-data` 0.9s, `--dur-draw` 1.1s, `--reveal-step` 70ms.
- **Tabular mono on every measured number.** `.mono-num` must explicitly set `font-variant-numeric: tabular-nums` — a body-level `font-feature-settings: 'tnum' 0` silently cancels it on descendants (research §g caveat).
- **Content truth.** Study + Exams only. Honest values only: health **82**; due topics **41/53/58%**; retention avg **74%**, **+4%**/30d; matrix rows 41/53/67/58%. No Fitness/Jobs/Work-logged content (research caveats).
- **Restraint.** One effect at a time per section; wow budget spent on Hero + the three recreations; everything else quiet. No gradient-blob/mesh hero, no particle fields, no tilt cards, no emoji feature icons (research §i, §h).
- **Progressive enhancement is relaxed** for this page (JS may drive motion), but **all content stays in the static HTML** and readable; motion is additive only. Keyboard operability and visible focus on every interactive element.
- Package manager is **npm**. `npx tsc -b --noEmit` typechecks; `npm test` runs Vitest; `npm run build` builds; `npm run preview` serves the build.

**Baseline:** branch `landing-redesign`, forked from `main`. The R3F/three stack has already been removed. `tsc`, `build`, and the 314-test suite are green at the start of this plan.

---

### Task 1: CSS foundation — numerals, micro-interactions, depth

Token-only groundwork with no new markup: fix the tabular-numeral cancellation, add the press/hover-lift micro-interactions, and add the static noise overlay for depth. No JS. This task deliberately has no visual regression risk beyond these additive rules.

**Files:**
- Modify: `landing/styles/base.css`
- Modify: `src/styles/tokens.css` (add one token, both themes)

**Interfaces:**
- Produces: CSS classes/behaviours `.mono-num` (guaranteed tabular), `.btn-primary`/`.btn-secondary`/`.card` press+hover states, a `body::after` noise overlay, and the token `--noise-alpha`.

- [ ] **Step 1: Add the `--noise-alpha` token to `src/styles/tokens.css`**

In the `:root` block (with the other layout params, near `--content-max`), add:
```css
  --noise-alpha: 0.04; /* landing depth grain (research §e); composite-only overlay */
```

- [ ] **Step 2: Guarantee tabular numerals in `landing/styles/base.css`**

Find the existing `.mono-num` rule and ensure it reads exactly (add `font-variant-numeric` if missing — it counters the body `'tnum' 0` cancellation, research §g):
```css
.mono-num {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: 0;
}
```

- [ ] **Step 3: Add press + hover-lift micro-interactions to `landing/styles/base.css`**

Append (research §c patterns 6–7; compositor-only):
```css
/* Press: never scale from 0; ≥0.9. Reduced-motion collapses the duration. */
.btn-primary:active, .btn-secondary:active { transform: scale(0.97); }
.btn-primary, .btn-secondary { transition:
  box-shadow var(--dur-standard) var(--ease),
  background-color var(--dur-standard) var(--ease),
  transform var(--dur-micro) var(--ease); }

/* Hover-lift for cards (the ones that aren't the hero recreation). */
.card { transition: box-shadow var(--dur-standard) var(--ease), transform var(--dur-standard) var(--ease); }
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover), inset 0 1px 0 var(--edge); }
}
```

- [ ] **Step 4: Add the static noise overlay to `landing/styles/base.css`**

A single, one-time-painted SVG `feTurbulence` as a fixed overlay (research §e: `fractalNoise`, `baseFrequency 0.65–0.9`, `numOctaves 3`, `stitchTiles stitch`). Never animated. Append:
```css
/* Depth grain — one static SVG turbulence, tiled, fixed, composite-only.
   Do NOT animate it; it paints once. pointer-events:none so it never eats clicks. */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: var(--noise-alpha);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  mix-blend-mode: overlay;
}
@media (prefers-reduced-motion: reduce) { /* overlay is static; nothing to disable */ }
```

- [ ] **Step 5: Verify build + no backdrop-filter regressions**

Run: `npx tsc -b --noEmit && npm run build`
Then: `grep -rn "backdrop-filter" landing/ || echo "none — good"`
Expected: build PASS; "none — good".

- [ ] **Step 6: Commit**
```bash
git add src/styles/tokens.css landing/styles/base.css
git commit -m "feat(landing): tabular-numeral fix, press/hover micro-interactions, noise depth"
```

---

### Task 2: Animation core module (TDD)

The pure animation math + DOM drivers + a scroll-trigger orchestrator, all injectable and unit-tested. jsdom has no `IntersectionObserver` and no real clock, so both are injected (as in `reveal.ts`).

**Files:**
- Create: `landing/animate.ts`
- Test: `landing/animate.test.ts`

**Interfaces:**
- Produces:
  - `clamp01(t: number): number`
  - `easeOutCubic(t: number): number`
  - `countUpValue(to: number, elapsedMs: number, durationMs: number): number` — rounded integer, eased, clamped to `to`.
  - `ringOffset(pct: number): number` — for `pathLength="100"`: `100 - clamp(pct,0,100)`.
  - `type AnimateDeps = { reducedMotion: boolean; now?: () => number; raf?: (cb: FrameRequestCallback) => number; createObserver?: (cb: IntersectionObserverCallback) => { observe(el: Element): void } }`
  - `animateGroup(group: Element, deps: AnimateDeps): void` — runs every `[data-countup]`, `.ring`, and bars container inside `group`.
  - `setupDataAnimations(groups: Iterable<Element>, deps: AnimateDeps): void` — reduced-motion runs all immediately; otherwise observes each and runs on first intersection.

- [ ] **Step 1: Write the failing test — `landing/animate.test.ts`**
```ts
import { describe, it, expect, vi } from 'vitest';
import {
  clamp01, easeOutCubic, countUpValue, ringOffset, animateGroup, setupDataAnimations,
} from './animate';

describe('pure helpers', () => {
  it('clamp01 clamps to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
  it('easeOutCubic hits endpoints and eases', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // ease-out is above the diagonal
  });
  it('countUpValue starts at 0, ends at target, rounds', () => {
    expect(countUpValue(82, 0, 900)).toBe(0);
    expect(countUpValue(82, 900, 900)).toBe(82);
    expect(countUpValue(82, 2000, 900)).toBe(82); // clamps past duration
    expect(countUpValue(82, 450, 0)).toBe(82);     // zero duration -> final
  });
  it('ringOffset maps percent to dashoffset for pathLength=100', () => {
    expect(ringOffset(0)).toBe(100);
    expect(ringOffset(82)).toBe(18);
    expect(ringOffset(100)).toBe(0);
    expect(ringOffset(120)).toBe(0); // clamps
  });
});

function group(html: string): HTMLElement {
  const g = document.createElement('div');
  g.setAttribute('data-animate', '');
  g.innerHTML = html;
  return g;
}

describe('animateGroup — reduced motion snaps to final', () => {
  it('count-up shows final value, ring is drawn, bars filled — no clock used', () => {
    const g = group(`
      <span class="ring"><svg><circle class="ring-arc"/></svg></span>
      <span data-countup="82" data-countup-suffix="">0</span>
      <div class="bars"><span class="bar-fill"></span></div>
    `);
    (g.querySelector('.ring') as HTMLElement).style.setProperty('--arc', '82');
    const raf = vi.fn();
    animateGroup(g, { reducedMotion: true, raf });
    expect(g.querySelector('[data-countup]')!.textContent).toBe('82');
    expect(g.querySelector('.ring')!.classList.contains('is-drawn')).toBe(true);
    expect(g.querySelector('.ring')!.getAttribute('style')).toContain('--offset: 18');
    expect(g.querySelector('.bars')!.classList.contains('is-filled')).toBe(true);
    expect(raf).not.toHaveBeenCalled();
  });
});

describe('setupDataAnimations', () => {
  it('reduced motion animates every group immediately, no observer', () => {
    const a = group('<span data-countup="10">0</span>');
    const b = group('<span data-countup="20">0</span>');
    const createObserver = vi.fn();
    setupDataAnimations([a, b], { reducedMotion: true, createObserver });
    expect(a.querySelector('[data-countup]')!.textContent).toBe('10');
    expect(b.querySelector('[data-countup]')!.textContent).toBe('20');
    expect(createObserver).not.toHaveBeenCalled();
  });
  it('with motion, observes each group', () => {
    const a = group('<span data-countup="10">0</span>');
    const observe = vi.fn();
    const createObserver = vi.fn(() => ({ observe }));
    setupDataAnimations([a], { reducedMotion: false, createObserver });
    expect(createObserver).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(a);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- landing/animate.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `landing/animate.ts`**
```ts
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

export function countUpValue(to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return to;
  return Math.round(to * easeOutCubic(elapsedMs / durationMs));
}

export function ringOffset(pct: number): number {
  const c = pct < 0 ? 0 : pct > 100 ? 100 : pct;
  return 100 - c;
}

export type AnimateDeps = {
  reducedMotion: boolean;
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  createObserver?: (cb: IntersectionObserverCallback) => { observe(el: Element): void };
};

function driveCountUp(el: HTMLElement, deps: AnimateDeps): void {
  const to = Number(el.dataset.countup ?? el.textContent ?? '0');
  const suffix = el.dataset.countupSuffix ?? '';
  const dur = Number(el.dataset.countupDur ?? 900);
  const render = (n: number) => { el.textContent = `${n}${suffix}`; };
  if (deps.reducedMotion || dur <= 0) { render(to); return; }
  const now = deps.now ?? (() => performance.now());
  const raf = deps.raf ?? ((cb) => requestAnimationFrame(cb));
  const start = now();
  const tick = () => {
    const elapsed = now() - start;
    render(countUpValue(to, elapsed, dur));
    if (elapsed < dur) raf(tick); else render(to);
  };
  raf(tick);
}

function driveRing(ring: HTMLElement): void {
  const arc = Number(getComputedStyle(ring).getPropertyValue('--arc') || ring.style.getPropertyValue('--arc') || '0');
  ring.style.setProperty('--offset', String(ringOffset(arc)));
  ring.classList.add('is-drawn'); // CSS transitions stroke-dashoffset to var(--offset)
}

export function animateGroup(group: Element, deps: AnimateDeps): void {
  group.querySelectorAll<HTMLElement>('[data-countup]').forEach((el) => driveCountUp(el, deps));
  group.querySelectorAll<HTMLElement>('.ring').forEach(driveRing);
  group.querySelectorAll('.bars').forEach((b) => b.classList.add('is-filled'));
}

export function setupDataAnimations(groups: Iterable<Element>, deps: AnimateDeps): void {
  const list = [...groups];
  if (deps.reducedMotion) { list.forEach((g) => animateGroup(g, deps)); return; }
  const create =
    deps.createObserver ??
    (typeof IntersectionObserver !== 'undefined'
      ? (cb: IntersectionObserverCallback) => new IntersectionObserver(cb, { rootMargin: '0px 0px -15% 0px' })
      : undefined);
  if (!create) { list.forEach((g) => animateGroup(g, deps)); return; }
  const observer = create((entries, obs) => {
    for (const entry of entries) {
      if (entry.isIntersecting) { animateGroup(entry.target, deps); obs.unobserve(entry.target); }
    }
  });
  list.forEach((g) => observer.observe(g));
}
```
Note: `driveRing` reads `--arc` via `getComputedStyle`; in jsdom that returns `''`, so the test sets `ring.style --arc` and the fallback `ring.style.getPropertyValue('--arc')` supplies `82`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- landing/animate.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**
```bash
git add landing/animate.ts landing/animate.test.ts
git commit -m "feat(landing): animation core — count-up, ring geometry, scroll-trigger (TDD)"
```

---

### Task 3: Overview ring draws + course-health counts up

Wire the hero Overview recreation (the single `--shadow-hero` surface, research §d) so the ring draws and "82" counts up on scroll-into-view. This is the biggest single "well-made" lever (research §j.1).

**Files:**
- Modify: `landing/index.html` (mark the hero mock as an animation group; make the health number a count-up target)
- Modify: `landing/styles/recreations.css` (ring draw initial state + transition; reduced-motion snap)
- Modify: `landing/main.ts` (call `setupDataAnimations`)

**Interfaces:**
- Consumes: `setupDataAnimations`, `AnimateDeps` (Task 2).

- [ ] **Step 1: Mark the hero group + count-up target in `landing/index.html`**

On the hero recreation container `<div class="mock mock-hero" id="mock-overview" …>` add `data-animate`. Change the ring number span from `<span class="ring-num mono-num">82</span>` to:
```html
<span class="ring-num mono-num" data-countup="82" data-countup-dur="900">82</span>
```
(The static `82` stays as the no-JS/pre-animation value; JS resets to 0→82 only when it runs.) The `.ring` element already carries `style="--arc:82"`.

- [ ] **Step 2: Ring draw CSS in `landing/styles/recreations.css`**

Replace the static `.ring-arc { … stroke-dasharray: 82 100; }` with a draw-on-demand pattern:
```css
.ring-arc {
  fill: none; stroke: var(--accent); stroke-width: 12; stroke-linecap: round;
  stroke-dasharray: 100;            /* pathLength=100 on the element */
  stroke-dashoffset: 100;           /* start empty */
}
.ring.is-drawn .ring-arc {
  stroke-dashoffset: var(--offset); /* JS sets --offset = 100 - arc */
  transition: stroke-dashoffset var(--dur-draw) var(--ease);
}
/* No-JS / pre-trigger fallback: show the arc at its final value so the ring is
   never empty for users the observer hasn't fired for. --arc is on .ring. */
.js .ring:not(.is-drawn) .ring-arc { stroke-dashoffset: calc(100 - var(--arc)); }
@media (prefers-reduced-motion: reduce) {
  .ring.is-drawn .ring-arc { transition-duration: 0.01ms; }
}
```
Keep the `transform: rotate(-90deg)` origin-center already on `.ring-svg` so the arc starts at 12 o'clock.

- [ ] **Step 3: Wire `setupDataAnimations` in `landing/main.ts`**

Add the import beside the others:
```ts
import { setupDataAnimations } from './animate';
```
And after the existing `setupReveals(...)` line:
```ts
setupDataAnimations(document.querySelectorAll('[data-animate]'), { reducedMotion });
```

- [ ] **Step 4: Verify build + typecheck + suite**

Run: `npx tsc -b --noEmit && npm test && npm run build`
Expected: PASS (existing suite + animate tests).

- [ ] **Step 5: Verify in the browser**

Run: `npm run preview`. Load `/landing/`, scroll the hero into view: the ring draws over ~1.1s while "82" counts up in tabular mono. Toggle `prefers-reduced-motion`: ring and number appear at final state instantly, never blank.

- [ ] **Step 6: Commit**
```bash
git add landing/index.html landing/styles/recreations.css landing/main.ts
git commit -m "feat(landing): Overview ring draws and course-health counts up on scroll-in"
```

---

### Task 4: Retention matrix comes alive

Count-up the avg-retention stat, fade the delta chip in, fill the bars, pop the badges last (research §d, §j.3). Uses the Task 2 engine and the same reduced-motion discipline.

**Files:**
- Modify: `landing/index.html` (mark the matrix as a group; count-up + bars hooks)
- Modify: `landing/styles/recreations.css` (bar fill + delta/badge entrance)

**Interfaces:**
- Consumes: `setupDataAnimations` (already wired in Task 3 — it picks up any `[data-animate]`).

- [ ] **Step 1: Mark the matrix group + hooks in `landing/index.html`**

On `<div class="mock mock-matrix" id="mock-matrix" …>` add `data-animate`. Change the stat number `<span class="matrix-stat-num mono-num">74%</span>` to:
```html
<span class="matrix-stat-num mono-num" data-countup="74" data-countup-suffix="%" data-countup-dur="900">74%</span>
```
Wrap the four `.matrix-row` bars' parent with the fill hook: add class `bars` to `<div class="matrix-rows">` → `<div class="matrix-rows bars">`.

- [ ] **Step 2: Bar-fill + delta/badge entrance CSS in `landing/styles/recreations.css`**

```css
.bar-fill {
  display: block; height: 100%; width: var(--w);
  background: var(--accent); border-radius: inherit;
}
.js .bars .bar-fill { width: 0; }
.js .bars.is-filled .bar-fill { width: var(--w); transition: width var(--dur-data) var(--ease); }

/* Delta chip + diagnostic badges settle in after the bars (compositor-only). */
.js .bars .chip-delta, .js .bars .badge { opacity: 0; transform: translateY(2px); }
.js .bars.is-filled .chip-delta,
.js .bars.is-filled .badge {
  opacity: 1; transform: none;
  transition: opacity var(--dur-standard) var(--ease) 0.25s, transform var(--dur-standard) var(--ease) 0.25s;
}
@media (prefers-reduced-motion: reduce) {
  .js .bars .bar-fill { width: var(--w); }
  .js .bars .chip-delta, .js .bars .badge { opacity: 1; transform: none; }
}
```
(The `.chip-delta` lives in `.matrix-head`, not inside `.matrix-rows`; move the `bars` class to the whole `.mock-matrix` instead if you want the delta/badges gated together — put `bars` on `#mock-matrix` and keep `matrix-rows` as-is. Choose one: **put `bars` on `#mock-matrix`** so both the head chip and the row badges are covered, and update Step 1 accordingly.)

- [ ] **Step 3: Reconcile the `bars` hook placement**

Per the note above, in `index.html` put `bars` on the group root: `<div class="mock mock-matrix bars" id="mock-matrix" data-animate …>` and leave `.matrix-rows` unchanged. `animateGroup` adds `is-filled` to any `.bars` inside the group **and** the group itself is a `.bars`, so add `.bars` to the querySelector target: confirm `animateGroup` uses `group.querySelectorAll('.bars')` — since the root won't match its own `querySelectorAll`, also toggle the root. Update `animate.ts` `animateGroup` bars line to:
```ts
  const bars = group.matches('.bars') ? [group, ...group.querySelectorAll('.bars')] : [...group.querySelectorAll('.bars')];
  bars.forEach((b) => (b as Element).classList.add('is-filled'));
```
Add a test to `animate.test.ts` asserting a group that *is* `.bars` gets `is-filled` under reduced motion; run `npm test -- landing/animate.test.ts` → PASS.

- [ ] **Step 4: Verify build + suite + browser**

Run: `npx tsc -b --noEmit && npm test && npm run build`, then `npm run preview` and scroll the memory band in: avg counts to 74%, bars fill, delta chip + badges settle after. Reduced motion → all final instantly.

- [ ] **Step 5: Commit**
```bash
git add landing/index.html landing/styles/recreations.css landing/animate.ts landing/animate.test.ts
git commit -m "feat(landing): retention matrix animates — count-up, bar fill, delta/badge settle"
```

---

### Task 5: Validation failure recreation (Step 2 demonstrates strictness)

The page asserts strictness three times but never shows it (research §d, §j.2). Replace the abstract Step-2 "schema check" card with a concrete **failure** preview: a rejected field named in plain English with the fix, using the same token vocabulary as the success card. No new JS.

**Files:**
- Modify: `landing/index.html` (`#mock-schema-check` contents)
- Modify: `landing/styles/recreations.css` (failure tag + error line styles)

- [ ] **Step 1: Rebuild the Step-2 mock in `landing/index.html`**

Replace the current `#mock-schema-check` block with an honest rejection example:
```html
<div class="mock mock-validation" id="mock-schema-check" role="img"
  aria-label="A validation error: the field difficulty is not allowed by the schema. Cairn names the field and the fix instead of failing silently.">
  <div class="val-head">
    <span class="val-file mono-num">paste.json</span>
    <span class="tag tag-danger">rejected</span>
  </div>
  <div class="val-error">
    <span class="val-error-field mono-num">topics[3].difficulty</span>
    <span class="val-error-msg">is not an allowed field. Remove it — difficulty is measured, not declared.</span>
  </div>
  <p class="val-note">Nothing is saved when a paste doesn't fit.</p>
</div>
```

- [ ] **Step 2: Failure styles in `landing/styles/recreations.css`**

```css
.tag-danger { color: var(--danger); background: var(--danger-soft); }
.val-error { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-5); }
.val-error-field { font-size: var(--fs-secondary); color: var(--danger); }
.val-error-msg { font-size: var(--fs-secondary); color: var(--ink-secondary); line-height: 1.45; }
```
Restraint (research §d): no shake, no attention-grabbing motion — the card simply reveals with the section. Strictness reads as calm competence.

- [ ] **Step 3: Verify build + honest-content + both themes**

Run: `npm run build`, then `grep -rin "work logged\|fitness\|lifting\|running\|jobs" landing/index.html || echo clean`. Load `/landing/` in both themes; the danger tag/red field use `--danger`/`--danger-soft` and pass contrast.
Expected: build PASS; "clean".

- [ ] **Step 4: Commit**
```bash
git add landing/index.html landing/styles/recreations.css
git commit -m "feat(landing): Step 2 shows a real validation failure, not just an assertion"
```

---

### Task 6: Hero line-masked headline reveal

The one editorial text effect (research §c pattern 2, §j.5): each headline line sits in an `overflow:hidden` clip and slides up once. Line-level, never per-word/char (that reads as templated).

**Files:**
- Modify: `landing/index.html` (wrap headline lines)
- Modify: `landing/styles/base.css` (mask reveal)

- [ ] **Step 1: Wrap the headline lines in `landing/index.html`**

The headline is one sentence across two natural lines. Wrap each in a masked line:
```html
<h1 class="hero-headline" id="hero-headline">
  <span class="line"><span class="line-in">Your AI can teach you anything.</span></span>
  <span class="line"><span class="line-in">It just can't remember you learned it.</span></span>
</h1>
```

- [ ] **Step 2: Line-mask CSS in `landing/styles/base.css`**

```css
.hero-headline .line { display: block; overflow: hidden; }
.hero-headline .line-in { display: inline-block; will-change: transform; }
.js .hero-headline .line-in { transform: translateY(110%); }
.js .reveal.is-visible .hero-headline .line-in,
.js .hero-copy.is-visible .hero-headline .line-in {
  transform: none;
  transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}
.js .hero-headline .line:nth-child(2) .line-in { transition-delay: 80ms; }
@media (prefers-reduced-motion: reduce) {
  .js .hero-headline .line-in { transform: none !important; }
}
```
Note: the hero copy block already carries `.reveal`; confirm the selector matches its `is-visible` class (from `reveal.ts`). If the headline is not inside a `.reveal` ancestor, add `reveal` to the `<h1>` or trigger via the hero group.

- [ ] **Step 3: Verify build + browser + reduced motion + no-JS**

Run: `npm run build && npm run preview`. On load, the two lines slide up from their masks once. Reduced motion: lines shown instantly. With JS disabled: `.js` is absent, `.line-in` has no transform → text fully visible.

- [ ] **Step 4: Commit**
```bash
git add landing/index.html landing/styles/base.css
git commit -m "feat(landing): line-masked hero headline reveal (once, expo-out)"
```

---

### Task 7: Cursor-aware hero light (TDD helper)

A pointer-tracked radial highlight on the hero recreation only, felt not seen (alpha ≤0.06), desktop-pointer only, off under reduced-motion/touch (research §c pattern 8, §j.12). The lerp/coord math is pure and tested; the DOM wiring is thin.

**Files:**
- Create: `landing/cursor-light.ts`
- Test: `landing/cursor-light.test.ts`
- Modify: `landing/styles/recreations.css` (the `::before` highlight)
- Modify: `landing/main.ts` (wire it, gated)

**Interfaces:**
- Produces:
  - `lerp(a: number, b: number, t: number): number`
  - `relativePosition(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): { x: number; y: number }` — returns 0–1 fractions, clamped.
  - `setupCursorLight(el: HTMLElement, opts: { enabled: boolean }): void` — no-op when `enabled` is false.

- [ ] **Step 1: Write the failing test — `landing/cursor-light.test.ts`**
```ts
import { describe, it, expect, vi } from 'vitest';
import { lerp, relativePosition, setupCursorLight } from './cursor-light';

describe('cursor-light math', () => {
  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it('relativePosition returns clamped 0..1 fractions', () => {
    const r = { left: 100, top: 100, width: 200, height: 200 };
    expect(relativePosition(r, 200, 200)).toEqual({ x: 0.5, y: 0.5 });
    expect(relativePosition(r, 0, 0)).toEqual({ x: 0, y: 0 });      // clamped
    expect(relativePosition(r, 999, 999)).toEqual({ x: 1, y: 1 });  // clamped
  });
});

describe('setupCursorLight', () => {
  it('does nothing when disabled', () => {
    const el = document.createElement('div');
    const add = vi.spyOn(el, 'addEventListener');
    setupCursorLight(el, { enabled: false });
    expect(add).not.toHaveBeenCalled();
  });
  it('listens for pointermove when enabled', () => {
    const el = document.createElement('div');
    const add = vi.spyOn(el, 'addEventListener');
    setupCursorLight(el, { enabled: true });
    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- landing/cursor-light.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write `landing/cursor-light.ts`**
```ts
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function relativePosition(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

export function setupCursorLight(el: HTMLElement, opts: { enabled: boolean }): void {
  if (!opts.enabled) return;
  el.addEventListener('pointermove', (e) => {
    const p = relativePosition(el.getBoundingClientRect(), e.clientX, e.clientY);
    el.style.setProperty('--x', `${(p.x * 100).toFixed(2)}%`);
    el.style.setProperty('--y', `${(p.y * 100).toFixed(2)}%`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.removeProperty('--x');
    el.style.removeProperty('--y');
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- landing/cursor-light.test.ts` → PASS.

- [ ] **Step 5: The `::before` highlight in `landing/styles/recreations.css`**
```css
.mock-hero { position: relative; overflow: hidden; }
.mock-hero::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(220px circle at var(--x, 50%) var(--y, 50%),
    color-mix(in srgb, var(--accent) 6%, transparent), transparent 70%);
  opacity: 0; transition: opacity var(--dur-standard) var(--ease);
}
@media (hover: hover) and (pointer: fine) {
  .mock-hero:hover::before { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) { .mock-hero::before { display: none; } }
```
Alpha stays at 6% (≤0.06) — felt, not seen.

- [ ] **Step 6: Wire it in `landing/main.ts`, gated**
```ts
import { setupCursorLight } from './cursor-light';

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const heroMock = document.getElementById('mock-overview');
if (heroMock) setupCursorLight(heroMock, { enabled: finePointer && !reducedMotion });
```

- [ ] **Step 7: Verify suite + build + browser**

Run: `npx tsc -b --noEmit && npm test && npm run build`. In `npm run preview`, moving the pointer over the hero card shifts a faint light; disabled on reduced-motion and on touch/coarse pointers.

- [ ] **Step 8: Commit**
```bash
git add landing/cursor-light.ts landing/cursor-light.test.ts landing/styles/recreations.css landing/main.ts
git commit -m "feat(landing): cursor-aware hero light, desktop-only, reduced-motion gated (TDD)"
```

---

### Task 8: Top-bar hairline on scroll + exams decay-curve redraw

Two small, quiet section upgrades (research §h.1, §h.6, §j.14–15). The top bar's bottom border firms when the page scrolls; the exams band gains a small decay-curve that redraws to a shallower slope on entry.

**Files:**
- Modify: `landing/index.html` (a scroll sentinel; the exams SVG curve)
- Modify: `landing/styles/sections.css` (top-bar border states)
- Modify: `landing/styles/recreations.css` (curve draw)
- Modify: `landing/main.ts` (sentinel observer)

- [ ] **Step 1: Top-bar sentinel + border states**

In `index.html`, add an empty sentinel as the first child of `<body>` (before `.topbar`): `<div id="top-sentinel" aria-hidden="true"></div>`. In `sections.css`, give `.topbar` a hairline that firms via a body class:
```css
.topbar { border-bottom: 1px solid transparent; transition: border-color var(--dur-standard) var(--ease); }
.is-scrolled .topbar { border-bottom-color: var(--border-strong); }
```
In `main.ts`:
```ts
const sentinel = document.getElementById('top-sentinel');
if (sentinel && 'IntersectionObserver' in window) {
  new IntersectionObserver(
    ([e]) => document.documentElement.classList.toggle('is-scrolled', !e.isIntersecting),
  ).observe(sentinel);
}
```

- [ ] **Step 2: Exams decay-curve markup in `landing/index.html`**

Inside the exams `<section class="band exams …>`, after the `.band-lead`, add a small SVG that draws a shallower curve. Mark the band `data-animate` and reuse the ring-draw mechanism via a dedicated class:
```html
<div class="decay-curve" data-animate aria-hidden="true">
  <svg viewBox="0 0 320 120" class="decay-svg">
    <path class="decay-path" pathLength="100"
      d="M8,20 C 90,40 150,95 312,108" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
  </svg>
</div>
```

- [ ] **Step 3: Curve draw CSS + generalise the group runner**

In `recreations.css`:
```css
.decay-curve { margin-top: var(--space-9); max-width: 360px; }
.decay-svg { width: 100%; height: auto; }
.decay-path { stroke-dasharray: 100; stroke-dashoffset: 100; }
.decay-curve.is-drawn .decay-path {
  stroke-dashoffset: 0; transition: stroke-dashoffset var(--dur-draw) var(--ease);
}
.js .decay-curve:not(.is-drawn) .decay-path { stroke-dashoffset: 0; } /* no-JS fallback: drawn */
@media (prefers-reduced-motion: reduce) { .decay-curve.is-drawn .decay-path { transition-duration: 0.01ms; } }
```
`animateGroup` already handles count-ups/rings/bars but not `.decay-curve`; extend it. In `animate.ts` add, inside `animateGroup`:
```ts
  group.querySelectorAll('.decay-curve').forEach((c) => c.classList.add('is-drawn'));
  if (group.matches('.decay-curve')) group.classList.add('is-drawn');
```
Add a test to `animate.test.ts`: a `.decay-curve` group gets `is-drawn` under reduced motion → `npm test -- landing/animate.test.ts` PASS.

- [ ] **Step 4: Verify suite + build + browser**

Run: `npx tsc -b --noEmit && npm test && npm run build`, then `npm run preview`: scrolling past the hero firms the top-bar hairline; the exams curve draws once on entry. Reduced motion: both at final state, no motion.

- [ ] **Step 5: Commit**
```bash
git add landing/index.html landing/styles/sections.css landing/styles/recreations.css landing/main.ts landing/animate.ts landing/animate.test.ts
git commit -m "feat(landing): top-bar hairline firms on scroll; exams decay-curve redraw"
```

---

### Task 9: Cairn logomark + favicon (author addition)

**Not in the research's list** — but the single biggest missing "this is a real, finished product" signal. The page currently renders the wordmark as plain text "Cairn" and the head has TODOs for a favicon/OG that don't exist, so browser tabs show a blank/default icon. A cairn *is* a stack of balanced stones, so the name hands us a literal, restrained mark. Static, monochrome (`currentColor`), no animation — pure identity craft.

**Files:**
- Create: `public/favicon.svg`
- Modify: `landing/index.html` (both `.brand` lockups — top bar + closer; the favicon `<link>` already points at `/favicon.svg`)
- Modify: `landing/styles/sections.css` (`.brand` lockup layout + `.brand-mark`)

- [ ] **Step 1: Create the stone mark — `public/favicon.svg`**

Three stones (wider gaps survive small sizes, per the head comment), theme-aware via an embedded `prefers-color-scheme`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    :root { color-scheme: light dark; }
    .stone { fill: #1d1d1f; }
    @media (prefers-color-scheme: dark) { .stone { fill: #f5f5f7; } }
  </style>
  <ellipse class="stone" cx="16" cy="25" rx="11" ry="3.4"/>
  <ellipse class="stone" cx="16" cy="16.5" rx="8.5" ry="3.1"/>
  <ellipse class="stone" cx="16" cy="8.5" rx="6" ry="2.8"/>
</svg>
```

- [ ] **Step 2: Put the mark into both `.brand` lockups in `landing/index.html`**

Replace each `<a class="brand" href="/landing/">Cairn</a>` (top bar and closer) with a four-stone inline mark + wordmark; `currentColor` makes it inherit `--ink` and flip with the theme for free:
```html
<a class="brand" href="/landing/" aria-label="Cairn — home">
  <svg class="brand-mark" viewBox="0 0 24 28" width="18" height="21" aria-hidden="true">
    <ellipse cx="12" cy="24" rx="9" ry="2.6"/>
    <ellipse cx="12" cy="18" rx="7.5" ry="2.4"/>
    <ellipse cx="12" cy="12.5" rx="6" ry="2.2"/>
    <ellipse cx="12" cy="7.5" rx="4.2" ry="2"/>
  </svg>
  <span class="brand-word">Cairn</span>
</a>
```

- [ ] **Step 3: Lockup styles in `landing/styles/sections.css`**

Replace the existing `.brand { … }` rule with:
```css
.brand {
  display: inline-flex; align-items: center; gap: var(--space-3);
  font-size: var(--fs-brand); font-weight: 700; letter-spacing: -0.02em;
  color: var(--ink); text-decoration: none;
}
.brand-mark { fill: currentColor; flex-shrink: 0; }
```

- [ ] **Step 4: Verify build + favicon serves + both themes**

Run: `npm run build`, confirm `dist/favicon.svg` exists. `npm run preview`: the tab icon shows the stones (light and dark), and both wordmark lockups show the mark aligned to the text baseline. Toggle the theme — mark flips with the ink via `currentColor`.
Expected: build PASS; icon present; mark aligned in both bands and themes.

- [ ] **Step 5: Commit**
```bash
git add public/favicon.svg landing/index.html landing/styles/sections.css
git commit -m "feat(landing): cairn stone logomark + theme-aware SVG favicon"
```

---

### Task 10: Editorial typography + spatial rhythm pass (author addition)

**Not in the research's numbered list** (though it calls broadly for "advanced editorial type"). After the recreations move, type is the next-biggest "less basic" lever: a fluid scale, balanced/pretty wrapping, tighter optical leading on the hero, and honest measure. Pure craft, zero motion, zero new markup beyond wrapping already done in Task 6.

**Files:**
- Modify: `landing/styles/base.css` (fluid type scale + wrapping)
- Modify: `landing/styles/sections.css` (measure + inter-band rhythm)

- [ ] **Step 1: Fluid type + wrapping in `landing/styles/base.css`**

Refine the hero/title/lead type. `text-wrap: balance` keeps headings from leaving orphans; `pretty` fixes body last-line runts. Values stay within the token ramp's intent (hero tops out near `--fs-hero` 76px):
```css
.hero-headline {
  font-size: clamp(2.6rem, 6vw + 0.4rem, 4.75rem);
  line-height: 1.04;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.band-title { font-size: clamp(1.65rem, 2.6vw + 0.5rem, 2rem); text-wrap: balance; }
.hero-sub, .band-lead { text-wrap: pretty; }
.eyebrow { letter-spacing: 0.08em; }
```
(Task 6 wrapped the headline in `.line`/`.line-in` spans; `text-wrap: balance` on the `<h1>` still applies to each masked line's inline content.)

- [ ] **Step 2: Measure + rhythm in `landing/styles/sections.css`**

Tighten reading measure and even out the vertical rhythm between bands:
```css
.hero-sub { max-width: 44ch; }
.band-lead { max-width: 62ch; }
.band-title { max-width: 24ch; }
/* Even inter-band rhythm: the problem/exams one-liners get a touch more air. */
.band.problem, .band.exams { padding-block: var(--space-14); }
```

- [ ] **Step 3: Verify build + both themes + no overflow**

Run: `npm run build && npm run preview`. Check the hero headline balances across two lines without an orphan, body paragraphs have no single-word last lines, and no band introduces horizontal scroll at 1180 / 768 / 720px.
Expected: build PASS; balanced headline; no h-scroll.

- [ ] **Step 4: Commit**
```bash
git add landing/styles/base.css landing/styles/sections.css
git commit -m "feat(landing): editorial type scale, balanced wrapping, tuned measure"
```

---

### Task 11: Final verification pass (Definition of Done)

Verify the whole elevated page against the research's constraints. Fix anything that fails, then commit.

**Files:** whichever a failing check implicates.

- [ ] **Step 1: Perf / compositor**

`npm run preview`, open `/landing/`, DevTools → Rendering → Paint Flashing on; scroll top-to-bottom. Expect **no** green paint rectangles during scroll (only composite). Performance panel during the ring/matrix animations: no "Layout"/"Paint" rows, only "Composite Layers". Target ≥ 50 FPS.
Run: `grep -rn "backdrop-filter" landing/ || echo "none — good"` → "none — good".

- [ ] **Step 2: Reduced motion (per-effect degradation)**

With `prefers-reduced-motion: reduce`: reveals visible; **count-ups show final values immediately** (82, 74%); ring + decay curve at final offset; bars at `--w`; cursor-light disabled; theme toggle colour-only. Nothing hidden, nothing blank.

- [ ] **Step 3: Themes**

Full light/dark parity across every band, all three recreations, the noise overlay, and the failure card (`--danger`/`--danger-soft`). Theme persists across reload; no FOUC (pre-paint script).

- [ ] **Step 4: Numerals**

Every measured number is inside `.mono-num` and renders as tabular figures (82; 41/53/58%; 74%; +4%; 4/22; matrix 41/53/67/58%). Confirm the count-ups don't reflow (fixed-width tabular).
Run: `grep -rin "work logged\|fitness\|lifting\|running\|jobs\|supercharge\|unlock\|revolutionize" landing/ || echo clean` → "clean".

- [ ] **Step 5: Shadows / depth**

Exactly one `--shadow-hero` on the page (the Overview mock).
Run: `grep -rn "var(--shadow-hero)" landing/styles/ | wc -l` → 1.

- [ ] **Step 6: Accessibility**

`:focus-visible` ring on every interactive element (nav, both CTAs, theme toggle, copy button); full keyboard traversal; the three recreations keep their `role="img"` + labels; decorative bars/curve are `aria-hidden`; the disabled desktop CTAs are genuine `<button disabled>` and unfocusable. Run an axe/Lighthouse a11y pass if available.

- [ ] **Step 7: No-JS sanity**

With JS disabled: all nine bands and their copy are visible and readable; the ring shows its final arc (CSS fallback), numbers show their static values, the headline is fully visible.

- [ ] **Step 8: Full green + commit any fixes**

Run: `npx tsc -b --noEmit && npm test && npm run build` → PASS (all suites).
```bash
git add -A landing/ src/styles/
git commit -m "test(landing): final verification — perf, reduced-motion, themes, a11y, numerals"
```

---

## Self-Review

**Spec coverage (research §j 15 items):**
- §j.1 ring draw + count-up → Task 3. ✓
- §j.2 validation failure state → Task 5. ✓
- §j.3 retention matrix animation → Task 4. ✓
- §j.4 tabular-mono + tnum:0 fix → Task 1 (Step 2). ✓
- §j.5 line-masked hero reveal → Task 6. ✓
- §j.6 vanilla + native CSS/WAAPI → whole plan; no new deps (Global Constraints). ✓
- §j.7 ban backdrop-filter + noise overlay → Task 1 (Step 4), verified Task 11. ✓
- §j.8 reveal system on tokens + compositor check → existing `reveal.ts` reused; verified Task 11 (Step 1). ✓
- §j.9 press + hover-lift → Task 1 (Step 3). ✓
- §j.10 native scroll-behavior (no Lenis) → already in `base.css`; no task needed. ✓
- §j.11 no GSAP → Global Constraints. ✓
- §j.12 cursor-aware hero light → Task 7. ✓
- §j.13 per-effect reduced-motion → every task's CSS + Task 11 (Step 2). ✓
- §j.14 exams decay-curve redraw → Task 8. ✓
- §j.15 top-bar hairline + disabled desktop CTA → Task 8 (hairline); the disabled CTA already shipped in the WIP. ✓

**Author additions (beyond the research's list):**
- Task 9 — Cairn stone logomark + theme-aware SVG favicon (resolves the head's favicon TODO; biggest missing identity signal). Restrained, static, `currentColor`.
- Task 10 — editorial type scale, balanced/pretty wrapping, tuned measure (the next-biggest "less basic" lever after the recreations move). Pure craft, no motion.

**Placeholder scan:** No TBD/TODO. `animateGroup`/`setupDataAnimations`/`countUpValue`/`ringOffset`/`lerp`/`relativePosition`/`setupCursorLight` are fully specified with code and tests. Values (0.04 noise alpha, 6% cursor alpha, 0.8s expo-out headline, 0.9s count, 1.1s draw) are pinned from the research.

**Type consistency:** `AnimateDeps` is defined in Task 2 and consumed in Tasks 3/4/8 unchanged. `animateGroup` is extended additively in Tasks 4 (bars-on-root) and 8 (`.decay-curve`), each with an added unit test. `setupDataAnimations(document.querySelectorAll('[data-animate]'), { reducedMotion })` is wired once (Task 3) and every later group is picked up by adding `data-animate` in markup — no re-wiring. `setupCursorLight(el, { enabled })`, `currentTheme()`, `setupThemeToggle(el, { onChange })`, `setupReveals(els, opts)` match the existing/defined signatures.
