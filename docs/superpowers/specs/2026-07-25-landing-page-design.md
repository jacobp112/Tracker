# Cairn — Landing Page Design Spec

**Date:** 2026-07-25
**Status:** Approved design, ready for implementation planning
**Source research:** `docs/Landing/compass_artifact_wf-6fd6157a-f3d3-52a6-80b1-22ee10837a73_text_markdown.md`
(the research artifact — this spec is the implementable distillation of it plus the decisions below; where they differ, this spec wins).

---

## 1. Goal

Build the public marketing page that advertises the app (working name **Cairn**), for
an audience of **self-study learners who use an AI to tutor themselves a subject**. The
page must sell the product's one idea — *your AI-tutored studying has no memory; Cairn
gives it one* — and route visitors to one of two calls to action: **Open the app**
(the existing local-first web app) or **Download for desktop** (a future build).

The page must read as **deliberately human-designed and professional**, indistinguishable
in craft from the app itself, and must not read as a generated "AI landing page."

## 2. Locked decisions

These were decided in brainstorming and are not open in implementation:

1. **Scope: the landing page only.** The real hosted backend/login and the desktop
   `.exe` are explicitly out of scope and will be specced separately. On this page both
   CTAs point at placeholders (see §7).
2. **Architecture: a separate Vite entry in the same repo** that imports the app's real
   token CSS. No copied/duplicated tokens. (§4)
3. **Product visuals: token-built, theme-aware recreations**, not captured PNG
   screenshots. We author the markup ourselves using the shared tokens. (§6)
4. **Headline:** *"Your AI can teach you anything. It just can't remember you learned
   it."* (§5, §8)
5. **Name: Cairn.** Used as the wordmark throughout. (Trademark/domain clearance is a
   business task, out of scope for this spec.)

## 3. Non-negotiable constraints

Inherited from the app's design system and its hard-won performance lessons. Every one
is a hard rule for the build:

- **Reuse the app's design tokens literally.** The page imports `src/styles/tokens.css`
  and `src/styles/palette.css`; it does not restate colour, type, spacing, radius, or
  shadow values.
- **Ship light and dark**, both first-class, driven by `data-theme` written before first
  paint (no FOUC).
- **No `backdrop-filter` on the top bar or any scroll region.** Re-blurring the
  background every frame dropped the app from ~53 FPS to ~13 FPS. The `--surface`
  0.75-alpha material already reads as glass. (The only permitted heavy blur is a
  *static, non-scrolling* command-palette mock, if we ever build one — not in this spec.)
- **Exactly one `--shadow-hero` on the entire page** — the hero product recreation.
  Everything else uses `--shadow-card` / `--shadow-card-hover`.
- **Every number that represents a measured value** (retention %, health 0–100, streak
  days, topic counts, deltas) is set in `.mono-num` (`--font-mono`, `tabular-nums`,
  `letter-spacing: 0`). This is the app's single most important typographic rule.
- **`prefers-reduced-motion` is a hard gate.** Under it: transition durations collapse to
  0.01ms (not `none`, so `transitionend` still fires), all reveal content is forced
  visible, any animated bars/rings snap to final state. Reduced motion must **never**
  leave content hidden.
- **Progressive enhancement.** This is a public page: with JavaScript disabled, **all
  content is fully visible and readable**. Reveal animations opt *in* only when JS is
  present and can guarantee the reveal — content must never be stranded at `opacity: 0`.
  (This inverts the in-app `.reveal` pattern, which assumes JS.)
- **Study + Exams only.** No recreation, screenshot, caption, or copy may ever show the
  removed domains — "Work logged," Fitness, running, lifting, or Jobs. The real app's
  Overview still renders a "Work logged" prop; our recreations author around it.
- **Voice audit.** No "supercharge / unlock / revolutionize," no emoji as feature icons,
  no gradient-blob / mesh hero, no fake bento grids, no lorem numbers. If a line couldn't
  appear inside the app's own UI voice, cut it.

## 4. Architecture & file structure

A second Vite entry in the existing repo. Plain **HTML + CSS + minimal vanilla
TypeScript — no React** (the page's interactivity is a theme toggle, scroll-reveals, and
a copy button; a React runtime is unjustified weight).

```
landing/
  index.html          # the marketing page: semantic <section> bands (§8)
  landing.css         # page-only styles; @imports ../src/styles/tokens.css & palette.css
  fonts.css           # self-hosted Inter + JetBrains Mono (@fontsource-variable)
  main.ts             # theme init (pre-paint), scroll-reveal observer, copy-to-clipboard
  mocks/              # token-built product recreations as static markup/partials (§6)
vite.config.ts        # add rollupOptions.input: { app: 'index.html', landing: 'landing/index.html' }
```

- **Token reuse:** `landing.css` imports the app's token files directly; no values are
  copied. Page-specific layout classes live in `landing.css`.
- **Theme:** reuse the app's pre-paint inline `<script>` pattern and the **same
  `studyos-theme` localStorage key** (`THEME_STORAGE_KEY`), so a visitor's theme choice
  carries into the app when they click "Open the app."
- **Build:** `npm run build` emits both the app and the landing page. `npm run dev`
  serves both entries.

### Dependencies

**Add:**
- `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` — self-hosted
  variable fonts, zero runtime CDN calls. Preload only the two above-the-fold faces via
  Vite's `?url` asset import; keep `font-display: swap` with explicit fallback metrics
  (`size-adjust` / `ascent-override`) on the `-apple-system` stack to kill layout shift.
  Preserve `font-feature-settings: 'cv05','cv08','ss01','tnum' 0`.
- `lucide` — a handful of functional icons only (download glyph, copy glyph, `⌘K` chip,
  theme sun/moon), tree-shaken. **Never** a three-up icon feature grid.

**Deferred — add only if a threshold is hit:**
- **Motion** (`m` + `LazyMotion`, ~4.6 KB) — only if a hand-rolled CSS/`requestAnimationFrame`
  count-up for the hero ring proves insufficient. Token-driven if added.
- **Base UI** — only if we build ≥2 real interactive primitives (e.g. a dialog demo). A
  lone dialog uses the native `<dialog>` element + a small focus trap instead. Not in
  this spec's scope.

**Explicitly rejected:** Tailwind/Bootstrap/Chakra/MUI (erase the bespoke feel), Google
Fonts CDN (external call), GSAP (Webflow-owned revocable licence), client-side syntax
highlighters (runtime weight for decoration).

## 5. Visual direction (in the app's token vocabulary)

- **Type ramp:** hero `--fs-hero` (76px, clamp to `clamp(40px, 8vw, 76px)` under 768px);
  section titles `--fs-title` (32px); section headers `--fs-section` (19px); body
  `--fs-body` (15px); supporting `--fs-secondary` (13.5px); eyebrows `--fs-eyebrow`
  (12px, uppercase, weight 700, `letter-spacing: 0.07em`, `--ink-muted`). Headings weight
  700, `letter-spacing: -0.02em`, `line-height: 1.2`. Body carries
  `letter-spacing: -0.006em` and the `cv05/cv08/ss01/tnum` feature settings.
- **Colour:** restrained neutral canvas, one blue accent. `--ink` headlines,
  `--ink-secondary` body, `--ink-muted` eyebrows/microcopy. `--accent` appears only on
  the primary CTA, links, the hero ring, and step numerals. `--success`/`--warning`/
  `--danger` appear **only inside recreated UI** (a green committed tag, a red
  validation-fail line), never as decorative brand colour. Canvas reuses the app's `body`
  treatment: two soft radial washes (`--wash-1` at 12% -8%, `--wash-2` at 102% 4%) over
  `--bg-page`, `background-attachment: fixed`. **No gradient hero.** `--accent-2` /
  `--accent-gradient` stay incidental — at most one quiet corner bloom behind the hero
  ring.
- **Surface / shadow:** cards use `background: var(--surface)`, `--radius-lg` (20px),
  `box-shadow: var(--shadow-card), inset 0 1px 0 var(--edge)` — the inset top edge is the
  material cue and is required. Hover raises to `--shadow-card-hover` over `--dur-standard`
  with `--ease`. `--shadow-hero` is reserved for the single hero recreation.
- **Radius nesting:** outer larger than inner — `.card` (`--radius-lg`) contains chips
  (`--radius-chip` 6px), inputs (`--radius-sm`/`--radius-md`); pill CTAs `--radius-pill`.
- **Buttons:** primary `.btn-primary` (filled `--accent`, white ink, pill); secondary
  `.btn-secondary` (surface + `--border-strong`, `--ink`). Both take the app's
  `:focus-visible` treatment (`outline: 2px solid var(--accent); outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--accent-soft)`) — on **every** interactive element.
- **Motion:** reuse the `.reveal` idea (translateY(14px) + fade, staggered by `--i` and
  `--reveal-step` 70ms) but gated by the progressive-enhancement rule (§3). Easing
  `--ease` standard, `--spring` for the ring count-up; durations from the token set
  (`--dur-reveal` 0.6s, `--dur-data`/`--dur-draw` for ring/bars).

## 6. Product recreations (token-built, theme-aware)

Three static recreations authored in markup and styled by the shared tokens. They are
**honest recreations, not literal captures** — we screenshot the real app only as
building reference, and use representative-but-honest values. This is stated plainly so
no one mistakes them for live captures.

1. **Overview hero** (the page's one hero moment). Contents: the greeting ("Good
   morning."), the course-health **ring** (0–100 with a count-up), and a "Due for review"
   card of **three** real-looking decayed topics with `.mono-num` percentages. Framed in a
   `.card` with the page's single `--shadow-hero` + `inset 0 1px 0 var(--edge)`. **Must
   not** include a "Work logged" prop or any removed-domain content.
2. **Retention matrix** (memory-model band). A crop of the Course Dashboard: an "Avg
   retention" stat with a small sparkline + a 30-day delta, plus a few `RetentionRow`s
   (label + retention bar + dot + one diagnostic badge). Shows one `HealthChip` and one
   `DeltaChip` so the `.mono-num` discipline is visible. Uses `--shadow-card` (not hero).
3. **Validation card** (BYO-AI step 3). A tight preview: a filename, a couple of
   `✓`-checked counts (e.g. "4 sections", "22 topics"), a green `--success` "committed"
   `Tag`, and the "nothing saved until you say so" line. `--shadow-card`.

All recreations: real UI only, `--radius-lg` corners, the inset edge, no floating
disconnected fragments, `.mono-num` on every measured number.

## 7. CTAs (placeholder wiring)

Two honest CTAs, repeated at: top bar (Open only), hero (both), the "choose your way in"
band (both), and the closer (both). **Never a sticky nag bar.**

- **Primary — "Open the app."** Links to the existing local-first web app build.
  Microcopy: *"Runs in your browser. No account — there's nothing to log into, by design.
  Your data lives in this browser."*
- **Secondary — "Download for desktop."** **Placeholder** for now: renders in a clearly
  non-broken "coming soon" state (e.g. disabled with a "desktop build coming" note), since
  the `.exe` is future work. Microcopy (for when it ships): *"A native build for
  macOS/Windows. Your data lives in a file on your disk. Works fully offline."*
- **Shared honesty line** (choose-your-way-in band): *"The two don't sync — there's no
  server between them. Export a JSON bundle from one and import it into the other whenever
  you like."*

## 8. Page composition

Content column `--content-max` (1180px); breakpoints at **768px** and **720px** (as in
the app). Spacing from `--space-*`. Nine bands in order:

1. **Top bar.** Wordmark "Cairn" (`--fs-brand` 16px), 2–3 anchor-nav items (How it works,
   Privacy), theme toggle, compact "Open the app" button. Thin, **no `backdrop-filter`**.
2. **Hero.** Asymmetric 12-col, left-weighted (text cols 1–5, Overview recreation cols
   6–12) — deliberately *not* centered-everything. Eyebrow "A MEMORY FOR SELF-STUDY";
   headline #1 (§2.4); subhead (§ copy below); CTA row (both CTAs) + microcopy. Section
   padding `--space-14` top / `--space-13` bottom; stacks to one column ≤768px with the
   headline clamped and the recreation full-width.
3. **The problem, stated plainly.** One short band: *"You study a topic with your AI. A
   week later, nothing remembers you did."* Sold by recognition of the workflow, not hype.
4. **How it works — the BYO-AI loop.** The key below-the-fold section. Three equal cards
   (12-col → 4/4/4, `gap --space-7`), staggered reveal (`--i` 0/1/2). Header eyebrow "HOW
   IT WORKS" + title *"You bring the AI. Cairn brings the memory."* Must dispel "is this
   another AI wrapper?" by showing **the app verifies; it never generates.** Copy in §9.
5. **The memory model.** Courses → sections → topics, retention curve `R(t)=e^(−t/(k·s))`,
   health scores, confidence calibration (OCI), due-for-review queue. Features the
   **retention-matrix** recreation (§6.2). The intellectual proof.
6. **Exams recalibrate.** Focused band: test events tune each topic's decay rate
   (`k_factor` drift), so exams outweigh study sessions *by evidence, not arbitrary
   weights.* The differentiator vs. flashcard apps.
7. **Privacy, as a feature.** *"No accounts. No backend. No network requests. Your data is
   one JSON file in your browser."* Export/import; the only external actor is the AI the
   user chooses. This is where "no accounts" flips from gap to selling point.
8. **Choose your way in.** Two-card band (Download vs Open) that makes the choice
   effortless and states the no-sync truth (§7). Both CTAs.
9. **Quiet closer.** One line, wordmark, both CTAs a final time, honest one-line footer
   (version; "no trackers on this page either").

## 9. Copy (final strings)

- **Headline:** "Your AI can teach you anything. It just can't remember you learned it."
- **Subhead:** "Cairn tracks your courses, sections, and topics on a real retention curve
  — so you always know what's fading and what's due. It runs on your machine, stores
  everything in one file you own, and never calls an AI itself. You bring the AI; Cairn
  keeps the memory."
- **Section headers:** Problem — "Studying with AI has no memory." · How it works — "You
  bring the AI. Cairn brings the memory." · Memory model — "It tracks how well you know
  things — and how that fades." · Exams — "Exams don't count more because we say so. They
  count more because they're evidence." · Privacy — "No accounts. No backend. No network.
  Just your file." · Choose — "Two ways in. Same app. Your data stays where you put it."
- **BYO-AI three steps:**
  1. **Copy the prompt.** "Cairn hands you a ready-made prompt. Paste it into whatever AI
     you already use, along with your syllabus, session notes, or exam paper."
  2. **Paste the result back.** "Paste the AI's JSON into Cairn. It's checked against a
     strict schema — no extra fields, no invented dates. If something's wrong, you get a
     plain-English message naming the field and the fix."
  3. **Preview, then commit.** "See exactly what will change. Nothing is saved until you
     say so — then it's written in one atomic step. Cairn verifies; it never generates."
- **Privacy block body:** "Cairn makes no network requests. There are no accounts, no
  telemetry, no backend to breach. Everything you track is a single JSON document in your
  browser's storage. Settings → Export gives you the whole thing; import validates it just
  as strictly as a fresh paste. The only outside party that ever sees your material is the
  AI you choose to paste into — and that's your call, not ours."
- CTA microcopy and the no-sync line: §7.

## 10. Interactivity (all in `main.ts`, vanilla TS)

- **Theme toggle:** flips `data-theme`, persists to `studyos-theme`, cross-fades over
  `--dur-theme` (0.4s). Pre-paint inline script sets the attribute before first paint.
- **Scroll reveals:** an `IntersectionObserver` adds a visible class as bands enter. Under
  the progressive-enhancement rule, the *default* (no-JS) state is visible; JS only adds
  the hidden→reveal treatment when it can guarantee revealing. Respects
  `prefers-reduced-motion`.
- **Copy button** on the prompt block: Clipboard API with a graceful fallback; a brief
  "Copied" state.
- **Smooth anchor scrolling** for top-bar nav links.

## 11. Verification (Definition of Done)

- **Responsive:** correct at ≥1180px, at 768px, and at 720px; no horizontal scroll at any
  width; hero and 3-card loop stack as specified.
- **Themes:** full light/dark parity; theme choice persists and carries to the app.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, nothing animates and nothing
  is hidden.
- **No-JS:** with JavaScript disabled, all content is visible and readable.
- **Performance:** scroll ≥ **50 FPS** on a mid-tier laptop (re-verify with the same
  frame-timing method used on the app; guard against any `backdrop-filter` regression).
- **Accessibility:** `:focus-visible` on every interactive element; full keyboard
  operability; recreations labelled correctly (decorative vs. meaningful); colour contrast
  meets AA as the app's tokens already do.
- **Content truth:** no removed-domain content anywhere; every measured number is
  `.mono-num`; no hype copy; no emoji feature icons; no gradient-blob hero.
- **Links:** "Open the app" resolves to the app build; "Download for desktop" is a clean
  placeholder, not a broken link.

## 12. Out of scope (future, separate specs)

- The hosted backend and any real login/accounts/sync.
- The desktop `.exe` packaging (Tauri/Electron).
- Trademark clearance and domain acquisition for "Cairn."
- A blog, docs site, or any page beyond this single landing page.
- The command-palette (⌘K) demo and any Base UI primitive.

## 13. References

- Research artifact: `docs/Landing/compass_artifact_wf-6fd6157a-f3d3-52a6-80b1-22ee10837a73_text_markdown.md`
- App design system: `docs/specs/03-ui-design-spec.md`
- Token sources the page imports: `src/styles/tokens.css`, `src/styles/palette.css`
- Perf lesson (no `backdrop-filter` on scroll regions): `src/styles/global.css`,
  `src/styles/shell.css` comments.
