# Landing Page Design & Naming Specification — a local-first study/exam tracker

**Placeholder used in all wireframes below: "Cairn"** — my single strongest naming candidate (see §1). Everywhere you see "Cairn," treat it as swappable with the final name.

## TL;DR
- **Name:** go evocative. My top 3 are **Cairn**, **Ebb**, and **Sediment** — all metaphors for memory that accretes and needs tending. **Cairn is the recommendation**; its only conflicts sit in unrelated sectors (hiking, B2B trades, compliance, dev tooling), none in edtech.
- **Build it lightweight and self-hosted:** Motion's `LazyMotion`/`m` (~4.6 KB) driven by *your* existing motion tokens, Base UI v1.0 for the two or three real interactive primitives, self-hosted Inter + JetBrains Mono via `@fontsource-variable` (no Google Fonts CDN), Lucide for the handful of icons, and NO client-side syntax-highlighter. Skip Tailwind/Chakra/MUI entirely — they'd erase the bespoke feel.
- **Two honest CTAs:** primary **"Open the app"** (web, instant, no account by design), secondary **"Download for desktop."** Turn "no accounts" into the headline privacy proof, and state plainly that the two don't sync because there is no server between them.

---

## 1. Naming

### Design brief for the name
Calm, precise, privacy-first, for self-directed learners who study with an AI. The two richest wells are (a) **memory / retention / spaced repetition** and (b) **you own your data**. Hard exclusions honoured: no AI/Smart/Genius/Brain/Mind affixes, no vowel-dropped spellings, no …OS/…HQ/…Labs.

### Candidate grid

| # | Name | Direction | One-line rationale | Conflict check (searched) |
|---|------|-----------|--------------------|---------------------------|
| 1 | **Cairn** | Evocative | A stack of trail-stones you build one at a time; it both marks how far you've come and shows the next traveller the path — exactly what a review queue does. | **Crowded but off-category.** Cairn hiking-safety app (App Store), Cairn Labs (B2B trades software), a Cairn OSHA-compliance research platform, a "Cairn" open-source coding agent, Cairn healthcare-billing software. **None in edtech/study.** `cairn.com` taken; `trycairn.com`/`cairn.app`/`getcairn.com` plausibly open. Verdict: usable, flag it. |
| 2 | **Ebb** | Evocative | Ebbinghaus's forgetting curve *and* the tide that recedes and returns — memory decay and its refresh in one three-letter word. | **Close adjacency risk.** `ebb.cool` is a *local-first, open-source* macOS focus app — same positioning, different function. "EBB" = a law-school exam bluebook tool. Ebb Software = a game studio (*Scorn*). `ebb.com` certainly taken. Verdict: strong concept fit, flag the ebb.cool collision. |
| 3 | **Sediment** | Evocative | Knowledge settling into durable layers over time; the accretion metaphor for long-term retention. | **Cleanest of the slate.** Only niche geology-logging tools (SedLog, etc.) share it — nothing in edtech/productivity. `sediment.com` likely parked but not held by a famous tech entity; `.app`/`.io` worth checking. Downside: faint "sludge/settling" connotation, three syllables. |
| 4 | **Palimpsest** | Evocative | A manuscript rewritten over time with older layers still faintly legible — a near-perfect image of memory refreshed by review. | Minor: an indie "Palimpseste" reading web-app (French, tiny). Otherwise clear. Downside: **hard to spell and say** — fails the "easy to say" test. |
| 5 | **Marginalia** | Evocative | The scholar's notes in the margins; annotation, close study, ownership of one's copy. | Conflict: **Marginalia Search**, a known indie/AGPL search engine (different category). Long, four syllables. |
| 6 | **Loam** | Evocative | Fertile soil where learning takes root and holds. | Crowded: a "Loam" AI startup (acquired by Self Labs 4/2026), Loam security-UX, Loamics data. Strong phonetic clash with **Loom** (Atlassian). Off-category but noisy. |
| 7 | **Overstory** | Evocative | The forest canopy — the high-level view over all your topics; the "Overview" screen made literal. | Crowded: **Overstory** owns `overstory.com` — an Amsterdam vegetation-intelligence AI company that has raised **$67.9M total** ($43M Series B led by Blume Equity, announced Nov 25 2025). Different sector, but a well-capitalised owner holds the exact name + .com. |
| 8 | **Cadence** | Evocative | The steady rhythm of spaced review. | Crowded: **Cadence Design Systems** (giant EDA firm), plus task apps. Avoid. |
| 9 | **Vestibule** | Evocative | The entryway you pass through before the main hall of a subject. | Clean in-category but weak fit (entryway ≠ memory), strong "vestibular"/medical association. |
| 10 | **Retain** | Plain-descriptive | Says the core benefit — retention — outright. | Contrast candidate; near-certainly crowded in edtech; generic. |
| 11 | **Interval** | Plain-descriptive | The spaced interval between reviews. | Contrast candidate; generic, likely crowded (Interval.com, dev tools). |
| 12 | **Revisit** | Plain-descriptive | Plainly names the review loop. | Contrast candidate; generic, likely crowded. |

### Recommended top 3 (evocative, per your steer)

**1. Cairn — recommend.** The metaphor does real work: a cairn is *built incrementally*, *marks progress*, and *guides the next person down the path* — a tidy triple for "log a session," "see your mastery," and "here's your review queue." One syllable, trivially sayable, plausibly ownable via a `try-`/`get-`/`.app` domain. Every conflict I found is in an unrelated trademark class (outdoor safety, construction, compliance, dev tooling); **nothing collides in study/edtech.** This is the one to take to formal clearance.

**2. Ebb — strong runner-up.** The best pure *concept* fit on the list: it names the forgetting curve's author and the tidal in-and-out of retention at once, and it's beautifully short. The reason it isn't #1 is honesty: `ebb.cool` is a small but real *local-first, open-source* productivity app — the closest positioning collision of any candidate. Ownable if you're comfortable coexisting with a minor same-space app; clear it first.

**3. Sediment — the safe evocative pick.** If you want the fewest legal surprises, this is it — the cleanest conflict profile I found, with a genuine "layers of knowledge settling into permanence" story. Trade the tiny "sludge" connotation for near-empty namespace.

Honourable mention: **Palimpsest** has the richest metaphor of all but loses on pronounceability; keep it as a wordmark idea (e.g., a product blog) rather than the app name.

---

## 2. Library recommendations

Ground rules I held to: **nothing that imposes a templated look** (no Tailwind UI kits, no Bootstrap/Chakra/MUI), **everything self-hostable with zero runtime network calls** (fonts especially — no Google Fonts CDN), and **every dependency justified or rejected.** Any motion must be driven by *your* existing tokens (`--ease`, `--spring`, `--dur-*`, `--reveal-step`), not a library's own opinions.

### Motion / animation

| Option | What it's for | Cost (min+gzip) | React 18 + Vite | Verdict |
|--------|---------------|-----------------|-----------------|---------|
| **Motion** (`motion`, formerly Framer Motion), `LazyMotion` + `m` | Orchestrated reveals, springy count-ups, hover raises | full `motion` ~34 KB; **`LazyMotion`+`m` "just under 4.6kb for the initial render"** (Motion's own docs); `useAnimate` mini ≈ 2.3 KB | Yes — import from `motion/react`; v12.x; first-class Vite | **Recommend, minimal footprint.** Use `m` + `LazyMotion` only. |
| **GSAP** (+ ScrollTrigger, SplitText) | Timeline-grade scroll choreography | Core + ScrollTrigger heavier than Motion-mini | Yes | **Skip.** Overkill for a restrained page; and its "free" status is a **Webflow-owned, revocable license** (IP remains Webflow's), not OSI open-source — a mismatch with a "own your stuff" product. |
| **Native CSS scroll-driven animations + View Transitions API** | Scroll-linked fades, theme cross-fade | 0 KB | Yes (progressive) | **Use where supported**, as the baseline; your existing `.reveal` pattern already covers the stagger. |
| **react-intersection-observer** | Trigger reveals on enter | ~1.5 KB | Yes | **Skip — hand-roll it.** A ~15-line `IntersectionObserver` hook adds no bytes and matches your existing `body.loaded .reveal` idiom exactly. |

**The core recommendation:** don't import a new motion idiom at all. **Extend your existing `.reveal` + `--i` stagger.** Where you genuinely need physics (the hero ring's count-up, a hover lift beyond CSS), reach for Motion's `m` component under a single `LazyMotion` boundary (~4.6 KB) and feed it your tokens: `transition={{ duration: 0.6, ease: [0.2,0.8,0.2,1] }}` (that's `--dur-reveal` and `--ease`). Every animation must respect `prefers-reduced-motion` the way the app already does — durations to 0.01ms (not `none`, so `transitionend` still fires), `.reveal` forced visible, bars snapped to final width. Motion honours `useReducedMotion`/`MotionConfig reducedMotion="user"`; wire it to the same media query so reduced motion NEVER leaves content hidden.

### Interactive primitives (menus, dialogs, tabs)

| Option | Status (2026) | Verdict |
|--------|---------------|---------|
| **Base UI** (`@base-ui/react`) | **Shipped stable v1.0.0 on Dec 11 2025**; 35 components; MUI-funded full-time team; built by several of the same engineers who built Radix (per shadcn's July 2026 note: "the same folks who built Radix are building something new"); render-prop API; **shadcn's default for new projects since July 2026** (Radix not deprecated) | **Recommend.** Unstyled, accessible, actively maintained, single package. You style it entirely with your tokens, so no templated look leaks in. |
| **Radix Primitives** (`radix-ui`) | Not deprecated, still supported by WorkOS, but **maintenance has visibly slowed** since the WorkOS acquisition; unified `radix-ui` package since Feb 2026 | Fine fallback; only pick it if a specific primitive you need is missing from Base UI. |
| **Headless UI** (Tailwind Labs) | **~10 components, has fallen behind on coverage and maintenance velocity** | **Skip.** Too thin and too Tailwind-coupled. |
| **React Aria Components / Ark UI** | Both active | Not needed; Base UI covers a marketing page's needs. |

For a marketing page you need shockingly few of these — realistically a **Dialog** (for an inline "see the paste-JSON flow" demo or a video lightbox), maybe **Tabs** (web-vs-desktop comparison), and the theme toggle. If it ends up being just a dialog, consider the native `<dialog>` element + a ~20-line focus-trap and **add no primitive library at all.** Only pull in Base UI if you need two or more primitives.

### Typography / font delivery (hard requirement: self-hosted, no CDN)

**Recommend `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono`.** Both ship the woff2 variable files inside the npm package — Vite fingerprints and serves them from your own origin, so **zero runtime network calls**, honouring the privacy stance. Specifics:
- Import the variable CSS once at the entry (`import '@fontsource-variable/inter'`).
- **Preload only the two above-the-fold faces** using Vite's `?url` asset directive so the hashed filename resolves: `import interWoff2 from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'` then `<link rel="preload" as="font" type="font/woff2" href={interWoff2} crossorigin="anonymous">`. Don't preload every weight — that hurts first paint. (Fontsource's own docs warn: "Avoid preloading all font files … as this may lead to increased initial load times.")
- Keep `font-display: swap` (Fontsource's default) and set explicit fallback metrics (`size-adjust`/`ascent-override`) on the `-apple-system` fallback stack to **kill layout shift** while the variable font loads.
- **Your `cv05`/`cv08`/`ss01` stylistic sets survive self-hosting** because they're OpenType GSUB features baked into the font binary; Fontsource's latin `unicode-range` subsetting doesn't strip feature tables. Keep `font-feature-settings: 'cv05','cv08','ss01','tnum' 0` exactly as the app declares it.
- Skip `unplugin-fonts` / `vite-plugin-webfont-dl` — the latter *downloads from a CDN at build time*, a needless external dependency when Fontsource already vendors the files.

### Icons

**Recommend Lucide (`lucide-react`), used sparingly and self-hosted.** Lucide reached **v1.0 in June 2026 with more than 1,600 icons** on a 24px grid / 2px stroke — a good geometric match to Inter — and the v1.0 release **cut the `lucide-react` package by 32.3%, from 11.4 MB to roughly 1 MB gzipped**, with clean per-import tree-shaking (a real-world 45-icon import measured ~12 KB gzipped). MIT, SVG, no network calls. Phosphor is the alternative if you want its 6 weights for expressive marketing glyphs, but it's heavier per icon and you don't need weight variants here.

**But honour your own "DO NOT" list:** no generic three-column Lucide feature grid, no emoji icons. Use icons only as small functional affordances (a download glyph, a copy glyph on the prompt block, the `⌘K` chip). The feature visuals should be **real product UI**, not iconography.

### Syntax highlighting for the copy-paste prompt

**Recommend: NONE on the client.** The BYO-AI prompt is prose with a little JSON — not code that benefits from tokenised colour. Render it in a `.card` using `--font-mono` + `.mono-num` discipline, with a single "Copy" button. If you later show the *returned JSON* and want it lightly coloured, **pre-highlight at build time with Shiki** (TextMate grammars, VS Code themes; ~280 KB + WASM, but **shipped as static HTML with inline styles and zero client JS**). Never ship Prism or highlight.js to the client for one snippet — that's runtime weight for decoration.

### Theme toggle

**No library.** You already set `data-theme` before first paint via an inline script (no FOUC). A plain button that flips the attribute and persists to `localStorage`, cross-fading over `--dur-theme` (0.4s), is all you need.

### Net dependency budget
Motion (`m`/`LazyMotion`, ~4.6 KB) · Base UI (only if ≥2 primitives) · two Fontsource variable packages · Lucide (tree-shaken). Everything else — reveals, theme toggle, prompt block, focus rings — is your existing hand-rolled CSS. **That's the whole point: the page should look like it left the same studio as the app because it literally reuses the app's tokens and patterns.**

---

## 3. Recommended page structure

Order, with rationale tuned to a privacy-first, BYO-AI tool for self-directed learners:

1. **Top bar** — wordmark (Cairn) at `--fs-brand` (16px), a 2–3 item nav, theme toggle, and a compact **"Open the app"** button. Thin, no `backdrop-filter` (respect the FPS lesson). Repeats CTA #1 always-visible.
2. **Hero** — the promise + the single best real screen + both CTAs. Names the gap the product fills: *your AI-tutored studying has no memory.* (Layout in §4a.)
3. **The problem, stated plainly** — one short band: "You study a topic with your AI. A week later, nothing remembers you did." Sets up the reason to exist before any feature talk. This audience is sold by *recognition of their exact workflow*, not by hype.
4. **How it works — the BYO-AI loop (3 steps)** — the most important below-the-fold section (layout in §4b). Must dispel the obvious worry ("is this another AI wrapper?") by showing **the app verifies, it never generates.** Copy-paste prompt → paste JSON back → strict validation + preview → atomic commit.
5. **What it tracks (the memory model)** — courses → sections → topics, retention curves R(t)=e^(−t/(k·s)), health scores, OCI, due-for-review queue. Show the **Course Dashboard** retention matrix here. This is the intellectual proof.
6. **Exams recalibrate** — a focused band explaining that test events tune each topic's decay rate (k_factor drift), so exams outweigh study sessions *by evidence, not arbitrary weights.* Differentiator vs. every flashcard app.
7. **Privacy, as a feature not a footnote** — "No accounts. No backend. No network requests. Your data is one JSON file in your browser." Export/import. The only external actor is the AI *you* choose. This is where "no accounts" flips from apparent gap to selling point.
8. **Choose your way in (Download vs Open)** — a two-card band that makes the CTA choice effortless and states the no-sync truth. Repeats both CTAs. (Copy in §6.)
9. **Quiet closer** — one line, wordmark, both CTAs a final time, honest one-line footer (version, "no trackers on this page either").

CTAs repeat at: top bar (Open), hero (both), §8 (both), closer (both). Never a sticky nag bar.

---

## 4. Concrete layouts

Spacing uses your `--space-*` tokens (2,4,6,8,12,16,20,24,28,32,40,48,56,64). Content column `--content-max: 1180px`. Breakpoints at **768px** and **720px** as in the app.

### 4a. Hero

- **Grid:** 12-col, `--content-max` centred, `gap: var(--space-9)` (28px). Text occupies cols 1–5, product screenshot cols 6–12. **Asymmetric, left-weighted — deliberately NOT centered-everything.**
- **Vertical rhythm:** section padding `var(--space-14)` (64px) top, `var(--space-13)` (56px) bottom.
- **Type hierarchy:**
  - Eyebrow: `--fs-eyebrow` (12px), uppercase, weight 700, `letter-spacing: 0.07em`, `--ink-muted`.
  - Headline: `--fs-hero` (76px), weight 700, `letter-spacing: -0.02em`, `line-height: 1.2`, `--ink`. Clamp to ~`clamp(40px, 8vw, 76px)` below 768px.
  - Subhead: `--fs-prop` (22px) or `--fs-section` (19px), `--ink-secondary`, max ~46ch.
  - **Any measured number in the headline/subhead set in `.mono-num`** (`--font-mono`, `tabular-nums`, `letter-spacing:0`).
- **CTA row:** gap `var(--space-4)` (8px). Primary `.btn-primary` = "Open the app"; secondary `.btn-secondary` = "Download for desktop." Microcopy line beneath at `--fs-secondary` (13.5px), `--ink-muted`.
- **Screenshot:** the **Overview** screen in a `.card` (`--surface`, `--radius-lg` 20px, `--shadow-hero` reserved for this one hero moment, `inset 0 1px 0 var(--edge)`), cropped to the greeting + hero **progress ring** + "Due for review" card. Slight raise on load via `.reveal`.
- **Responsive:** at ≤768px, stack to one column (text over image), headline clamps down, screenshot goes full-width and crops tighter to just the ring + one due-row. At ≤720px, drop the eyebrow's letter-spacing slightly and reduce section padding to `--space-12` (48px).

```
┌───────────────────────────────────────────────── 1180px ─────────────────────────────────────────────────┐
│  Cairn                          How it works   Privacy   [☾]        [ Open the app ]                         │  top bar
├────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                              │
│  A MEMORY FOR SELF-STUDY                        ┌───────────────────── Overview (real screen) ─────────────┐ │
│                                                 │  Good morning.                                            │ │
│  Your AI can teach you                          │  Here's what needs your attention.                        │ │
│  anything. It just can't                        │                                                           │ │
│  remember you learned it.                        │        ╭───────╮        Due for review                    │ │
│  ── 76px / -0.02em / w700                        │        │  82   │        · Bayes' theorem   41%           │ │
│                                                 │        │ /100  │        · Eigenvectors     53%           │ │
│  Cairn gives your studying a                     │        ╰───────╯        · Krebs cycle      58%           │ │
│  retention curve and a review                    │      course health      (.mono-num percentages)          │ │
│  schedule — on your machine,                     │        (HeroRing)                                         │ │
│  in a file you own.  ── 19px --ink-secondary     └───────────────────────────────────────────────────────────┘ │
│                                                        ▲ .card + --shadow-hero + inset edge                  │
│  [ Open the app ]   [ Download for desktop ]                                                                 │
│  No account — nothing to log into. Runs in your browser.                                                     │
│                                                                                                              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4b. "How it works — the BYO-AI loop" (most important below-the-fold section)

- **Grid:** three equal cards, 12-col → 4/4/4, `gap: var(--space-7)` (20px). Section max `--content-max`. Section padding `var(--space-13)` (56px) vertical.
- **Section header:** eyebrow "HOW IT WORKS" (`--fs-eyebrow`), then a `--fs-title` (32px, w700, -0.02em) line: "You bring the AI. Cairn brings the memory."
- **Each step card:** `.card` (`--surface`, `--radius-lg`, `--shadow-card`, `inset 0 1px 0 var(--edge)`), padding `var(--space-9)` (28px). A small step numeral in `.mono-num` at `--fs-prop` (22px) `--accent`; step title at `--fs-section` (19px, w700); body at `--fs-body` (15px) `--ink-secondary`. Card 1 shows a mono prompt block; card 2 shows a paste-back field; card 3 shows a validation preview with a green `--success` "committed" `Tag`.
- **Reveal:** stagger with `--i: 0,1,2` and `--reveal-step` (70ms) so the three cards cascade.
- **Hover:** raise to `--shadow-card-hover` over `--dur-standard` (0.25s) with `--ease`.
- **Responsive:** at ≤768px collapse to a single column; the three steps become a vertical numbered sequence, `gap: var(--space-6)` (16px). At ≤720px reduce card padding to `--space-7` (20px).

```
                              HOW IT WORKS
              You bring the AI. Cairn brings the memory.

┌───────────────── ┐   ┌───────────────── ┐   ┌───────────────── ┐
│ 01               │   │ 02               │   │ 03               │
│ Copy the prompt  │   │ Paste the JSON   │   │ Preview & commit │
│                  │   │  back            │   │                  │
│ ┌──────────────┐ │   │ ┌──────────────┐ │   │  syllabus.json   │
│ │ mono prompt  │ │   │ │ { "course":  │ │   │  ✓ 4 sections    │
│ │ text …  [copy]│ │   │ │  "…" } paste │ │   │  ✓ 22 topics     │
│ └──────────────┘ │   │ └──────────────┘ │   │  [ Tag: ok ]     │
│                  │   │                  │   │  atomic commit   │
│ Give it to your  │   │ Strictly         │   │ Nothing saved    │
│ own AI with your │   │ validated —      │   │ until you say so.│
│ syllabus.        │   │ bad fields fail  │   │                  │
│                  │   │ loudly.          │   │                  │
└───────────────── ┘   └───────────────── ┘   └───────────────── ┘
   .card --i:0            .card --i:1            .card --i:2
   (stagger 70ms via --reveal-step; hover → --shadow-card-hover)
```

---

## 5. Visual-direction spec (in the app's own token vocabulary)

**Type ramp on the page.** Hero `--fs-hero` (76px); section titles `--fs-title` (32px); section headers `--fs-section` (19px); body `--fs-body` (15px); supporting `--fs-secondary` (13.5px); eyebrows `--fs-eyebrow` (12px). Body carries `letter-spacing: -0.006em` and `font-feature-settings: 'cv05','cv08','ss01','tnum' 0`; headings h1–h4 weight 700, `-0.02em`, `line-height: 1.2`. **The non-negotiable rule:** every number that represents a measured value — retention %, health 0–100, streak days, deltas — is set in `.mono-num` (`--font-mono`, `tabular-nums`, `letter-spacing: 0`). This is the app's stated "single most important typographic decision" and the landing page lives or dies on honouring it: real percentages in the hero screenshot and the step cards must be mono.

**Colour usage.** Restrained neutral canvas, one blue accent. `--ink` for headlines, `--ink-secondary` for body, `--ink-muted` for eyebrows/microcopy. Accent `--accent` (#0062c6 light / #0a84ff dark) only on the primary CTA, links, the hero ring, and step numerals. `--success`/`--warning`/`--danger` appear **only inside real UI** (a green committed tag, a red validation-fail line) — never as decorative brand colour. **Do not build a gradient hero:** `--accent-2` (#5e5ce6) and `--accent-gradient` exist but must stay incidental — at most a single quiet corner "bloom" behind the hero ring, never a full mesh/blob background. The canvas is never flat but never loud: reuse the `body` treatment — two soft radial washes `--wash-1` at 12% -8% and `--wash-2` at 102% 4% over `--bg-page`, `background-attachment: fixed`.

**Surface / shadow.** All cards use the "liquid glass" material: `background: var(--surface)` (0.75-alpha), `--radius-lg` (20px), `box-shadow: var(--shadow-card), inset 0 1px 0 var(--edge)` — **the inset top edge is the material cue and is not optional.** Hover raises to `--shadow-card-hover`. Reserve `--shadow-hero` for exactly one element on the page — the hero screenshot (mirroring the app's "exactly one hero per screen" rule). **Critical performance rule inherited from the app: do NOT use `backdrop-filter` on page cards, the top bar, or any scroll-region** — re-blurring the background every frame dropped the app from ~53 FPS to ~13 FPS. The 0.75-alpha surface already reads as glass. The only place heavy blur is allowed is a faithful command-palette mock (`blur(48px) saturate(200%)`) if you feature it as a static, non-scrolling visual.

**Radius nesting.** Outer always larger than inner: `.card` at `--radius-lg` (20px) contains chips at `--radius-chip` (6px), inputs at `--radius-sm` (10px)/`--radius-md` (14px); pill CTAs at `--radius-pill` (980px).

**Button styles.** Primary `.btn-primary` (filled `--accent`, white ink, `--radius-pill`); secondary `.btn-secondary` (surface + `--border-strong`, `--ink`). Both get the app's `:focus-visible` treatment — `outline: 2px solid var(--accent); outline-offset: 2px; box-shadow: 0 0 0 4px var(--accent-soft)` — on *every* interactive element, no exceptions.

**Light/dark.** Driven by `data-theme` written before first paint by the inline script (no FOUC). Dark flips to `--bg-page: #000`, `--surface: rgba(30,30,32,0.55)`, `--accent: #0a84ff`, `--ink: #f5f5f7`. Theme transition over `--dur-theme` (0.4s). Ship both; the toggle lives in the top bar.

**Motion.** Reuse the `.reveal` pattern verbatim: `.reveal { opacity:0; transform: translateY(14px) }` → `body.loaded .reveal { opacity:1; transform:none; transition-delay: calc(var(--i,0) * var(--reveal-step)) }`. Easing `--ease` for standard, `--spring` for the ring count-up. Durations from the token set (`--dur-reveal` 0.6s for reveals, `--dur-data` 0.9s / `--dur-draw` 1.1s for the ring/bars). The "live" pulse language (`pulseRing` expanding an `--accent-ring` shadow, the `pulse-dot`) can mark the "Retrievable now" element. **`prefers-reduced-motion` is a hard gate:** durations to 0.01ms, `.reveal` forced visible, bars snapped to final width — reduced motion must never hide content.

---

## 6. Sample marketing copy (calm, precise, honest)

**Headline options (pick one):**
1. "Your AI can teach you anything. It just can't remember you learned it." *(recommended — names the exact gap)*
2. "A memory and a review schedule for the studying you already do with AI."
3. "You study with AI. Cairn remembers what you knew, and when to see it again."
4. "The part your AI tutor forgets: what to review, and when."

**Subhead:** "Cairn tracks your courses, sections, and topics on a real retention curve — so you always know what's fading and what's due. It runs on your machine, stores everything in one file you own, and never calls an AI itself. You bring the AI; Cairn keeps the memory."

**Section headers:**
- Problem: "Studying with AI has no memory."
- How it works: "You bring the AI. Cairn brings the memory."
- Memory model: "It tracks how well you know things — and how that fades."
- Exams: "Exams don't count more because we say so. They count more because they're evidence."
- Privacy: "No accounts. No backend. No network. Just your file."
- Choose: "Two ways in. Same app. Your data stays where you put it."

**CTA labels:** Primary "Open the app". Secondary "Download for desktop".

**Microcopy under the CTAs:**
- Under "Open the app": "Runs in your browser. No account — there's nothing to log into, by design. Your data lives in this browser."
- Under "Download for desktop": "A native build for macOS/Windows. Your data lives in a file on your disk. Works fully offline."
- Shared honesty line for §8: "The two don't sync — there's no server between them. Export a JSON bundle from one and import it into the other whenever you like."

**"How it works" three-step sequence (BYO-AI):**
1. **Copy the prompt.** "Cairn hands you a ready-made prompt. Paste it into whatever AI you already use, along with your syllabus, session notes, or exam paper."
2. **Paste the result back.** "Paste the AI's JSON into Cairn. It's checked against a strict schema — no extra fields, no invented dates. If something's wrong, you get a plain-English message naming the field and the fix."
3. **Preview, then commit.** "See exactly what will change. Nothing is saved until you say so — then it's written in one atomic step. Cairn verifies; it never generates."

**Privacy block body:** "Cairn makes no network requests. There are no accounts, no telemetry, no backend to breach. Everything you track is a single JSON document in your browser's storage. Settings → Export gives you the whole thing; import validates it just as strictly as a fresh paste. The only outside party that ever sees your material is the AI you choose to paste into — and that's your call, not ours."

---

## 7. Hero-visual options (real screens, ranked)

**1. Overview — feature in the hero.** It's the screen that shows the *payoff* in one glance: the greeting ("Good morning."), the hero progress **ring** (course health 0–100 with count-up), and the "Due for review" card with real decayed-topic percentages. It reads instantly as "here's what needs your attention" — which is the whole pitch. **Crop:** greeting + ring + the top two or three due-rows; let the four-up props row and activity feed fall off the bottom edge (implying depth without clutter). Frame in a `.card` with `--shadow-hero`. **Important:** because the real Overview includes a "Work logged" prop from the removed domains, **crop it out or relabel** — the page must show Study/Exams only, never "Work logged."

**2. Course Dashboard — feature in the memory-model section (§5).** The retention matrix (sections with retention bars + dots + diagnostic badges), the "Avg retention" hero stat with sparkline and 30-day delta, and the 90-day activity heatmap are the strongest *proof* visuals. **Crop:** the "Avg retention" stat + a few RetentionRows of the matrix; show one `HealthChip` and one `DeltaChip` so the `.mono-num` discipline is visible. Use `--shadow-card` (not hero — save hero for the Overview).

**3. Paste-JSON validation flow — feature in the "How it works" step 3 card.** A tight crop of the preview + a green `--success` "committed" `Tag`, or a red validation-fail line ("An em-dash is not an answer."). This is the trust-builder; keep it small and literal.

**4. Command palette (⌘K glass HUD) — feature as a small accent, or skip.** Lovely but peripheral to the pitch. If used, show it as a static, non-scrolling mock so the heavy `blur(48px)` is safe. Don't lead with it.

**Framing rules for all screenshots:** real UI only (no lorem numbers — use the app's actual derived values), `--radius-lg` corners, `inset 0 1px 0 var(--edge)`, no floating disconnected fragments, no fake bento. One hero shadow on the page, total.

---

## Recommendations (staged, with thresholds)

1. **Lock the name.** Take **Cairn** to formal trademark clearance (edtech/software classes) and secure a `try-`/`get-`/`.app` domain. **Threshold to switch:** if clearance surfaces any *study/edtech* Cairn, or the domain path is unworkable, fall back to **Sediment** (cleanest) or clear **Ebb** against `ebb.cool` first.
2. **Build the page on the app's tokens first; add libraries only when CSS can't do it.** Ship with just Fontsource (self-hosted Inter + JetBrains Mono) + Lucide. **Threshold to add Motion:** only if the hand-rolled `.reveal` can't deliver the ring count-up you want — then add `m`+`LazyMotion` (~4.6 KB), token-driven. **Threshold to add Base UI:** only when you need ≥2 real interactive primitives; a lone dialog → use native `<dialog>`.
3. **Ship both CTAs day one**, primary "Open the app," and put the no-sync sentence on the page in plain sight. **Threshold to flip primary to Download:** if analytics-free feedback shows web users losing data to cleared browser storage, elevate "Download for desktop" and add an explicit "export often" nudge in the web app's own UI.
4. **Never regress the performance lesson:** no `backdrop-filter` on scroll regions; one `--shadow-hero` per page. Re-verify scroll FPS on a mid-tier laptop before launch (target ≥50 FPS).
5. **Audit copy for hype before publish:** no "supercharge/unlock/revolutionize," no emoji feature icons, no gradient-blob hero. If a line couldn't appear inside the app's own UI voice ("An em-dash is not an answer."), cut it.

## Caveats
- **Naming clearance here is a practical scan, not legal clearance.** `.com` availability statements are inferences (short dictionary words are effectively always registered). Verify WHOIS + USPTO/EUIPO before committing to any name.
- **Bundle-size figures are current-as-of-2026 secondary sources** (Motion's own docs for the ~4.6 KB / 2.3 KB numbers; Lucide's v1.0 release notes for the "11.4 MB → ~1 MB gzipped, −32.3%" figure; vendor docs/PkgPulse for the rest) and vary with exact version and what you import; re-check against your final lockfile.
- **GSAP's "free" status is a Webflow-owned, revocable license, not OSI open-source** — a reason beyond weight to avoid it for a product whose whole ethos is "own your stuff."
- **Base UI reached stable v1.0.0 only in December 2025;** it's young. If you hit a gap, Radix remains a safe (if slower-maintained) fallback that styles identically under your tokens.
- The app's README still names removed "Fitness"/"Jobs" domains and the Overview has a "Work logged" prop — **make sure no screenshot or copy leaks those**; crop/relabel every captured screen to Study + Exams only.