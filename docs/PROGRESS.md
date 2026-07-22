# Implementation Progress

Status of every epic and story from [Document 4 — Product Spec & User Stories](specs/04-product-spec-user-stories.md), checked against the codebase (React/TypeScript rewrite, `src/`). A story is checked only when its acceptance criteria are verifiably implemented and covered by the test suite where the spec demands it.

Last updated: 2026-07-22.

## E1 — Foundation & Design System ✅

- [x] **E1-S1 — Design tokens** — `src/styles/tokens.css`, light/dark themes, pre-paint theme resolution (`src/theme/`), token sheet dev route (`#/dev`)
- [x] **E1-S2 — Shared component library** — `src/components/` primitives; all-states showcase dev route (`#/dev/components`)
- [x] **E1-S3 — App shell & navigation** — `src/shell/AppShell.tsx`: sidebar ≥768px, bottom tabs below, keyboard-navigable

## E2 — Ingestion & Validation ✅ (S5 deferred by design)

- [x] **E2-S1 — Parse & schema validation** — `src/core/validate.ts`, ajv with `additionalProperties: false`, all errors collected; `tests/core/pipeline.test.ts`
- [x] **E2-S2 — Referential integrity** — `src/core/integrity.ts`, dangling ids reported with field paths
- [x] **E2-S3 — Plain-English error translation** — `src/core/errorTranslation.ts`, withdrawn-v0.1-field detection included
- [x] **E2-S4 — Preview & commit** — `src/core/pipeline.ts`, atomic clone-then-swap commit; `tests/core/commit.test.ts`
- [ ] **E2-S5 — Auto-repair** — **DEFERRED** (product decision, Doc 4 §6): the app makes no AI/network calls; the manual-correction path is the story

## E3 — Study Engine ✅

- [x] **E3-S1 — Constants config** — `src/config/constants.ts`, no inline literals in the engine
- [x] **E3-S2 — Retention function** — `src/engine/retention.ts`: `R(t) = e^(−t/(k·s))`, undefined (never 0%) for unreviewed topics
- [x] **E3-S3 — Single recalculation path** — `src/engine/recalculate.ts` (`applyEvent`); **Document 2 §12 worked example encoded**: `tests/engine/worked-example.test.ts`
- [x] **E3-S4 — Live derivation on load** — all metrics computed per render, never stored; due-ness moves with elapsed time
- [x] **E3-S5 — Health / OCI / badges / weak ranking / velocity / projection** — `src/engine/metrics.ts`, `src/engine/course.ts`; `tests/engine/engine.test.ts`

## E4 — Study Dashboard ✅

- [x] **E4-S1 — Course dashboard shell** — `src/routes/CourseDashboard.tsx`
- [x] **E4-S2 — Retention matrix** — `src/components/RetentionRow.tsx`; % always present in text alongside colour
- [x] **E4-S3 — Hero, activity calendar & props row** — `src/components/HeroStat.tsx`, `Sparkline.tsx`, `ActivityCalendar.tsx`, `PropsRow.tsx`; motion gated on `prefers-reduced-motion`
- [x] **E4-S4 — Projection & review plan** — range projection with explicit "Not enough data yet" state; weak-topic-ordered plan
- [x] **E4-S5 — Topic detail with retention curve** — `src/routes/TopicDetail.tsx`, `src/components/RetentionCurve.tsx`, resolve toggles write back
- [x] **E4-S6 — Log session flow** — `src/routes/LogSession.tsx` through the E2 pipeline; dashboard re-derives without refresh

## E5 — Exams ✅

- [x] **E5-S1 — Add exam result flow** — `src/routes/AddExam.tsx`, breakdown and uniform-fallback both supported
- [x] **E5-S2 — Exam recalculation** — `src/core/merge.ts` → `applyEvent` per linked topic; drift → `k_factor` tuning is the exam-weighting mechanism; `tests/core/recalc-on-commit.test.ts`
- [x] **E5-S3 — Exams screen** — `src/routes/Exams.tsx`: cross-course grouping, boosted/flagged effects, error-type chips

## E6 — Fitness ✅

- [x] **E6-S1 — Running log & trends** — pace computed on ingestion; type-filterable trend (`src/engine/fitness.ts`, `src/routes/Fitness.tsx`)
- [x] **E6-S2 — Lifting log & progression** — per-set data, top-set / est-1RM (Epley) charts, kg/lb display toggle with kg storage

## E7 — Overview & Cross-domain ✅

- [x] **E7-S1 — Overview screen** — `src/engine/overview.ts`, `src/routes/Overview.tsx`: global due queue with section spreading, streak / weekly volume / overall mastery, health ring, unified activity feed

## E8 — Settings, Export/Import & Polish ✅

- [x] **E8-S1 — Full export/import** — `src/core/transfer.ts`; round-trip identity asserted in `tests/core/transfer.test.ts`
- [x] **E8-S2 — Theme & unit preferences** — persisted, applied app-wide immediately
- [x] **E8-S3 — Reduced-motion & a11y audit** — [accessibility-audit.md](accessibility-audit.md); `tests/a11y/accessibility.test.tsx`

---

## Post-v1 extensions (beyond the Document 4 backlog)

- [x] **UI loop-closing pass** (2026-07-22, Doc 3 §9 addendum v0.5) — topic status control (mastery/velocity/projection now reachable), one-tap quick review via the dormant `manual_review` source, Quick-add universal paste inbox with schema auto-detection, paste-to-validate, Undo on commit toasts, Overview "Coming up" agenda + job feed events, course-title headline
- [x] **Job-application tracker** (2026-07-22) — new `job` domain on the same ingestion spine: pipeline board, append-only stage history, funnel analytics, next-action dates. Hybrid record model (editable descriptive fields + derived current stage). `src/engine/jobs.ts`, `src/routes/Jobs.tsx`, `tests/{core/jobs-ingest,engine/jobs}.test.ts`. Consistent with Doc 4 §13.6 — still zero network calls.
- [x] **Live leveling** — per-topic and overall leveling (`src/engine/leveling.ts`)
- [ ] **Tracker gallery** — curated enable/disable of built-in trackers from the "Add tracker" surface (planned; Study/Fitness/Exams/Jobs become opt-in modules)
