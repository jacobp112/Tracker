# UI & Design System Specification
**Document 3 of 4 — Project: [Working Title] Personal Tracker**
**Status:** Draft v0.4 — corrects the §5.1 Overview hierarchy
**Depends on:** Document 1 (Data & Schema Spec), Document 2 (Math & Algorithms Spec)
**Referenced by:** Product Spec / User Stories

---

## 0.0 Changelog — v0.4 (Overview hierarchy)

v0.3 re-based this document on `mockups/studyos-notion-apple.html` and made it the visual source of truth. That remains the case — v0.4 changes no visual language.

1. **Corrected: §5.1 Overview hierarchy.** v0.3's §5.1 already specified the course-health ring as "the single most prominent number," but left the hero treatment ambiguous enough that a build could apply the §3 hero-stat card (bloom + `--shadow-hero`) to more than one card per screen, contradicting §3's "one per screen, maximum." §5.1 is tightened below: the health ring **is** Overview's hero stat, and "Due for review" is a plain Card. This is a correction of an under-specification, not a new rule.

2. **Clarified: the props row is column-count-driven** (§3, §5.1). The 4-column figure in §3 described the *dashboard's* props row, and a build read it as the component's fixed arity — rendering Overview's three tiles into a four-column grid with a dead cell. The column count follows the content.

### Withdrawn before build

A **Decay horizon** scrubber (a control that advanced the derivation clock to project the matrix forward) was specified here and built, then **withdrawn by product decision** — it did not earn its place on the primary surface. Recorded so it is not silently re-proposed: the idea is cheap to rebuild if ever wanted, since the engine is pure over `now` and needs no new math to support it. It is not in v1.

---

## 0. Purpose of this document

This document defines the design system (tokens, components) and the screen-by-screen layout of the app. It exists so that whoever builds the front end produces something that feels intentional and cohesive — not a bag of default Tailwind/Material components. Every screen references data from Document 1 and math from Document 2; this document says how that data is *shown*, never how it's computed.

**Non-negotiable product principle (carry into every screen):** zero setup cost. The user never builds a schema, configures a database, or learns a query language. They pick a pre-built tracker type and paste AI-generated JSON. Any screen that violates this — that asks the user to configure structure before they can use it — is wrong by definition. This is a hard non-functional requirement, restated in Document 4 as an acceptance criterion.

### 0.1 Changelog — v0.3 (mockup re-base)

`mockups/studyos-notion-apple.html` is an **approved mockup and is now the visual source of truth** for this document. Where the v0.2 text and the mockup disagreed, the mockup won, by explicit product decision. The following v0.2 rules are **withdrawn** and must not be implemented:

1. **The `#4C6EF5` single-accent palette and the "accent discipline" rule** (accent never appears in data viz). Withdrawn. The palette is now Apple-blue `#0071E3` with a secondary indigo `#5E5CE6`, and the accent hue *is* used in data viz (the activity ramp). See §2.1.
2. **The 5-band fill/ink retention scale.** Withdrawn. Retention is now encoded on a 3-stop semantic traffic light (success/warning/danger), and study activity on a 5-step blue sequential ramp. See §2.2.
3. **`IBM Plex Mono` / `Inter Tight`.** Withdrawn — the type system is Inter + JetBrains Mono. See §2.4.
4. **Radius scale 8/12/16.** Withdrawn → 10/14/20, nested (outer always larger than inner). See §2.5.
5. **"No decorative ambient animation."** Withdrawn. Ambient motion (the looping `live-pulse` ring on live indicators) is permitted as a liveness cue. See §2.6.
6. **The per-topic retention heatmap** (topics grouped by section, R% drawn in-cell, behind a Heatmap/List segmented control). Withdrawn as the primary retention surface — replaced by the mockup's **Retention matrix** (grouped rows with bars) plus a 90-day **study-activity calendar**. See §5.2. *Document 4 E4-S2/E4-S3 are re-written to match; that change is made in Document 4 v0.2.*

**What did not change:** the accessibility floor (§6) is unaffected. In particular "colour is never the only signal" still holds and the mockup already satisfies it — every retention row carries its `%` in text plus a status dot and, where relevant, a badge. The traffic-light ramp is not required to survive a deuteranopia check *on its own* precisely because the number is always present.

---

## 1. Design direction & rationale

The reference points are Notion (calm, modular, content-first, block-based) and iOS (card surfaces, soft depth, native-feeling controls, restrained motion). The synthesis: **a calm data-dense workspace where the numbers are the visual interest.** The decay heatmap and retention curves *are* the personality of this product — so the chrome around them stays quiet and lets the data carry the color.

**Explicitly avoided** (these are current AI-design defaults and would make the product feel generic): warm-cream background with a terracotta/clay accent; near-black background with a single acid accent; broadsheet layout with hairline rules and zero border-radius. If a proposed screen drifts toward any of these, it's a tell that a default was reached for instead of a choice.

---

## 2. Design tokens

These are literal values. The build uses them as named tokens (CSS custom properties / a theme object), never as inline literals scattered through components.

### 2.1 Color — light theme

| Token | Value | Use |
|---|---|---|
| `--bg-page` | `#F5F5F7` | app background |
| `--bg-sidebar` | `rgba(251,251,250,0.55)` | sidebar/topbar — translucent, sits under a backdrop blur |
| `--surface` | `#FFFFFF` | cards, panels |
| `--surface-sunken` | `#FAFAFA` | nested/inset surfaces, row hover |
| `--border` | `rgba(0,0,0,0.07)` | 1px hairlines, card borders |
| `--border-strong` | `rgba(0,0,0,0.13)` | emphasised hairlines, dashed affordances |
| `--edge` | `rgba(255,255,255,0.85)` | **the light-catching top edge** — `inset 0 1px 0` on every card. This is the "material" cue |
| `--edge-strong` | `rgba(255,255,255,1)` | same, on raised surfaces |
| `--ink` | `#1D1D1F` | headings, primary text |
| `--ink-secondary` | `#6E6E73` | secondary labels |
| `--ink-muted` | `#A1A1A6` | captions, timestamps |
| `--accent` | `#0071E3` | primary interactive |
| `--accent-2` | `#5E5CE6` | secondary accent — gradient partner, never used alone |
| `--accent-soft` | `#EAF2FE` | accent tint fills (active nav, chips) |
| `--accent-ring` | `rgba(0,113,227,.35)` | focus/pulse ring |
| `--track` | `#ECECEC` | progress/bar tracks |

**Page wash:** the canvas is not flat. Two radial gradients sit over `--bg-page` — `--wash-1: rgba(0,113,227,0.055)` at `12% -8%` and `--wash-2: rgba(94,92,230,0.05)` at `102% 4%`. This is what stops the background reading as dead grey.

**Accent usage:** `--accent` marks interactivity, and — unlike v0.2 — is also the hue of the activity ramp (§2.2). The primary button is a gradient `linear-gradient(135deg,#0080ff,#5e5ce6)`; gradients are reserved for the primary action and the course icon.

### 2.2 Color — data viz

Two distinct scales. They do not mix.

**(a) Retention / health / mastery → 3-stop semantic traffic light.** Keyed to a 0–100 value (retention % from Document 2 §2, health from §6). Each stop is a saturated ink + a soft fill; ink is used for the bar fill, dot, and number, fill for tag backgrounds.

| Stop | Ink (light) | Soft (light) | Ink (dark) | Soft (dark) | Band |
|---|---|---|---|---|---|
| `success` | `#1D7A3A` | `#E9F6EC` | `#4FD07A` | `rgba(48,160,90,0.18)` | health > 70 / retention ≥ 85 |
| `warning` | `#8F5A00` | `#FBF1DE` | `#F0B03E` | `rgba(180,120,20,0.20)` | health 40–70 / retention 40–84 |
| `danger` | `#C0362A` | `#FBEBE9` | `#FF6A5C` | `rgba(200,60,50,0.20)` | health < 40 / retention < 40 |

The review-due threshold `DUE_THRESHOLD` (70%, Document 2 §1) is drawn on the topic-detail curve as a dashed threshold line (§5.3). Not-started topics render as `—`, never `0%`, using `--ink-muted`.

**(b) Study activity → 5-step blue sequential ramp.** Volume of study sessions per day, not retention. This is the accent hue used deliberately as data.

| Step | Light | Dark |
|---|---|---|
| `--cell-0` (none) | `#EEF0F2` | `#212123` |
| `--cell-1` | `#CFE2FB` | `#1E3A5F` |
| `--cell-2` | `#8EC0F6` | `#1F5AA8` |
| `--cell-3` | `#4A97EF` | `#1878E0` |
| `--cell-4` (most) | `#0071E3` | `#0A84FF` |

### 2.3 Dark theme

Full dark theme is **v1 scope**, and is resolved **before first paint** via an inline script reading `localStorage['studyos-theme']` with a `prefers-color-scheme` fallback — no FOUC. Same token names, remapped:

`--bg-page: #0A0A0C`, `--bg-sidebar: rgba(28,28,30,0.55)`, `--surface: #1C1C1E`, `--surface-sunken: #161618`, `--border: rgba(255,255,255,0.09)`, `--border-strong: rgba(255,255,255,0.17)`, `--edge: rgba(255,255,255,0.06)`, `--edge-strong: rgba(255,255,255,0.10)`, `--ink: #F5F5F7`, `--ink-secondary: #A1A1A6`, `--ink-muted: #6E6E73`, `--accent: #0A84FF`, `--accent-2: #7D7AFF`, `--accent-soft: rgba(10,132,255,0.16)`, `--track: #3A3A3C`.

Note the `--edge` inversion: on light it's a near-white highlight, on dark a faint 6% white. The token name stays; the material cue survives the theme flip.

### 2.4 Typography

| Role | Family | Notes |
|---|---|---|
| Display / headings / body | **Inter** (fallback `-apple-system, BlinkMacSystemFont`) | weights 400–800; the whole UI. Tracking `-0.006em` body, tightening to `-0.025em` on the 32px page title and `-0.04em` on the 76px hero number |
| Numeric / data | **JetBrains Mono** | tabular figures for all measured values |

Inter is loaded with `font-feature-settings:"cv05","cv08","ss01"`.

**Rule (unchanged from v0.2):** every number representing a measured value (retention %, score, weight, pace, velocity) is set in the mono/tabular face. This is the single most important typographic decision — it's what makes a data app feel precise rather than casual.

Observed scale (px): hero `76` / page title `32` / section title `19` / prop value `22` / body `14.5` / secondary `13.5` / caption `12.5` / eyebrow `12` / micro `10–11`. Eyebrows are uppercase, `600`, `letter-spacing: 0.05–0.06em`.

### 2.5 Spacing, radius, elevation

- Spacing: the mockup's rhythm is `2 / 3 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 26 / 28 / 36`px. Card padding `22–28px`, grid gaps `20px`, content padding `28px 36px`.
- **Radius — nested rule: outer is always larger than inner.** `--radius-lg: 20px` (cards, modals), `--radius-md: 14px`, `--radius-sm: 10px` (inputs, chips). Small chips/tags use `5–8px`; pills/buttons use `980px`. Never `0px`.
- Elevation — three levels, each paired with the `inset 0 1px 0 var(--edge)` top highlight:
  - `--shadow-card: 0 1px 2px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.06)`
  - `--shadow-card-hover: 0 2px 4px rgba(0,0,0,0.05), 0 18px 44px rgba(0,0,0,0.10)`
  - `--shadow-hero: 0 1px 2px rgba(0,113,227,0.06), 0 22px 46px rgba(0,113,227,0.13), 0 4px 14px rgba(0,0,0,0.04)` — a *tinted* shadow, for the hero card only.

### 2.6 Motion

- Easing: `--ease: cubic-bezier(.2,.8,.2,1)` (standard) and `--spring: cubic-bezier(.34,1.56,.64,1)` (overshoot — icon-button press, heatmap cell hover).
- Durations: `.1–.15s` micro (hover, row action), `.2–.3s` standard, `.4s` theme crossfade, `.6s` reveal, `.9–1.1s` data entrances (bar growth, sparkline draw-on, count-up).
- **Orchestrated entrance:** `body.loaded .reveal` with `transition-delay: calc(var(--i) * 70ms)` — a staggered cascade, index set per block.
- **Ambient motion is permitted** (this is the v0.2 reversal): `live-pulse` is a 2.4s infinite `pulseRing` keyframe on live indicators (due-review dot, next-review marker), signalling "this is live data."
- **`prefers-reduced-motion` is respected — hard requirement, unchanged.** Under reduce: all transitions off, `live-pulse`/`pulse-dot` animations off, `.reveal` forced visible, bars jump straight to `--w`, count-up prints the final value. Reduced-motion is never allowed to leave content hidden.

---

## 3. Component library (shared primitives)

Defined once, reused everywhere. The builder does not invent per-screen variants.

- **Card** — `--surface`, `--radius-lg`, `--shadow-card` **+ `inset 0 1px 0 var(--edge)`**. The inset top edge is not optional; it is the material cue that makes the surface read as a physical panel rather than a div. Hover raises to `--shadow-card-hover`.
- **Hero stat** — the outsized figure (76px mono, `-0.04em`) + eyebrow + delta chip + an embedded chart, on `--shadow-hero` with a soft radial bloom in the top-right corner (`::before`, 260px circle, accent→accent-2 radial). One per screen, maximum.
- **Delta chip** — `▲ 4pts` in mono on a `success-soft`/`danger-soft` fill, `6px` radius.
- **Props row** — a single card subdivided into 4 equal columns by `1px` internal borders (not 4 separate cards). Each column: icon + uppercase eyebrow, `22px` mono value, caption. Hover fills `--surface-sunken`. Collapses 4→2 columns under 920px.
- **Retention row** — the atom of the Retention matrix (§5.2): status dot + topic name + optional badge on the left; `110px` bar track + `%` in mono + a hover-revealed "Review →" action on the right. Bar and dot both encode the same value; the `%` is always present in text, which is what satisfies the colour-independence rule (§6).
- **Segmented control** — iOS-style, for switching views. Selected segment uses `--accent`.
- **Status pill** — for the four-state ladder `Not Started / Learning / Practising / Mastered` (Document 2 §7). Mastered = success, Practising = accent-soft tint, Learning = warning, Not Started = neutral grey.
- **Health chip** — a compact chip showing the 0–100 health score (Document 2 §6), coloured by the three §2.2(a) stops. Shown only for Practising/Mastered topics.
- **Diagnostic badge** (`.tag`) — small uppercase pills for the qualitative flags (Slow growth, Boredom zone, Brittle fluency, Under-carded, Ready to test — Document 2 §8), tinted by severity via the §2.2(a) soft fills. `11px`, `600`, `6px` radius.
- **Calibration indicator** — the OCI reading (Document 2 §5) as a signed mono value plus a plain-language caption: "Overconfident / Stable / Underconfident".
- **Activity calendar** — 13-column CSS grid of `3px`-radius cells on the §2.2(b) blue ramp, with a Less→More legend and month labels. Cells scale `1.18` on hover via `--spring` and expose their date + session count.
- **Progress ring** — ring for course completion %, section completion.
- **Data table** — for review history, exam breakdowns, lift logs. Header on `--surface-sunken`, generous row height (44px min, iOS touch target), numbers right-aligned in mono.
- **Timeline / plan item** — connected markers down a `1px` rail for the upcoming review plan; the active marker carries `live-pulse`.
- **Sheet / modal** — bottom-sheet on mobile, centered modal on desktop, `--radius-lg`, raised elevation, backdrop blur.
- **Empty state** — every list/screen has one. Per the writing rules (§7): it says what to do next, never just "No data." e.g. "Paste your first study session to start tracking retention."
- **Toast** — action confirmations. Verb matches the action ("Session added," not "Success").
- **Paste-and-validate input** — the core ingestion component (§5.6). A large textarea + validate button + inline structured error display.

---

## 4. Global layout & navigation

```
┌──────────────────────────────────────────────────────────┐
│  SIDEBAR (desktop)          │   MAIN CONTENT              │
│  ┌───────────────────────┐  │                            │
│  │  [App mark]           │  │   [ Active screen ]        │
│  │                       │  │                            │
│  │  ○ Overview           │  │                            │
│  │  ○ Study        ▸     │  │                            │
│  │      Calculus I       │  │                            │
│  │      Organic Chem     │  │                            │
│  │  ○ Fitness      ▸     │  │                            │
│  │      Running          │  │                            │
│  │      Lifting          │  │                            │
│  │  ○ Exams              │  │                            │
│  │                       │  │                            │
│  │  ⊕ Add tracker        │  │                            │
│  │  ⚙ Settings           │  │                            │
│  └───────────────────────┘  │                            │
└──────────────────────────────────────────────────────────┘
```

- **Desktop:** persistent left sidebar (Notion-like), collapsible. Domains expand to list individual courses/activities.
- **Mobile:** sidebar collapses to a bottom tab bar (iOS-native pattern): Overview / Study / Fitness / Exams / Settings. Individual courses reached by drilling in.
- **Add tracker** (`⊕`) opens the tracker-type picker — the zero-setup entry point: pick "Study course," "Running," or "Lifting," and for study it immediately surfaces the copy-the-AI-prompt flow (§5.6).

---

## 5. Screen specifications

### 5.1 Overview (cross-domain home)

The only screen that spans all domains. Answers "what should I do today?" at a glance.

```
┌────────────────────────────────────────────────┐
│  Good evening.            [ ▚ light/dark ]      │
│                                                 │
│  ┌── Due for review ──────────────────────────┐ │
│  │ 3 topics decayed below 80%                 │ │
│  │ • Epsilon-delta limits    [72%] Calculus I │ │
│  │ • SN2 mechanisms          [64%] Org Chem   │ │
│  │ • Chain rule              [79%] Calculus I │ │
│  │                          [ Review now → ]  │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  ┌─ Study streak ─┐ ┌─ This week ─┐ ┌─ Next ──┐ │
│  │   6 days       │ │ 4 sessions  │ │ exam in │ │
│  │   🔥           │ │ 3.5 hrs     │ │ 4 days  │ │
│  └────────────────┘ └─────────────┘ └─────────┘ │
│                                                 │
│  ┌── Recent activity ─────────────────────────┐ │
│  │ (unified event feed: sessions, exams, runs)│ │
│  └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

- "Due for review" pulls from every course's topics whose live retention is below `DUE_THRESHOLD` (70%, Document 2 §2), sorted most-decayed first, with section spreading applied (Document 2 §11). Each row shows a retention pill (§2.2 colour).
- **Hierarchy (tightened in v0.4 — see §0.0 item 2).** The **course-health ring is Overview's hero stat** and takes the §3 hero treatment (`--shadow-hero` + corner bloom), carrying the ring plus its score as an outsized figure. "Due for review" is a **plain Card** — it is the densest block on the screen but not the loudest. Exactly one hero-stat card exists per screen (§3); a build that blooms both cards is non-compliant, and one that blooms neither has no focal point.
- Stat tiles: study streak, weekly volume, and **overall mastery** (mastered topics ÷ all topics across every course). These are a **props row** (§3) — one card subdivided by internal borders, *not* separate cards, and **not** the 4-column dashboard variant left with a dead cell. The props row is column-count-driven: three tiles means three equal columns. *(v0.4: the "next upcoming exam" tile is withdrawn — an Exam in Document 1 §4 is a **completed result** carrying a score, not a scheduled event, so a countdown to a future exam is uncomputable in v1. Scheduled exams are not in scope, Document 4 §13. Overall mastery replaces it: it is computable, cross-domain, and answers "am I making progress" at a glance.)* A hero **Course health** ring (the mean of active-topic health scores across all courses, Document 2 §6) is the single most prominent number.
- Recent activity is the unified event feed — sessions, tests/exams, runs, and lifts as one chronological stream.

### 5.2 Study — Course dashboard (the primary surface)

This is the screen with the most math surfaced. Layout per the approved mockup (`mockups/studyos-notion-apple.html`) — **top to bottom, single column**, no Heatmap/List segmented control (withdrawn in v0.3, see §0.1).

```
┌──────────────────────────────────────────────────────┐
│  Courses › Advanced Theory            ← breadcrumb    │
│  Course dashboard                     ← 32px title    │
│  Overview of your progress and retention in …         │
│                                                       │
│  ┌── Avg retention ──────┐ ┌── Study activity ──────┐ │
│  │  64%      ▲ 4pts      │ │  13-col blue calendar  │ │
│  │  ∿ interactive spark  │ │  Less ▫▪▪▪▪ More       │ │
│  │  (goal line, hover)   │ │  Last 90 days          │ │
│  └───────────────────────┘ └────────────────────────┘ │
│         hero (1fr)              activity (1.35fr)     │
│                                                       │
│  ┌─ Health ─┬─ Calibration ─┬─ Due review ─┬─ Proj ─┐ │
│  │    92    │    +0.08      │     12 ●     │ 14–21  │ │
│  │  Optimal │    Stable     │  Review now→ │ Oct win│ │
│  └──────────┴───────────────┴──────────────┴────────┘ │
│                                                       │
│  Retention matrix                                     │
│  Grouped by unit. Bar and dot both encode mastery.    │
│    FUNDAMENTALS                                       │
│    ┌─────────────────────────────────────────────┐   │
│    │ ● Basic syntax          ▬▬▬▬▬▬▬▬  92%  →   │   │
│    │ ● Control flow [SLOW]   ▬▬▬▬▬▬░░  76%  →   │   │
│    └─────────────────────────────────────────────┘   │
│    ADVANCED THEORY                                    │
│    ┌─────────────────────────────────────────────┐   │
│    │ ● Promises   [CRITICAL] ▬▬░░░░░░  25%  →   │   │
│    └─────────────────────────────────────────────┘   │
│                                                       │
│  Upcoming review plan                                 │
│    ◉ Asynchronous JS refresher  [NEXT]     Oct 12    │
│    ○ Promises edge cases                   Oct 14    │
└──────────────────────────────────────────────────────┘
```

- **Hero — Avg retention:** the 76px figure + delta chip + an **interactive sparkline**: a Catmull-Rom-smoothed curve on an `--accent → --accent-2` gradient stroke with a fade fill, a dashed goal line, a pulsing endpoint, and a hover/touch crosshair with a value+date readout. Fixed 45–85 scale so the goal sits near the top. Draws on over 1.1s. The number counts up over 900ms.
- **Study activity:** 90-day calendar, §2.2(b) blue ramp, 13 columns. Volume of sessions, not retention.
- **Props row** (4 columns in one card): Health (Document 2 §6, with a plain-language caption), Calibration (mean OCI, Document 2 §5), Due review (count below `DUE_THRESHOLD`, with a `live-pulse` dot and a "Review now →" action), Projected finish (a **range**, Document 2 §10 — "Not enough data yet" if velocity is undefined, never a fabricated date).
- **Retention matrix:** the primary retention surface (replaces the withdrawn heatmap). Topics grouped by section under uppercase group labels, one card per group, one **retention row** (§3) per topic. Bars grow from 0 to `--w` on load. Rows are `tabindex`-focusable and reveal a "Review →" action on hover/focus. Retention recomputes on every load — a topic silently changes band between visits with no user action.
- **Weak topics:** ordering is applied *within* the matrix rather than as a separate card — but the ranking rule (lowest health first, tie-broken by lowest retention, Document 2 §9) still governs, and badges + active-error counts are shown so the list explains *why* a topic is weak.
- **Upcoming review plan:** a timeline of the next review targets, the first marked `[NEXT]` with a live-pulse marker.

### 5.3 Study — Topic detail (expandable / sheet)

Opens as a sheet (mobile) or side panel (desktop) when a topic is tapped.

```
┌── Algebraic fractions ─────────────────────────┐
│  Algebra · Practising · reviewed 9 days ago     │
│                                                 │
│  37%      50      +0.25     1.3       7.0        │
│  reten.  health  calibr.  strength  decay k     │
│                                                 │
│  ┌── Retention curve ─────────────────────────┐ │
│  │ 100%┐                                       │ │
│  │     ╲____                                   │ │
│  │  70%······╲···············  (threshold)     │ │
│  │           ╲___now●                          │ │
│  └────────────────────────────────────────────┘ │
│                                                 │
│  [ Slow growth ]   ← diagnostic badges          │
│  Review history (3)  ·  Error log (2)           │
└─────────────────────────────────────────────────┘
```

- **Header stats:** retention, health, calibration (OCI), strength, and the topic's tuned decay `k` — the five numbers that define the topic's state (Document 2 §2–6). `k` and strength are surfaced deliberately: they make the self-tuning model legible rather than a black box.
- **Retention curve:** the signature chart — the exponential decay (Document 2 §2) drawn from the last review, a dashed line at the 70% `DUE_THRESHOLD`, and a "now" marker on the current decay point. Draws on load (reduced-motion respected). For a not-yet-reviewed topic it shows a plain "not yet reviewed" state, not an empty axis.
- **Diagnostic badges** (Document 2 §8) shown as labelled pills beneath the curve.
- Review history and error log render as data tables (§3); error entries have resolve toggles that write back to the topic's error list.

### 5.4 Exams

```
┌── Exams ───────────────────────────────────────┐
│                          [ + Add exam result ] │
│  ┌── Midterm 1 ──────── Jul 15 ──── 78/100 ───┐ │
│  │  Covers: Calculus I (2 topics)             │ │
│  │  ┌ Epsilon-delta  18/20 ▲ boosted conf     │ │
│  │  └ Chain rule     12/20 ▼ flagged weak     │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- Each exam card shows its cross-topic reach (Document 1 §4 — may span multiple courses; card groups the breakdown by parent course).
- Per-topic breakdown rows show the effect the exam had — a pass adds strength and can update the tuned `kFactor` via drift (Document 2 §3–4), a fail feeds the error count and calibration. Rows read as "boosted / flagged weak" so the cross-topic effect is legible.
- **error_type chips** use a neutral categorical palette (distinct from the retention scale): `conceptual` indigo-grey, `procedural` slate, `careless` amber-grey, `knowledge_gap` rose-grey. Muted on purpose — these categorize, they don't alarm.

### 5.5 Fitness — Running & Lifting

- **Running:** list of runs + a pace/distance trend chart. `type` (easy/tempo/long/interval/race) shown as chips; trend line can filter by type (pace means different things per type, Document 1 §5.1).
- **Lifting:** grouped by exercise. Per-exercise weight-over-time chart (using per-set data, Document 1 §5.2 — so the chart can plot top-set or estimated-1RM, not just a flat total). Unit toggle kg/lb (display-only conversion; storage stays kg).
- Fitness has **no decay model** (Document 2) — these screens are progression trends only, visually lighter than the study dashboard.

### 5.6 Add tracker / Ingestion flow (the zero-setup core)

This flow is the product's whole premise, so it's specified tightly.

**Study course creation:**
1. User picks "Study course" from the tracker-type picker.
2. App shows the **copy-the-prompt** panel: the exact AI ingestion prompt (Document 1 §8) with a one-tap "Copy prompt" button and a "Paste your syllabus into the prompt, then bring the JSON back here" instruction.
3. User pastes the returned JSON into the **paste-and-validate input** (§3 component).
4. On paste → run the ingestion pipeline (Document 1 §6): parse → schema-validate → integrity-check.
5. **On success:** show a preview ("Calculus I — 3 sections, 14 topics") with a confirm button before committing. Never silently commit.
6. **On failure:** render the structured error list in plain English (field path + what's wrong). *(v0.4: the **Auto-repair** button is removed — auto-repair is deferred and the app makes no AI calls, Document 4 §13.6. The error list is not a consolation prize for lacking a repair button; per §5.6's error-display rule it names the field, states the fix, and for the commonest failure — JSON generated against the withdrawn v0.1 model — tells the user to re-generate with the current prompt.)*
7. A verdict never outlives the text it described: editing the pasted JSON clears any preview or error list, so a user cannot commit a preview built from earlier content.

**End-of-session logging** and **exam entry** use the same paste-and-validate component with their respective schemas and prompts (session prompt lives in Document 4).

**Error display rule:** validation errors are shown in the interface's own voice, translated from raw JSON-Schema output. Not `"instance.sections[0].topics[2].confidence must be <= 100"` but `"Topic 'Chain rule' has a confidence of 105 — it can't be above 100."` This translation layer is a required build task, not a nice-to-have.

---

## 6. Responsive & accessibility floor (hard requirements)

- Fully responsive to a 360px mobile width; sidebar→bottom-tab transform below `768px`.
- All interactive targets ≥ 44×44px (iOS touch standard).
- Visible keyboard focus rings on every interactive element (never `outline: none` without a replacement).
- Color is never the *only* signal: retention is shown as bar colour **and** dot **and** an always-present % number in text; status is chip colour **and** label; activity cells expose their date + session count on hover/focus. The §2.2(a) traffic light is not required to survive a deuteranopia check unaided — the number carries the value independently, which is what discharges this requirement. **If a surface ever shows a retention colour without its number, that surface is non-compliant.**
- All text meets WCAG AA contrast against its background in both themes.
- `prefers-reduced-motion` respected (§2.6).

---

## 7. Copy & voice

Follows the writing principles: plain, active, sentence case, user-side language.

- Name things by what the user controls: "Log session," "Add exam result," "Review now" — never "Ingest event" or "Commit record."
- Buttons keep their verb through the flow: "Log session" → toast "Session logged."
- Empty states direct: "No courses yet. Add one to start tracking retention." not "No data."
- Errors explain and instruct, never apologize or go vague (§5.6 rule).
- Numbers always carry their unit/meaning inline ("72% retention," "2.5 topics/week," "5:00 /km").

---

## 8. Open items for other documents

- Exact end-of-session and auto-repair prompt templates → **Document 4 (Product Spec)**
- Full user stories mapping each screen to acceptance criteria, with DoR/DoD → **Document 4**
- The Topic schema in Document 1 must be synced to the real model (Document 2 v0.2): carry `strength`, `kFactor`, `driftHistory[]`, `reviewHistory[]`, `conf`, `cards`, and error linkage; **drop** the withdrawn `ease_factor` / `memory_strength` fields. Restated here as a cross-doc dependency to resolve before build.

---

## 9. Addendum v0.5 (2026-07-22) — post-v1 UI amendments

Amendments adopted after the v1 build, recorded here per the DoD rule that the
source doc is updated before implementation deviates from it.

1. **Topic status control (Document 2 §7 surfaced).** The topic-detail sheet
   gains a segmented status control (Not started / Learning / Practising /
   Mastered). Status was always learner-set; v0.4 rendered it as a read-only
   pill, leaving mastery, velocity, and the finish projection unreachable.
   The engine's `promote` rules (strength seeding, `mastered_at` stamping) are
   unchanged.
2. **Quick review (one-tap manual review).** The topic-detail sheet gains a
   five-button confidence row that logs a `manual_review` ReviewEvent through
   the standard recalculation path. Document 1 §2.4 always modeled the source;
   this gives it a surface. No AI or network involvement — §13.6 stands.
3. **Quick add (universal paste inbox).** A single `#/add` screen accepts any
   pasted ingestion JSON; the schema is detected from its structural
   discriminators and the standard parse → validate → integrity → preview →
   commit pipeline runs. The per-domain Add screens remain the home of their
   copy-prompts. The shell's "Add tracker" slot is relabelled **Quick add**.
4. **Paste-to-validate.** In every paste-and-validate input, a paste gesture
   triggers validation immediately; the explicit confirm before commit is
   unchanged (§5.6 step 5 intact).
5. **Undo on commit toasts.** Success toasts for paste commits carry a
   single-level Undo action (8s lifetime). Undo restores the exact pre-commit
   store — possible because commits are atomic clone-swaps (E2-S4).
6. **Course dashboard headline.** The page h1 is the course's own title, not
   the words "Course dashboard" (E4-S1 amended).
7. **Jobs domain (post-v1 extension).** Pipeline board, application detail
   sheet, and funnel props-row join §5 as a new screen family; the Overview
   gains a "Coming up" agenda (job next-action dates) and job stage events in
   the activity feed.
