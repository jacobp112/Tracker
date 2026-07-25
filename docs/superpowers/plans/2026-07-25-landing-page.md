# Cairn Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public marketing landing page for the app (working name **Cairn**) as a separate Vite entry that reuses the app's design tokens.

**Architecture:** A second Vite multi-page entry under `landing/`, built as plain HTML + CSS + minimal vanilla TypeScript (no React). It imports the app's real token CSS (`src/styles/tokens.css`, `src/styles/palette.css`) so the look never drifts, self-hosts its fonts, and reuses the framework-agnostic `src/theme/theme.ts` for theming. Product visuals are token-built, theme-aware HTML/CSS recreations — not captured screenshots.

**Tech Stack:** Vite 5 (multi-page), TypeScript (strict), Vitest + jsdom (logic tests), `@fontsource-variable/inter` + `@fontsource-variable/jetbrains-mono` (self-hosted fonts), `lucide` (a few icons). No React on this page. Motion / Base UI are deferred and out of scope for this plan.

**Design spec:** `docs/superpowers/specs/2026-07-25-landing-page-design.md` (authoritative for copy, layout values, and constraints; sections cited below as "spec §N").

## Global Constraints

Every task's requirements implicitly include these (verbatim from spec §3):

- Import the app's tokens; never restate colour/type/spacing/radius/shadow values. Import `src/styles/tokens.css` and `src/styles/palette.css`.
- Ship light **and** dark, driven by `data-theme` set before first paint (no FOUC).
- **No `backdrop-filter`** on the top bar or any scroll region.
- Exactly **one** `--shadow-hero` on the page (the hero product recreation); everything else `--shadow-card` / `--shadow-card-hover`.
- Every measured number (%, health 0–100, counts, deltas) uses `.mono-num`.
- `prefers-reduced-motion` is a hard gate: durations → 0.01ms, reveals forced visible, animated bars/rings snapped to final state. Never hide content.
- **Progressive enhancement:** with JS disabled, all content is visible and readable. Reveal animations opt *in* only when JS is present (a `.js` class on `<html>`).
- **Study + Exams only** — no "Work logged", Fitness, running, lifting, or Jobs anywhere.
- Voice: no "supercharge/unlock/revolutionize", no emoji feature icons, no gradient-blob hero, no lorem numbers, no fake bento.
- Package manager is **npm** (there is a `package-lock.json`). Run `npx tsc -b` for typecheck and `npm test` for the Vitest suite.

**Note (follow-up, not this plan):** the app's own `index.html` loads Google Fonts from a CDN, contradicting the "no network requests" claim. The landing page self-hosts fonts; fixing the app to match is a separate task.

---

### Task 1: Multi-page build scaffold

Stand up the second Vite entry so an (empty) landing page builds and typechecks alongside the app. Fold all config + dependency install here.

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `vite.config.ts:6-19` (add `build.rollupOptions.input`; extend `test.include`)
- Modify: `tsconfig.json:31` (add `"landing"` to `include`)
- Create: `landing/index.html`
- Create: `landing/main.ts`

**Interfaces:**
- Produces: a buildable `landing/index.html` entry; `landing/main.ts` as the page's module entry (wired to more logic in later tasks).

- [ ] **Step 1: Install dependencies**

```bash
npm install @fontsource-variable/inter @fontsource-variable/jetbrains-mono lucide
```

- [ ] **Step 2: Add the second entry and landing test glob to `vite.config.ts`**

Replace the `defineConfig({...})` body so it has a `build.rollupOptions.input` map and the `test.include` covers `landing/`:

```ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        landing: fileURLToPath(new URL('./landing/index.html', import.meta.url)),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
      'landing/**/*.{test,spec}.ts',
    ],
  },
});
```

- [ ] **Step 3: Add `landing` to `tsconfig.json` `include`**

Change line 31 to: `"include": ["src", "tests", "landing", "vite.config.ts", "vitest.config.ts"],`

- [ ] **Step 4: Create a minimal `landing/index.html`**

Includes the pre-paint theme script (same key as the app: `studyos-theme`) and loads `main.ts`. Body content is a placeholder for now.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cairn — a memory for self-study</title>
    <meta name="description" content="Cairn gives your AI-tutored studying a retention curve and a review schedule — local-first, no accounts, your data in a file you own." />
    <script>
      /* No-FOUC theme resolution: applied before first paint. */
      (function () {
        try {
          var saved = localStorage.getItem('studyos-theme');
          var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', saved || sys);
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })();
    </script>
  </head>
  <body>
    <main id="page"><!-- sections added in later tasks --></main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `landing/main.ts`**

```ts
// Signals JS is present so CSS can opt into the hidden→reveal treatment
// (progressive enhancement: no-JS keeps all content visible).
document.documentElement.classList.add('js');
```

- [ ] **Step 6: Verify build and typecheck**

Run: `npx tsc -b --noEmit && npm run build`
Expected: PASS; `dist/landing/index.html` exists after build.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json landing/index.html landing/main.ts
git commit -m "feat(landing): multi-page Vite scaffold for the marketing page"
```

---

### Task 2: Reveal-on-scroll module (TDD)

The scroll-reveal logic, designed for progressive enhancement and reduced motion. Pure, injectable, unit-tested. jsdom has no `IntersectionObserver`, so the observer is injected.

**Files:**
- Create: `landing/reveal.ts`
- Test: `landing/reveal.test.ts`

**Interfaces:**
- Produces:
  - `revealElement(el: Element): void` — adds class `is-visible`.
  - `makeRevealHandler(): IntersectionObserverCallback` — reveals + unobserves intersecting targets.
  - `setupReveals(els: Iterable<Element>, opts: { reducedMotion: boolean; createObserver?: (cb: IntersectionObserverCallback) => { observe(el: Element): void } }): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { revealElement, makeRevealHandler, setupReveals } from './reveal';

function el(): HTMLElement {
  return document.createElement('div');
}

describe('reveal', () => {
  it('revealElement adds is-visible', () => {
    const e = el();
    revealElement(e);
    expect(e.classList.contains('is-visible')).toBe(true);
  });

  it('reduced motion reveals everything immediately, no observer', () => {
    const a = el(), b = el();
    const createObserver = vi.fn();
    setupReveals([a, b], { reducedMotion: true, createObserver });
    expect(a.classList.contains('is-visible')).toBe(true);
    expect(b.classList.contains('is-visible')).toBe(true);
    expect(createObserver).not.toHaveBeenCalled();
  });

  it('observes each element when motion is allowed', () => {
    const a = el(), b = el();
    const observe = vi.fn();
    const createObserver = vi.fn(() => ({ observe }));
    setupReveals([a, b], { reducedMotion: false, createObserver });
    expect(createObserver).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('handler reveals and unobserves an intersecting target', () => {
    const e = el();
    const observer = { unobserve: vi.fn() } as unknown as IntersectionObserver;
    makeRevealHandler()(
      [{ isIntersecting: true, target: e } as IntersectionObserverEntry],
      observer,
    );
    expect(e.classList.contains('is-visible')).toBe(true);
    expect(observer.unobserve).toHaveBeenCalledWith(e);
  });

  it('handler ignores non-intersecting targets', () => {
    const e = el();
    const observer = { unobserve: vi.fn() } as unknown as IntersectionObserver;
    makeRevealHandler()(
      [{ isIntersecting: false, target: e } as IntersectionObserverEntry],
      observer,
    );
    expect(e.classList.contains('is-visible')).toBe(false);
    expect(observer.unobserve).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- landing/reveal.test.ts`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Write minimal implementation**

```ts
export function revealElement(el: Element): void {
  el.classList.add('is-visible');
}

export function makeRevealHandler(): IntersectionObserverCallback {
  return (entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        revealElement(entry.target);
        observer.unobserve(entry.target);
      }
    }
  };
}

export function setupReveals(
  els: Iterable<Element>,
  opts: {
    reducedMotion: boolean;
    createObserver?: (cb: IntersectionObserverCallback) => { observe(el: Element): void };
  },
): void {
  const list = [...els];
  if (opts.reducedMotion || typeof IntersectionObserver === 'undefined') {
    list.forEach(revealElement);
    return;
  }
  const create =
    opts.createObserver ??
    ((cb: IntersectionObserverCallback) =>
      new IntersectionObserver(cb, { rootMargin: '0px 0px -10% 0px' }));
  const observer = create(makeRevealHandler());
  list.forEach((el) => observer.observe(el));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- landing/reveal.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add landing/reveal.ts landing/reveal.test.ts
git commit -m "feat(landing): reveal-on-scroll module with reduced-motion + PE gating"
```

---

### Task 3: Clipboard copy module (TDD)

Copy-to-clipboard for the prompt block, with a legacy fallback when the async Clipboard API is unavailable.

**Files:**
- Create: `landing/clipboard.ts`
- Test: `landing/clipboard.test.ts`

**Interfaces:**
- Produces: `copyText(text: string, nav?: Pick<Navigator, 'clipboard'>): Promise<boolean>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './clipboard';

afterEach(() => vi.restoreAllMocks());

describe('copyText', () => {
  it('uses the async clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const ok = await copyText('hello', { clipboard: { writeText } as unknown as Clipboard });
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(ok).toBe(true);
  });

  it('falls back to execCommand when clipboard is missing', async () => {
    const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const ok = await copyText('hi', {} as Pick<Navigator, 'clipboard'>);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
  });

  it('falls back when the async clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const ok = await copyText('x', { clipboard: { writeText } as unknown as Clipboard });
    expect(exec).toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it('returns false when both paths fail', async () => {
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    const ok = await copyText('x', {} as Pick<Navigator, 'clipboard'>);
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- landing/clipboard.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
export async function copyText(
  text: string,
  nav: Pick<Navigator, 'clipboard'> = navigator,
): Promise<boolean> {
  try {
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- landing/clipboard.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add landing/clipboard.ts landing/clipboard.test.ts
git commit -m "feat(landing): clipboard copy with legacy fallback"
```

---

### Task 4: Theme toggle module (TDD)

Reuses the app's `src/theme/theme.ts` so theming stays single-sourced. Provides a pure `nextTheme` and a DOM wiring helper.

**Files:**
- Create: `landing/theme-toggle.ts`
- Test: `landing/theme-toggle.test.ts`

**Interfaces:**
- Consumes: `applyTheme`, `getInitialTheme`, `type Theme` from `@/theme/theme`.
- Produces:
  - `nextTheme(current: Theme): Theme`
  - `setupThemeToggle(button: HTMLElement): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { nextTheme, setupThemeToggle } from './theme-toggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme-toggle', () => {
  it('nextTheme flips the value', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('clicking the button flips data-theme and persists it', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.createElement('button');
    setupThemeToggle(btn);
    btn.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('studyos-theme')).toBe('dark');
    btn.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- landing/theme-toggle.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
import { applyTheme, getInitialTheme, type Theme } from '@/theme/theme';

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function setupThemeToggle(button: HTMLElement): void {
  button.addEventListener('click', () => {
    applyTheme(nextTheme(getInitialTheme()));
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- landing/theme-toggle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add landing/theme-toggle.ts landing/theme-toggle.test.ts
git commit -m "feat(landing): theme toggle reusing the app's theme module"
```

---

### Task 5: Self-hosted fonts

Serve Inter + JetBrains Mono from the app's own origin (no CDN), with preload and fallback metrics to prevent layout shift. Preserves the app's OpenType feature settings.

**Files:**
- Create: `landing/fonts.css`
- Modify: `landing/index.html` (import `fonts.css`; preload the two above-the-fold faces)

**Interfaces:**
- Produces: `--font-sans` / `--font-mono` faces available to `landing.css` (token names already defined in `tokens.css`; this task supplies the actual font files).

- [ ] **Step 1: Create `landing/fonts.css`**

Imports the Fontsource variable CSS (ships woff2 inside the npm package; Vite fingerprints and serves it from our origin) and sets fallback metrics on the system stack to kill layout shift.

```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/jetbrains-mono';

/* Fallback metrics so the -apple-system stack occupies the same space as Inter
   while the variable font loads (kills layout shift; font-display: swap default). */
@font-face {
  font-family: 'Inter Fallback';
  src: local('-apple-system'), local('BlinkMacSystemFont'), local('Segoe UI'), local('Arial');
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}
```

- [ ] **Step 2: Preload the two above-the-fold faces in `landing/index.html`**

In `<head>`, before other styles, resolve the hashed filenames with Vite's `?url` import via a small inline module is not possible in static HTML; instead add explicit `<link rel="preload">` using the Fontsource file paths, which Vite rewrites. Add:

```html
<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous"
  href="/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2" />
<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous"
  href="/node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2" />
```

Note: in the built output Vite fingerprints these into `/assets/*.woff2`. Verify the built HTML references hashed asset paths, not `node_modules`, after Step 4. If the raw path does not rewrite, replace the two `<link>`s with a tiny module preload in `main.ts` using `import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'` and inject the `<link>` — but only for these two faces (do not preload all weights).

- [ ] **Step 3: Import `fonts.css` from `main.ts`**

Add to the top of `landing/main.ts`:

```ts
import './fonts.css';
```

- [ ] **Step 4: Verify no external font requests**

Run: `npm run build`, then search the built landing HTML/CSS for CDN references:
Run: `grep -r "fonts.googleapis\|fonts.gstatic" dist/ || echo "no CDN font refs — good"`
Expected: "no CDN font refs — good". Confirm the built HTML preloads hashed `/assets/*.woff2` files.

- [ ] **Step 5: Commit**

```bash
git add landing/fonts.css landing/index.html landing/main.ts
git commit -m "feat(landing): self-hosted Inter + JetBrains Mono, no CDN"
```

---

### Task 6: Base styles — tokens, canvas, type, buttons, reveal PE

The page's foundational CSS: import the app's tokens, reproduce the canvas wash, the type ramp, the two button styles, `:focus-visible`, and the progressive-enhancement reveal base. Verbatim values live in the app's tokens — this file only references them.

**Files:**
- Create: `landing/styles/base.css`
- Modify: `landing/main.ts` (import `./styles/base.css`)

**Interfaces:**
- Produces: classes `.reveal`, `.btn-primary`, `.btn-secondary`, `.mono-num`, `.eyebrow`, and the page canvas — consumed by Tasks 7–9.

- [ ] **Step 1: Create `landing/styles/base.css`**

Import tokens/palette first, then page base. Use only token variables (spec §5). Reveal base implements PE: visible by default; hidden only under `.js`.

```css
@import '../../src/styles/tokens.css';
@import '../../src/styles/palette.css';

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }

body {
  color: var(--ink);
  background:
    radial-gradient(1000px 520px at 12% -8%, var(--wash-1), transparent 60%),
    radial-gradient(820px 520px at 102% 4%, var(--wash-2), transparent 55%),
    var(--bg-page);
  background-attachment: fixed;
  min-height: 100vh;
  font-family: 'Inter Variable', 'Inter Fallback', -apple-system, BlinkMacSystemFont, sans-serif;
  letter-spacing: -0.006em;
  font-feature-settings: 'cv05', 'cv08', 'ss01', 'tnum' 0;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 { font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin: 0; }

.eyebrow {
  font-size: var(--fs-eyebrow); text-transform: uppercase; font-weight: 700;
  letter-spacing: 0.07em; color: var(--ink-muted);
}

.mono-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: 0; }

/* Buttons — mirror the app's .btn-primary / .btn-secondary (spec §5). */
.btn-primary, .btn-secondary {
  display: inline-flex; align-items: center; gap: var(--space-3);
  padding: var(--space-5) var(--space-8); border-radius: var(--radius-pill);
  font-size: var(--fs-body); font-weight: 600; cursor: pointer;
  border: 1px solid transparent; text-decoration: none;
  transition: box-shadow var(--dur-standard) var(--ease), background-color var(--dur-standard) var(--ease);
}
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--surface); border-color: var(--border-strong); color: var(--ink); }
:where(a, button):focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 4px var(--accent-soft);
}

/* Progressive-enhancement reveal: visible by default; only hidden when JS is present. */
.reveal { opacity: 1; transform: none; }
.js .reveal { opacity: 0; transform: translateY(14px); }
.js .reveal.is-visible {
  opacity: 1; transform: none;
  transition: opacity var(--dur-reveal) var(--ease), transform var(--dur-reveal) var(--ease);
  transition-delay: calc(var(--i, 0) * var(--reveal-step));
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  .reveal, .js .reveal { opacity: 1 !important; transform: none !important; }
}
```

If any referenced token (e.g. `--reveal-step`, `--accent-soft`, `--border-strong`, `--wash-1/2`) is absent from `tokens.css`/`palette.css`, stop and confirm the exact token name in those files before substituting — do not invent values.

- [ ] **Step 2: Import base styles from `main.ts`**

Add after the `fonts.css` import:

```ts
import './styles/base.css';
```

- [ ] **Step 3: Verify it builds and typechecks**

Run: `npx tsc -b --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add landing/styles/base.css landing/main.ts
git commit -m "feat(landing): base styles — canvas, type ramp, buttons, PE reveal"
```

---

### Task 7: Page sections — markup + layout CSS

Author the nine content bands (spec §8) with final copy (spec §9) and the responsive layout. This is the bulk of the page. Recreations are stubbed with empty `<div>` placeholders here and filled in Task 8.

**Files:**
- Modify: `landing/index.html` (replace `<main id="page">` contents with the nine `<section>` bands)
- Create: `landing/styles/sections.css`
- Modify: `landing/main.ts` (import `./styles/sections.css`)

**Interfaces:**
- Consumes: classes from Task 6.
- Produces: DOM hooks for Task 9 — `#theme-toggle` (button), `.reveal` elements on each band, `#copy-prompt` (button) and `#prompt-text` (element) inside the step-1 card of the loop; recreation containers `#mock-overview`, `#mock-matrix`, `#mock-validation`.

- [ ] **Step 1: Write the section markup in `landing/index.html`**

Use the exact copy from spec §9 and the structure from spec §8. Skeleton (fill every band; copy strings are verbatim from spec §9):

```html
<main id="page">
  <header class="topbar reveal">
    <a class="brand" href="/landing/">Cairn</a>
    <nav class="topnav">
      <a href="#how">How it works</a>
      <a href="#privacy">Privacy</a>
      <button id="theme-toggle" aria-label="Toggle theme" type="button"></button>
      <a class="btn-primary" href="/">Open the app</a>
    </nav>
  </header>

  <section class="hero">
    <div class="hero-copy reveal" style="--i:0">
      <p class="eyebrow">A memory for self-study</p>
      <h1 class="hero-headline">Your AI can teach you anything. It just can't remember you learned it.</h1>
      <p class="hero-sub">Cairn tracks your courses, sections, and topics on a real retention curve — so you always know what's fading and what's due. It runs on your machine, stores everything in one file you own, and never calls an AI itself. You bring the AI; Cairn keeps the memory.</p>
      <div class="cta-row">
        <a class="btn-primary" href="/">Open the app</a>
        <a class="btn-secondary is-disabled" aria-disabled="true" href="#">Download for desktop</a>
      </div>
      <p class="cta-micro">No account — nothing to log into. Runs in your browser. Desktop build coming.</p>
    </div>
    <div class="hero-visual reveal" style="--i:1" id="mock-overview"><!-- Task 8 --></div>
  </section>

  <section class="band problem reveal">
    <h2 class="band-title">Studying with AI has no memory.</h2>
    <p class="band-lead">You study a topic with your AI. A week later, nothing remembers you did.</p>
  </section>

  <section class="band" id="how">
    <p class="eyebrow reveal">How it works</p>
    <h2 class="band-title reveal">You bring the AI. Cairn brings the memory.</h2>
    <div class="steps">
      <article class="card step reveal" style="--i:0">
        <span class="step-num mono-num">01</span>
        <h3>Copy the prompt</h3>
        <div class="prompt-block"><code id="prompt-text">…</code><button id="copy-prompt" type="button">Copy</button></div>
        <p>Cairn hands you a ready-made prompt. Paste it into whatever AI you already use, along with your syllabus, session notes, or exam paper.</p>
      </article>
      <article class="card step reveal" style="--i:1">
        <span class="step-num mono-num">02</span>
        <h3>Paste the result back</h3>
        <p>Paste the AI's JSON into Cairn. It's checked against a strict schema — no extra fields, no invented dates. If something's wrong, you get a plain-English message naming the field and the fix.</p>
      </article>
      <article class="card step reveal" style="--i:2">
        <span class="step-num mono-num">03</span>
        <h3>Preview, then commit</h3>
        <div id="mock-validation"><!-- Task 8 --></div>
        <p>See exactly what will change. Nothing is saved until you say so — then it's written in one atomic step. Cairn verifies; it never generates.</p>
      </article>
    </div>
  </section>

  <section class="band memory reveal">
    <p class="eyebrow">The memory model</p>
    <h2 class="band-title">It tracks how well you know things — and how that fades.</h2>
    <div id="mock-matrix"><!-- Task 8 --></div>
  </section>

  <section class="band exams reveal">
    <h2 class="band-title">Exams don't count more because we say so. They count more because they're evidence.</h2>
    <p class="band-lead">Test events tune each topic's decay rate, so exams outweigh study sessions by evidence — not arbitrary weights.</p>
  </section>

  <section class="band privacy reveal" id="privacy">
    <h2 class="band-title">No accounts. No backend. No network. Just your file.</h2>
    <p class="band-lead">Cairn makes no network requests. There are no accounts, no telemetry, no backend to breach. Everything you track is a single JSON document in your browser's storage. Settings → Export gives you the whole thing; import validates it just as strictly as a fresh paste. The only outside party that ever sees your material is the AI you choose to paste into — and that's your call, not ours.</p>
  </section>

  <section class="band choose reveal">
    <h2 class="band-title">Two ways in. Same app. Your data stays where you put it.</h2>
    <div class="choose-cards">
      <article class="card">
        <h3>Open the app</h3>
        <p>Runs in your browser. No account — there's nothing to log into, by design. Your data lives in this browser.</p>
        <a class="btn-primary" href="/">Open the app</a>
      </article>
      <article class="card">
        <h3>Download for desktop</h3>
        <p>A native build for macOS/Windows. Your data lives in a file on your disk. Works fully offline.</p>
        <a class="btn-secondary is-disabled" aria-disabled="true" href="#">Coming soon</a>
      </article>
    </div>
    <p class="cta-micro">The two don't sync — there's no server between them. Export a JSON bundle from one and import it into the other whenever you like.</p>
  </section>

  <footer class="closer reveal">
    <a class="brand" href="/landing/">Cairn</a>
    <div class="cta-row">
      <a class="btn-primary" href="/">Open the app</a>
      <a class="btn-secondary is-disabled" aria-disabled="true" href="#">Download for desktop</a>
    </div>
    <p class="foot-note">No trackers on this page either.</p>
  </footer>
</main>
```

- [ ] **Step 2: Create `landing/styles/sections.css`**

Layout only, token-driven. Content column `--content-max` (1180px). Hero is asymmetric 12-col (text 1–5, visual 6–12). Steps are 3-up → 1 column at 768px. Cards use the app material (spec §5). Full rules:

```css
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  max-width: var(--content-max); margin: 0 auto; padding: var(--space-7) var(--space-9);
  /* No backdrop-filter (global constraint). */
}
.topnav { display: flex; align-items: center; gap: var(--space-7); }
.brand { font-size: var(--fs-brand); font-weight: 700; letter-spacing: -0.02em; color: var(--ink); text-decoration: none; }

.hero {
  max-width: var(--content-max); margin: 0 auto; padding: var(--space-14) var(--space-9) var(--space-13);
  display: grid; grid-template-columns: 5fr 7fr; gap: var(--space-9); align-items: center;
}
.hero-headline { font-size: clamp(40px, 8vw, var(--fs-hero)); }
.hero-sub { font-size: var(--fs-section); color: var(--ink-secondary); max-width: 46ch; margin-top: var(--space-7); }
.cta-row { display: flex; gap: var(--space-4); margin-top: var(--space-9); }
.cta-micro { font-size: var(--fs-secondary); color: var(--ink-muted); margin-top: var(--space-5); }
.is-disabled { opacity: 0.55; pointer-events: none; }

.band { max-width: var(--content-max); margin: 0 auto; padding: var(--space-13) var(--space-9); }
.band-title { font-size: var(--fs-title); }
.band-lead { font-size: var(--fs-section); color: var(--ink-secondary); max-width: 60ch; margin-top: var(--space-6); }

.card {
  background: var(--surface); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card), inset 0 1px 0 var(--edge); padding: var(--space-9);
  transition: box-shadow var(--dur-standard) var(--ease);
}
.card:hover { box-shadow: var(--shadow-card-hover), inset 0 1px 0 var(--edge); }

.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-7); margin-top: var(--space-9); }
.step-num { font-size: var(--fs-prop); color: var(--accent); }
.choose-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-7); margin-top: var(--space-9); }
.closer { max-width: var(--content-max); margin: 0 auto; padding: var(--space-13) var(--space-9); text-align: center; }
.closer .cta-row { justify-content: center; }
.foot-note { font-size: var(--fs-caption); color: var(--ink-muted); margin-top: var(--space-6); }

@media (max-width: 768px) {
  .hero { grid-template-columns: 1fr; }
  .steps, .choose-cards { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .hero { padding-top: var(--space-12); }
  .band { padding: var(--space-12) var(--space-7); }
}
```

If a token name referenced above is absent, confirm the real name in `tokens.css` before substituting.

- [ ] **Step 3: Import `sections.css` from `main.ts`**

```ts
import './styles/sections.css';
```

- [ ] **Step 4: Fill `#prompt-text` with a real BYO-AI prompt excerpt**

Use a short, honest excerpt of an actual ingestion prompt (a sentence or two instructing the AI to output the course JSON). Keep it prose, mono-styled, no syntax highlighting.

- [ ] **Step 5: Verify build, typecheck, and no-JS visibility**

Run: `npx tsc -b --noEmit && npm run build`
Then serve `npm run preview` and load the landing page with JavaScript disabled; confirm all nine bands and their copy are visible.
Expected: PASS; all content readable with JS off.

- [ ] **Step 6: Commit**

```bash
git add landing/index.html landing/styles/sections.css landing/main.ts
git commit -m "feat(landing): nine content bands with final copy and responsive layout"
```

---

### Task 8: Product recreations (token-built, theme-aware)

Fill the three recreation containers with honest, token-styled HTML (spec §6). Representative-but-truthful values; every measured number `.mono-num`; **no "Work logged"**; one `--shadow-hero` (the Overview mock only).

**Files:**
- Modify: `landing/index.html` (`#mock-overview`, `#mock-matrix`, `#mock-validation` contents)
- Create: `landing/styles/recreations.css`
- Modify: `landing/main.ts` (import `./styles/recreations.css`)

**Interfaces:**
- Consumes: tokens + `.mono-num` + `.card` from Tasks 6–7.

- [ ] **Step 1: Overview hero recreation (`#mock-overview`)**

Author markup for: greeting "Good morning."; a course-health **ring** (SVG circle, value `82`, `.mono-num`, labelled "course health"); a "Due for review" card listing exactly three topics with `.mono-num` percentages (e.g. "Bayes' theorem — 41%", "Eigenvectors — 53%", "Krebs cycle — 58%"). Outer container is a `.card` with the page's single `--shadow-hero`. No "Work logged" prop.

```html
<div class="mock mock-hero" role="img" aria-label="Cairn's Overview: course health 82 of 100, with three topics due for review.">
  <p class="mock-greeting">Good morning.</p>
  <div class="mock-hero-body">
    <div class="ring"><span class="ring-num mono-num">82</span><span class="ring-cap">course health</span></div>
    <div class="mock-due">
      <p class="eyebrow">Due for review</p>
      <div class="mock-row"><span>Bayes' theorem</span><span class="mono-num">41%</span></div>
      <div class="mock-row"><span>Eigenvectors</span><span class="mono-num">53%</span></div>
      <div class="mock-row"><span>Krebs cycle</span><span class="mono-num">58%</span></div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Retention matrix recreation (`#mock-matrix`)**

An "Avg retention" stat with a small delta (e.g. `+4%` over 30 days, `.mono-num`) plus 3–4 rows: topic label + a retention bar (width = the %) + one diagnostic badge. Include one health chip and one delta chip so `.mono-num` discipline shows. `--shadow-card` (not hero).

- [ ] **Step 3: Validation card recreation (`#mock-validation`)**

Filename ("syllabus.json"), two `✓` counts ("4 sections", "22 topics", `.mono-num`), a green `--success` "committed" tag, and the "Nothing saved until you say so." line. `--shadow-card`.

- [ ] **Step 4: Create `landing/styles/recreations.css`**

Style the three mocks with tokens. The Overview `.mock-hero` gets `box-shadow: var(--shadow-hero), inset 0 1px 0 var(--edge)` — the only hero shadow on the page. Retention bars use `--accent` fills; the committed tag uses `--success`. Ring is an SVG or a conic-gradient circle sized from a token. Import from `main.ts`.

- [ ] **Step 5: Verify — one hero shadow, no removed domains, both themes**

Run: `npm run build && npm run preview`, then:
- `grep -ri "work logged\|fitness\|lifting\|running\|jobs" landing/index.html || echo "clean"` → "clean".
- Confirm exactly one element uses `--shadow-hero` (search `landing/styles/recreations.css`).
- Toggle light/dark; both recreations render correctly in each.
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add landing/index.html landing/styles/recreations.css landing/main.ts
git commit -m "feat(landing): token-built Overview, retention, and validation recreations"
```

---

### Task 9: Wire interactivity

Connect the tested modules to the DOM in `main.ts`: theme toggle, reveals (respecting reduced motion), and the prompt copy button.

**Files:**
- Modify: `landing/main.ts`

**Interfaces:**
- Consumes: `setupReveals` (Task 2), `copyText` (Task 3), `setupThemeToggle` (Task 4).

- [ ] **Step 1: Replace `landing/main.ts` body with the wiring**

Keep the existing CSS imports at the top; add:

```ts
import { setupReveals } from './reveal';
import { copyText } from './clipboard';
import { setupThemeToggle } from './theme-toggle';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const toggle = document.getElementById('theme-toggle');
if (toggle) setupThemeToggle(toggle);

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
```

- [ ] **Step 2: Give the theme toggle its icon**

Set the button's content to a Lucide sun/moon (tree-shaken import from `lucide`), matching the app's crossfade intent. Icon only; no text label beyond `aria-label`.

- [ ] **Step 3: Verify interactivity in the browser**

Run: `npm run preview`, then manually: theme toggle flips and persists (reload keeps it); scrolling reveals bands; the copy button copies the prompt and shows "Copied". With `prefers-reduced-motion` on, bands are visible with no animation.
Expected: all behaviours work.

- [ ] **Step 4: Run the full test suite and typecheck**

Run: `npx tsc -b --noEmit && npm test`
Expected: PASS (all landing module tests plus the existing app suite).

- [ ] **Step 5: Commit**

```bash
git add landing/main.ts
git commit -m "feat(landing): wire theme toggle, reveals, and prompt copy"
```

---

### Task 10: Final verification pass (Definition of Done)

Verify the whole page against spec §11. Fix anything that fails, then commit any fixes.

**Files:**
- Modify: whichever files a failing check implicates.

- [ ] **Step 1: Responsive**

At ≥1180px, 768px, and 720px: no horizontal scroll; hero stacks to one column ≤768px; steps and choose-cards become single column ≤768px. Verify in the browser at each width.

- [ ] **Step 2: Themes**

Full light/dark parity across every band and recreation. Theme choice persists across reload and is written before first paint (no flash).

- [ ] **Step 3: Reduced motion + No-JS**

With `prefers-reduced-motion: reduce`: nothing animates, nothing hidden. With JS disabled: every band and its copy visible and readable.

- [ ] **Step 4: Performance (guard the app's lesson)**

Serve `npm run preview`, open the landing page, and run the frame-timing probe used on the app (oscillating scroll for ~2s, measuring `requestAnimationFrame` intervals). Target **≥ 50 FPS**. Confirm no `backdrop-filter` on the top bar or any scroll region:
Run: `grep -rn "backdrop-filter" landing/ || echo "none — good"`
Expected: "none — good".

- [ ] **Step 5: Accessibility**

`:focus-visible` ring on every interactive element; full keyboard traversal (tab order top bar → hero CTAs → nav → bands → closer); recreations carry correct labelling (the Overview mock has a descriptive `aria-label`; purely decorative bars are `aria-hidden`). Run a quick axe/Lighthouse a11y check if available.

- [ ] **Step 6: Content truth**

Run: `grep -rin "work logged\|fitness\|lifting\|running\b\|jobs\|supercharge\|unlock\|revolutionize" landing/ || echo "clean"`
Expected: "clean". Confirm every measured number is inside a `.mono-num` element; confirm exactly one `--shadow-hero` on the page.

- [ ] **Step 7: Links**

"Open the app" resolves to the app build (`/`); "Download for desktop" is a clean disabled placeholder, not a broken navigation.

- [ ] **Step 8: Commit any fixes**

```bash
git add -A landing/
git commit -m "test(landing): final verification pass — responsive, themes, a11y, perf, content"
```

---

## Self-Review

**Spec coverage:**
- §2 decisions → Tasks 1 (arch), 8 (recreations), 5 (fonts), 7 (headline/copy). ✓
- §3 constraints → Global Constraints block + enforced in Tasks 6 (PE reveal, reduced motion), 8 (one hero shadow, no removed domains), 10 (verification). ✓
- §4 architecture/file structure → Task 1. ✓
- §4 dependencies → Task 1 (add), Tasks 2–5 usage; Motion/Base UI explicitly deferred. ✓
- §5 visual direction → Tasks 6 (type/buttons/canvas/reveal) + 7 (layout) + 8 (surfaces/shadow). ✓
- §6 recreations → Task 8. ✓
- §7 CTA placeholder wiring → Task 7 (markup + `is-disabled`). ✓
- §8 nine bands → Task 7. ✓
- §9 copy strings → Task 7 (verbatim). ✓
- §10 interactivity → Tasks 2–4 (logic) + 9 (wiring). ✓
- §11 verification/DoD → Task 10. ✓
- §12 out of scope → respected (no backend/login/exe/palette). ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases". Recreation value choices and the prompt excerpt are specified as "honest/representative" with concrete examples given; the `?url` preload fallback is spelled out rather than left vague.

**Type consistency:** `setupReveals`, `makeRevealHandler`, `revealElement`, `copyText`, `nextTheme`, `setupThemeToggle` are used in Task 9 exactly as defined in Tasks 2–4. Theme imports (`applyTheme`, `getInitialTheme`, `Theme`) match `src/theme/theme.ts` exports. DOM hook ids (`#theme-toggle`, `#copy-prompt`, `#prompt-text`, `#mock-overview/matrix/validation`) are defined in Task 7 and consumed in Tasks 8–9.
