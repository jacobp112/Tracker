# Handoff: reintegrate the wispr-flow UI WIP and untangle the branching

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

- The Performance dashboard's **7 / 30 / lifetime trend charts** — the engine support exists (`metricTrend` in `src/engine/performance-view.ts`), the UI was deferred (YAGNI). Pure UI addition when wanted.
- A few logged **deferred-minor style nits** (e.g. a `presentMean` DRY extraction shared by Cold/Health) noted during Phase 3/5 reviews.
