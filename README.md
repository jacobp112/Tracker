# StudyOS — Personal Tracker

[![CI](https://github.com/jacobp112/Tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/jacobp112/Tracker/actions/workflows/ci.yml)

A **local-first personal tracker** for study, exams, fitness, and job applications — zero setup, no accounts, no backend, no network calls. Your data lives in your browser and never leaves it.

The core idea: **you bring your own AI**. Instead of building chat into the app, every ingestion flow gives you a copy-paste prompt. You paste it (plus your syllabus / session notes / exam paper / job posting) into whatever AI you use, and paste the JSON it produces back into the tracker — where it is strictly validated, previewed, and only then committed. The app never generates; it only verifies.

## Domains

| Domain | What it does |
|---|---|
| **Study** | Courses → sections → topics with a spaced-repetition memory model: per-topic retention curves (`R(t) = e^(−t/(k·s))`), self-tuning decay from test evidence, confidence calibration (OCI), health scores, diagnostic badges, due queues, and mastery projections |
| **Exams** | Exam results decompose into per-topic test events that recalibrate each topic's decay rate — exams outweigh study sessions through drift-driven `k_factor` tuning, not arbitrary weights |
| **Fitness** | Running (pace/distance trends by run type) and lifting (per-exercise top-set / estimated-1RM progression, kg/lb display toggle) |
| **Jobs** | Application pipeline board (saved → applied → screen → interview → offer), append-only stage history, honest funnel analytics (response/interview rates from furthest-stage-ever-reached), next-action dates |

Everything converges on a cross-domain **Overview**: global due queue, study streak, weekly volume, overall mastery, and a unified activity feed.

## Quick start

```bash
npm install
npm run dev        # → http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm test` | Vitest suite (~300 tests: engine math, pipeline, components, a11y) |
| `npm run typecheck` | Strict TypeScript, no emit |
| `npm run build` | Production build to `dist/` |

The app is a static bundle — any static host (or opening from disk, thanks to hash routing) serves it.

## Architecture

Every domain follows the same spine, one layer per directory:

```
src/
├── domain/     types, JSON Schemas (ajv, additionalProperties:false), AI prompt templates
├── core/       ingestion pipeline: parse → validate → integrity → preview → atomic commit
│               merge (decompose into events), storage (localStorage), export/import
├── engine/     pure derivations — retention, recalculation, metrics, leveling,
│               exams, fitness, jobs, overview, command-palette corpus
├── hooks/      useStore (atomic clone→save→swap), preferences, theme, shortcuts
├── components/ shared primitives (Document 3 §3) — cards, pills, charts, sheet, toasts
├── routes/     one file per screen
├── shell/      app shell: sidebar / bottom tabs, icons
└── styles/     design tokens + per-surface CSS
```

Design principles that hold throughout:

- **Event-sourced where it matters.** Study topics carry an append-only `review_history`; job applications an append-only `stage_history`. Current state (retention, stage, funnel rates) is always *derived*, never stored — so it cannot drift from the history that explains it.
- **Atomic commits.** Every write clones the store, mutates the clone, persists, then swaps. A throw anywhere leaves live state untouched.
- **No silent failures.** Every failure path surfaces a plain-English message naming the field and the fix.
- **Strict ingestion.** `additionalProperties: false` everywhere; hallucinated fields fail loudly. Derived values (pace, retention fractions, stage events) are computed on ingestion, never trusted from input.
- **Live derivation.** Retention decays and topics become due purely from elapsed time — numbers are recomputed on every load, never cached to storage.

## Specifications

The app is built against four versioned spec documents (referenced from code comments as "Document 1–4"):

| Doc | Owns |
|---|---|
| [1 — Data & Schema](docs/specs/01-data-schema-spec.md) | every JSON shape, ingestion rules, versioning |
| [2 — Math & Algorithms](docs/specs/02-math-algorithms-spec.md) | all formulas, constants, the recalculation path |
| [3 — UI & Design System](docs/specs/03-ui-design-spec.md) | tokens, components, screen layouts, voice |
| [4 — Product & User Stories](docs/specs/04-product-spec-user-stories.md) | prompts, DoR/DoD, epics, build order, scope |

Implementation status per epic/story: **[docs/PROGRESS.md](docs/PROGRESS.md)**. Accessibility audit: [docs/accessibility-audit.md](docs/accessibility-audit.md).

## Testing

```bash
npm test
```

The suite encodes the specs, not just the code: the Document 2 §12 worked example is a test case (every intermediate value matched), the export→import round-trip guarantee is asserted, and jsdom component tests cover keyboard access and reduced-motion behaviour.

## Data & privacy

All data is a single JSON document in `localStorage`. Settings → Export produces a full JSON bundle; import validates every object as strictly as a fresh paste. There are **no network requests** — the only external actor is the AI *you* choose to paste prompts into.
