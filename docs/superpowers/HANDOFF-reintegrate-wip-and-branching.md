# Handoff: reintegrate the wispr-flow UI WIP and untangle the branching

---

## ✅ REINTEGRATION COMPLETE + COLD-CHECK WIRED (2026-08-11, session 2) — read this first

Goals 1–4 below are **done and committed**, plus the cold-assessment entry point
(previously deferred) is now wired. Full suite green on `feat/performance-metrics`.
**Five commits on top of `e74242d`:**

- `3ac0ed1` feat(app) — stashed app UI redesign + Performance re-wire (src + tests, 32 files)
- `b1e7b6b` feat(landing) — landing redesign WIP + brand assets (35 files)
- `d74095e` docs — DATA-FLOW.md, start-session focus spec/plan, `.gitignore` scratch rule (4 files)
- `7ed4051` docs(handoff) — this completion record
- `6069f25` feat(ui) — cold-assessment entry point in the exam flow (AddFlow toggle + test)

**Verification (as of `6069f25`):** `npm run typecheck` green; `npm test` → **92 files pass / 1 skipped / 0 fail, 588 tests pass** (baseline was 561 pass / 18 fail). The 18 UI failures (app-smoke, CourseDashboard, TopicDetail) are resolved with no regressions; the read-side-only invariant, Performance, router, and AppShell tests all stay green.

**Cold-check wiring (`6069f25`):** `src/routes/AddFlow.tsx`'s **exam** kind now has an "Exam result" / "Cold check" toggle. Cold check swaps the copy-out prompt to `coldAssessmentPrompt(store)` and shows a run-it-cold explainer. Cold checks are reported as exams (`cold: true`) and reuse the existing exam ingest/commit pipeline unchanged — presentation only, engine untouched. Pinned by `tests/routes/AddFlow.test.tsx`.

**One correction to the plan below (hazard 1 / hazard 3):** the reintegration was **not** a "pop + re-apply 4 lines" on the committed shell. The *intended* `src/shell/AppShell.tsx` is the **stash's** NAV-style shell (flat primary nav + `course-list` + segmented theme switch), which **replaces** the committed `d8db98c` TABS/`course-switch`/`sidebar-footer` shell. The stash's `AppShell.test.tsx` was updated to match it, so component+test are internally consistent and green. The Performance nav/route was re-applied *into the stash's NAV structure* (one `NAV` entry → renders in both sidebar and bottom tab bar; one route case in `App.tsx`). Reconciliation surface was only these 2 files (App.tsx, AppShell.tsx); the collision files `cairnMock.ts`/`Celebration.tsx` were byte-identical (mod CRLF) so nothing was lost.

**How it was done (not a blanket `git stash pop`):** selective extraction — `git checkout stash@{0} -- <tracked paths>` for the redesign, `git checkout stash@{0}^3 -- <paths>` for useful untracked docs/assets, skipping the identical collision files and all `landing/files to merge/` scratch (now gitignored).

**Safety net still in place — next session should clean up when satisfied:**
- `stash@{0}` is **retained** (fully superseded by the commits above; drop with `git stash drop stash@{0}`).
- tag `pre-reintegration-backup` (@ `e74242d`) is **retained** (delete with `git tag -d pre-reintegration-backup`).

**Still open (all deferred, none blocking) — suggested order for the next session:**
1. **Goal 5 — merge sequence to main (the big one).** Human chose **collapse into one integration branch**: `main` (3.0.0) → land the **3.1.0 engine rewrite first** → then merge this integration branch. NOT started (higher-risk; deferred for budget). Do NOT merge Performance to `main` ahead of the engine rewrite. The 3.1.0 engine rewrite lives on `rewrite-baseline-and-leveling` (@ `4e03ed1`); trace its lineage vs `main` before sequencing. Propose the merge/rebase plan to the human before executing.
2. **Per-course Performance scope selector** — engine already scopes (`courseReviewEvents` in `performance-view.ts`); small additive, read-only UI win on `Performance.tsx`, which currently renders one global aggregate across all courses. Safe to do on the current base.
3. **Trend charts (7/30/lifetime)** — engine support exists (`metricTrend`); pure UI addition, YAGNI-deferred.
4. `presentMean` DRY nit (shared by Cold/Health) and other logged minor style nits.

**Do NOT build:** the calibration predict-first flow — a deliberate product decision (adds friction to every assessed item); needs a call with the study plan in view, not momentum. See "Pipeline reachability" below.

**Done since the original handoff:** ✅ cold-assessment UI entry point (`6069f25`).

---

**For the next agent.** A Performance-metrics feature was just completed on
`feat/performance-metrics`, but the app's UI redesign is unfinished and sitting in
a git **stash**. Your job: bring the stashed UI work back, reconcile it with the
Performance feature, fix the resulting test failures, handle scratch files, and
establish a clean path to `main`. **Read this whole file, then propose a plan to
the human BEFORE running `git stash pop`** — the stash is the only copy of 90 files
of UI work; a botched pop is expensive.

## Current state (verified 2026-08-11)

- **Active branch:** `feat/performance-metrics` @ `0a424c0` — **37 commits** on top of `d8db98c`.
- **What it contains:** a complete, tested Performance-metrics layer — data model, tutor contract, analytics engine, prerequisites, dashboard (data + UI), and validation. Engine/domain/core tests all green (**353**). Read the design + plans first:
  - Design/spec: `docs/superpowers/specs/2026-08-10-performance-transfer-metrics-design.md`
  - Phase plans: `docs/superpowers/plans/2026-08-1{0,1}-performance-metrics-phase*.md`
  - Data-flow map of the whole app: `docs/DATA-FLOW.md` (**this is currently only in the stash — see hazard 2**).
- **The stash:** `stash@{0}` — labelled *"wispr-flow landing WIP + floating docs, base d8db98c"* — **90 files, +15022 / −1865**. This is the unfinished UI redesign (landing + app) plus assorted untracked docs. It originally belonged to branch `redesign/wispr-flow-landing`.
- **Why "the UI changed" (beyond the Performance page):** the working tree is the committed mid-refactor base `d8db98c` — already the "Cairn / Wispr Flow" cream-broadsheet redesign (`src/theme/cairnMock.ts` + `getCairnTheme`). The *further* in-progress UI refinements live in the stash, not the tree. Popping the stash restores them.

## Pipeline reachability — what actually feeds the Performance layer

Nothing here is broken; this is a **scope boundary** that was invisible until the pipeline was traced end to end. Status as of `74cf0b2`:

- **Schema / merge / engine / UI: correct and tested.** The tracker stores, derives, and renders assessment data; the read-side-only invariant is proven byte-for-byte (Phase 6).
- **Prompts: now updated to feed it.** `src/domain/prompts.ts` was the file nobody touched for six phases — the copy-out prompts never asked the tutor for the assessment fields the schema accepts, so the layer shipped **inert**. It is now fixed: `sessionPrompt`/`examPrompt` carry the shared `ASSESSMENT_RUBRIC`, the exam prompt has exam-level `cold`, the course prompt asks for `prerequisites`, and there is a new `coldAssessmentPrompt`. A seam test (`tests/domain/prompts.test.ts`) now pins prompts↔schema lockstep so this can't silently regress again.
- **Calibration: structurally not-yet-feedable — a deliberate future product decision, NOT a defect.** The strict foresight rule (a prediction must precede the outcome) can't be satisfied by the current single-paste-at-session-end flow — any `predicted_success` in that JSON is hindsight, which calibration correctly discards. The retrospective dimensions (difficulty/novelty/independence/transfer/quality/cold) are fine to emit at session end; a genuine *prediction* needs a **predict-first interaction step** the app doesn't have. The prompts therefore deliberately **omit** prediction fields. Do NOT bolt on a predict-first flow to "finish" this — it changes the shape of every study session (friction on every assessed item for one metric) and deserves a deliberate call with the study plan in view. Leave calibration unpopulated and flagged; the metric, its tests, and its honesty rule are all correct and ready for whenever that flow is designed.
- **Cold-assessment UI entry point: not wired.** `coldAssessmentPrompt` exists and is schema-correct, but nothing surfaces it (a "start a cold check" action). Wiring it belongs with the UI reintegration — `AddFlow`/`AddExam` are in the stash zone.

## Branch lineage (the ordering is load-bearing)

```
main (79f046b) ── schema 3.0.0, PRE engine-rewrite (no `smeared`, no assessment fields)
   │
   └─ redesign/wispr-flow-landing (d8db98c)   ← the stash's base
        = main + the 3.1.0 engine rewrite + the committed landing redesign + Performance design docs
        │
        └─ feat/performance-metrics (0a424c0)
             = d8db98c + base-repair commit (823397d) + the Performance feature (37 commits)
```

`main` is **behind** the 3.1.0 engine rewrite. The Performance feature is a *descendant* of that rewrite (it needs `smeared`, continuous gain, the v3.1.0 migration, `SCHEMA_VERSION 3.2.0`). **Feature-complete ≠ mergeable:** the Performance work structurally cannot reach `main` ahead of the engine rewrite.

## Hazards — read before `git stash pop`

1. **`cairnMock.ts` and `Celebration.tsx` collide.** The committed base imported `@/theme/cairnMock` and `@/routes/Celebration` but never tracked those files, so they were committed (`823397d`) to make the branch typecheck. **Those same two files ALSO exist as untracked entries inside the stash (`stash@{0}^3`).** A plain `git stash pop` will abort ("already exists, would be overwritten") on them. Handle deliberately — e.g. diff the stash versions against the committed ones and keep the newer WIP:
   ```
   git show 'stash@{0}^3:src/theme/cairnMock.ts'   | diff - src/theme/cairnMock.ts
   git show 'stash@{0}^3:src/routes/Celebration.tsx' | diff - src/routes/Celebration.tsx
   ```
   Then either temporarily remove the committed copies, pop, and re-reconcile; or extract the stash selectively (`git checkout 'stash@{0}' -- <tracked paths>` and `git checkout 'stash@{0}^3' -- <untracked paths>`) rather than a blanket pop.
2. **Scratch material in the stash.** It includes `landing/files to merge/`, `landing/files to merge/uploads/*.png`, and a `.thumbnail` — import scratch, NOT source. Do not commit these permanently; `.gitignore` or discard them after extracting anything useful. It also carries genuinely useful docs (`docs/DATA-FLOW.md`, `docs/superpowers/{specs,plans}/2026-08-07-start-session-*`) that SHOULD be committed.
3. **18 pre-existing UI test failures** in exactly three files: `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. These are the mid-refactor base — committed components lag their committed tests. **The stashed WIP is expected to resolve them** (it finishes the component redesign those tests were updated for). Those three going green is your success signal. If a test is genuinely wrong (not the component), that's a finding to raise, not a test to delete.
4. **Do not disturb the Performance engine's read-only invariant.** Phase 6 proved *byte-for-byte* that the Performance layer touches no existing metric (`tests/engine/read-side-only.test.ts`). UI reintegration is presentation-only — keep it that way.

## Goals

1. **Reintegrate the stash**, reconciling the cairnMock/Celebration collision (hazard 1) with no loss.
2. **Get the 3 broken UI test files green** via the finished redesign (hazard 3).
3. **Handle scratch vs. real docs** (hazard 2): ignore/discard scratch; commit `DATA-FLOW.md` and the start-session docs.
4. **Restyle `src/routes/Performance.tsx`** to the finalized redesign. It already uses `getCairnTheme`, so it should mostly follow; align it with the redesign's final component patterns, keeping it **read-only** over the engine (it composes `src/engine/performance*.ts` view-models — never writes).
5. **Establish a clean branching/merge path to `main`.** Fixed dependency order: `main` (3.0.0) → land the **3.1.0 engine rewrite** first → then the **redesign + Performance feature**. Decide *with the human* whether `redesign/wispr-flow-landing` and `feat/performance-metrics` collapse into one integration branch and whether it all merges as one train or in stages. Do NOT attempt to merge the Performance feature to `main` ahead of the engine rewrite.

## First moves

```bash
git status
git stash list
git stash show -u stash@{0} --stat        # the 90 files
git log --oneline d8db98c..HEAD           # the Performance feature (37 commits)
git branch -vv                            # main=79f046b(3.0.0); redesign/wispr-flow-landing=d8db98c
npm run typecheck && npm test             # baseline: 3 UI files fail (18 tests); everything else green
```

Then propose a **reintegration + merge-sequence plan** to the human before popping.

## Verification targets

- `npm run typecheck` GREEN.
- `npm test`: the **3 UI files that fail today end GREEN**; **nothing green today may regress** — especially the Performance layer (`tests/engine/*`, `tests/routes/Performance.test.tsx`, `tests/routes/router.test.ts`, `tests/shell/AppShell.test.tsx`).
- Whole suite green is the finish line.

## Deliberately-deferred items (not bugs — pick up if in scope)

- **Per-course / per-section / per-topic Performance scoping.** The dashboard currently renders one **global** aggregate across all courses — a single number across three subjects isn't decision-useful. The engine already scopes per-course (`courseReviewEvents` in `performance-view.ts`); a course scope selector on `Performance.tsx` is a small, safe, additive fix (do it against the current base). Per-topic performance belongs in the redesigned `TopicDetail` drawer (stash zone), and note the min-data guards mean topic-level composites will often read "—" until a topic accrues ≥5 assessed attempts — surface raw per-topic diagnostics (difficulty/novelty spread, independent accuracy) there rather than the full composite. A `sectionReviewEvents` helper is a trivial add for section granularity.
- **Calibration predict-first flow** — see "Pipeline reachability" above. A real product decision, not a task to complete under momentum.
- **Cold-assessment UI entry point** — `coldAssessmentPrompt` exists; wire a "start a cold check" action during the UI reintegration.
- The Performance dashboard's **7 / 30 / lifetime trend charts** — the engine support exists (`metricTrend` in `src/engine/performance-view.ts`), the UI was deferred (YAGNI). Pure UI addition when wanted.
- A few logged **deferred-minor style nits** (e.g. a `presentMean` DRY extraction shared by Cold/Health) noted during Phase 3/5 reviews.
