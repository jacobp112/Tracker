# Research Prompt — Elevating the Cairn Landing Page (visual design + motion)

> Paste everything below the line into your research AI. It is self-contained.

---

## Your task

I have a **working but visually basic** marketing landing page for a product called
**Cairn**. It is well-structured and on-brand, but it looks plain — competent, not
impressive. I want to rebuild its *presentation* so it reads as **genuinely, expensively
well-designed**: the calibre of craft you see on Linear, Stripe, Vercel, Family, Arc,
Raycast, Retool, or the personal sites of designers like Rauno Freiberg and Emil
Kowalski.

Conduct **deep design + front-end research** and return an implementable report (format
specified at the end). The output should let a strong front-end engineer rebuild the page
to a premium standard without further research. Favour **specific, concrete, referenced**
findings over generic advice ("use whitespace" is useless; "the hero uses a 1px inset
top-highlight at rgba(255,255,255,.08) plus a 40px-blur radial spotlight that tracks the
cursor at 0.15 lerp" is useful).

## Critical framing: powerful tools, restrained taste

Two things are true at once, and the whole difficulty is holding both:

1. **The technical toolbox is fully open.** The page can be rebuilt in **React** and may
   use **any modern animation/graphics stack** — Framer Motion / Motion, GSAP + ScrollTrigger,
   Lenis smooth scroll, WebGL/canvas (three.js, OGL, react-three-fiber), shaders, SVG
   filters, the CSS scroll-driven-animations API, View Transitions, `@property`, etc.
   "React Bits"-style animated components (reactbits.dev) are explicitly in scope as
   *technique* references.

2. **The aesthetic target is restrained, editorial, and premium — NOT flashy.** The goal
   is *quiet confidence and obvious craft*, not spectacle. Specifically **avoid** the
   generic "AI-startup landing page" look: full-bleed purple gradient-blob/mesh heros,
   rainbow glows, floating 3D blobs, bento-grid feature walls, emoji feature icons,
   glassmorphism everywhere, and animation that draws attention to itself. Motion should
   feel *intentional and secondary to the content* — it rewards attention, it doesn't beg
   for it.

So: **use the powerful tools with discipline.** The research question is not "what flashy
effects exist" — it is **"how do the best-designed software companies use motion, depth,
type, and colour to feel expensive while staying calm, and exactly how is each effect
built?"**

## The product (context you need)

**Cairn** is a **local-first study tracker** for people who teach themselves a subject
using an AI tutor. Its one idea: *your AI-tutored studying has no memory — Cairn gives it
one.* You bring your own AI; Cairn keeps the memory.

- **How it works (BYO-AI loop):** Cairn hands you a ready-made prompt → you paste it into
  whatever AI you already use, with your syllabus/notes/exam → you paste the AI's JSON
  back into Cairn → it validates strictly against a schema (it **verifies; it never
  generates**) → you preview and commit.
- **The memory model:** courses → sections → topics, each on a **retention curve**
  `R(t) = e^(−t/(k·s))`; per-topic health scores 0–100; a "due for review" queue; exams
  recalibrate each topic's decay rate (evidence, not arbitrary weight).
- **Privacy is a feature:** no accounts, no backend, no network requests; everything is a
  single JSON document in your browser (or a file on disk in the future desktop build).
- **Two calls to action:** "Open the app" (the existing local-first web app) and
  "Download for desktop" (a future build — currently a tasteful "coming soon" placeholder).
- **Audience:** self-directed learners, students, autodidacts — intelligent, allergic to
  hype and to being sold to.

## The current design system (must stay consistent with this)

The landing page shares the app's design tokens; the elevated design should honour the
same visual DNA (you may deepen and refine it, not replace it):

- **Type:** Inter (variable) for text, JetBrains Mono for **every measured number**
  (retention %, health 0–100, counts, deltas) — tabular figures, this mono/number rule is
  the single most important typographic signature. Headings weight 700, tight tracking
  (−0.02em); body tracking −0.006em; OpenType features cv05/cv08/ss01 on.
- **Colour:** restrained neutral canvas, **one blue accent** (`#0062c6` light / `#0a84ff`
  dark). Semantic green/amber/red appear only *inside* product UI, never as decoration.
  Canvas is `--bg-page` with two very soft radial washes (~5% alpha). Full **light and
  dark**, both first-class.
- **Surface/depth:** cards use a translucent surface, `20px` radius, a **1px inset top
  edge highlight** as the material cue, and soft layered shadows; one single elevated
  "hero" shadow on the page's primary product visual.
- **Spacing/layout:** 1180px content column; 4/8px spacing rhythm; breakpoints at 768 and
  720px.

## What the page currently contains (nine bands, top to bottom)

1. **Top bar** — "Cairn" wordmark, nav (How it works, Privacy), theme toggle, "Open the app".
2. **Hero** — asymmetric split: headline *"Your AI can teach you anything. It just can't
   remember you learned it."* + subhead + two CTAs on the left; on the right a **token-built
   recreation of the app's Overview** (a circular course-health ring showing 82, and a
   "Due for review" list of three decayed topics with %s).
3. **Problem** — one line: *"You study a topic with your AI. A week later, nothing
   remembers you did."*
4. **How it works** — three step cards (Copy the prompt / Paste the result back / Preview,
   then commit), including a copy-to-clipboard prompt block and a **validation-card
   recreation** (filename, ✓ counts, a green "committed" tag).
5. **The memory model** — features a **retention-matrix recreation** (avg-retention stat +
   delta chip, topic rows with retention bars and diagnostic badges).
6. **Exams recalibrate** — test events tune each topic's decay rate.
7. **Privacy** — no accounts / no backend / no network / one JSON file.
8. **Choose your way in** — two cards (Open the app / Download for desktop) + a no-sync
   honesty line.
9. **Closer** — wordmark, both CTAs once more, a quiet footer.

Three **product recreations** (Overview ring, retention matrix, validation card) are the
visual centrepieces — they are honest, token-built HTML mockups of the real app UI, not
screenshots. Making *these* feel alive, precise, and physical is probably the single
biggest lever for "well-made".

## What I want the research to deliver

Investigate and report on, at minimum:

1. **Reference teardown (10–15 exemplars).** Dissect landing pages / sites that hit
   "restrained but obviously expensive" (Linear, Stripe, Vercel, Family.co, Arc, Raycast,
   Retool, Resend, Clerk, Vanta, Rauno/Emil-style personal sites, etc.). For each: *what
   specifically* makes it read as high-craft — the type scale and optical adjustments, the
   spacing system, how they use depth/shadow/borders, their colour discipline, and the
   **exact motion techniques** (with the mechanism, not just "it animates"). Note which
   are appropriate for a calm developer-tool audience.

2. **Motion & interaction system.** A coherent, restrained motion language: entrance/
   reveal choreography, scroll-linked effects (parallax done tastefully, pinned sections,
   scroll-driven progress), hover/press micro-interactions, cursor-aware lighting,
   number/counter animation, and **choreography principles** (timing, easing curves,
   stagger, when NOT to animate). Recommend specific easings/durations. Address how to keep
   it from feeling gratuitous.

3. **Bringing the three product recreations to life.** How top products animate and
   present in-product UI mockups on marketing pages — e.g. animated data (the ring
   counting up and drawing, retention bars filling, live-feeling numbers), subtle
   perspective/tilt, layered depth, "it's real" cues. Balance liveliness against the
   honesty requirement (these represent a real, calm tool).

4. **Depth, light, and texture — the tasteful versions.** How to add richness *without*
   the generic-AI look: fine noise/grain, precise 1px borders and inset highlights,
   layered soft shadows, restrained spotlight/aurora treatments that stay subtle,
   dark-mode luminosity. Give concrete parameter ranges (blur radii, alphas, sizes).

5. **Typography craft.** Advanced editorial type for product marketing: fluid type scales,
   optical sizing, tracking by size, mixing Inter with JetBrains Mono for numeric emphasis,
   text-reveal/gradient-text/variable-weight effects used with restraint, hanging
   punctuation, measure/leading. Very concrete.

6. **Tech stack & architecture recommendation.** Given the page will be React: recommend a
   specific stack (animation lib(s), smooth-scroll, any WebGL/canvas, icons) with
   trade-offs, bundle-size notes, and how to structure it (full React page vs. islands).
   Include what to lazy-load and how to keep first paint fast even though heavy animation
   is allowed.

7. **Accessibility & robustness (still required, even though this page may rely on JS):**
   how the best sites honour `prefers-reduced-motion` (what each effect degrades to),
   keyboard operability, focus states, colour contrast in both themes, and avoiding
   layout shift. Motion must never trap or exclude anyone.

8. **A section-by-section elevation plan** for the nine bands above: for each, the single
   highest-impact upgrade, the specific technique to achieve it, and a restraint note so it
   doesn't tip into flashy. Call out where to spend the "wow budget" (probably the hero +
   the three recreations) and where to stay quiet.

## Output format

Return a structured report with: (a) an executive summary of the design direction in 5–8
sentences; (b) the reference teardown as a table or per-exemplar list; (c) the motion
system as named, reusable patterns with concrete timing/easing specs; (d) the
section-by-section elevation plan; (e) a concrete tech-stack recommendation; (f) a
prioritised, numbered list of the ~15 highest-leverage changes, most impactful first.
Prefer specificity, real examples, named techniques, and copy-pasteable parameter values
over general principles. Where you assert an effect, describe **how it is built**.

## Hard "do not" list (taste guardrails)

- No full-bleed purple/rainbow gradient-mesh hero; no floating gradient blobs.
- No bento-grid feature wall; no emoji as feature icons.
- No animation that is the main event of a section, or that fights the reading flow.
- No hype vocabulary ("supercharge/unlock/revolutionize"); no fake/among-us numbers in
  the product recreations — they must stay honest and Study+Exams-only (no fitness/jobs/
  work-logged content).
- Keep the app's type + one-accent + light/dark DNA; elevate it, don't replace it.
```
