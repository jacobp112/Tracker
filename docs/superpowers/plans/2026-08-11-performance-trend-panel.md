# Performance Trend Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Trends" panel to the Performance page that shows each headline metric across three windows — last 7 days, last 30 days, and lifetime — reusing the existing `metricTrend` engine helper.

**Architecture:** Pure, read-only UI addition to `src/routes/Performance.tsx`. A static metric-descriptor list (label + `compute: (events) => number | null` + `format`) is run through the existing `metricTrend(events, now, metric)` engine function to produce `{ d7, d30, lifetime }` per metric. A new `TrendsPanel` sub-component renders the descriptors as a CSS-grid table using the page's existing `panel`/`panelTitle` styles. It consumes the already-scoped `events`/`now` the page computes, so it inherits the course scope selector and the `—`-for-null (min-data guard) convention for free. No engine, schema, or write-path change.

**Tech Stack:** React + TypeScript, inline `CSSProperties` style builders (existing Performance.tsx pattern), Vitest + Testing Library, `getCairnTheme` design tokens.

## Global Constraints

- **Read-side-only invariant:** the Performance layer never writes to the store and never re-derives an existing metric. This task only *reads* `events` and calls existing engine functions. Do not modify anything under `src/engine/performance*.ts` or `src/engine/metrics.ts`. (Verified by `tests/engine/read-side-only.test.ts` — must stay green.)
- **Honest nulls:** a metric below its min-data guard returns `null`; render it as an em dash `—`, never `0`. The 7-day window will legitimately read `—` for most metrics until ≥5 qualifying attempts land within 7 days — this is correct, not a bug.
- **Scope reuse:** the panel must render from the page's existing scoped `events` and `now` values — do NOT recompute `allReviewEvents(store)` or introduce a second clock. The active course scope must apply to the panel automatically.
- **Design tokens:** all colors/typography come from the `CairnTheme` (`theme.ink`, `theme.muted`, `theme.border`, `theme.surface`, etc.) and the existing `SERIF`/`SANS` constants. No hardcoded hex.
- **Suite baseline:** `npm run typecheck` clean; `npm test` currently 92 files / 593 pass / 1 skipped / 0 fail. Nothing green today may regress.

---

### Task 1: Metric-descriptor list + `TrendsPanel` component (with tests)

**Files:**
- Modify: `src/routes/Performance.tsx`
- Test: `tests/routes/Performance.test.tsx`

**Interfaces:**
- Consumes (already exported from `@/engine/performance-view`):
  - `metricTrend<T>(events: ReviewEvent[], now: Date, metric: (evs: ReviewEvent[]) => T): TrendWindows<T>` where `TrendWindows<T> = { d7: T; d30: T; lifetime: T }`.
- Consumes (already exported from `@/engine/performance`):
  - `performanceHealth(events): number | null`
  - `coldPerformance(events): ColdPerformance | null` (`.score: number`)
  - `independentPerformance(events): IndependentPerformance | null` (`.sufficient: boolean`, `.independent.accuracy: number | null`)
  - `transferAbility(events): TransferAbility | null` (`.score: number`)
  - `performanceQuality(events): QualityScore | null` (`.score: number`)
  - `novelTaskSuccess(events): NovelTaskSuccess | null` (`.rate: number`)
- Produces (internal to this file, no new module exports):
  - `TREND_METRICS: Array<{ label: string; compute: (evs: ReviewEvent[]) => number | null; format: (v: number) => string }>`
  - `function TrendsPanel({ events, now, theme }: { events: ReviewEvent[]; now: Date; theme: CairnTheme }): JSX.Element`

**Design notes for the implementer:**
- The six metrics and their `compute`/`format`, matching how the existing headline cards format each (see `Performance.tsx:56-69`):

  | label | `compute(evs)` returns | `format(v)` |
  |---|---|---|
  | `Performance Health` | `performanceHealth(evs)` | `round(v)` |
  | `Cold Performance` | `coldPerformance(evs)?.score ?? null` | `round(v)` |
  | `Independent Performance` | independent accuracy → see below | `` `${round(v)}%` `` |
  | `Transfer Ability` | `transferAbility(evs)?.score ?? null` | `round(v)` |
  | `Performance Quality` | `performanceQuality(evs)?.score ?? null` | `round(v)` |
  | `Novel-Task Success` | `novelTaskSuccess(evs)?.rate` → `rate * 100` or null | `` `${round(v)}%` `` |

  Independent `compute`:
  ```ts
  (evs) => {
    const i = independentPerformance(evs);
    return i && i.sufficient && i.independent.accuracy !== null
      ? i.independent.accuracy * 100
      : null;
  }
  ```
  Novel `compute`:
  ```ts
  (evs) => {
    const n = novelTaskSuccess(evs);
    return n ? n.rate * 100 : null;
  }
  ```
- `round` already exists in the file (`Performance.tsx:10`). Reuse it. Do NOT reuse the file's `dash` helper — it only accepts a pre-rounded number; the panel needs per-metric formatting, so format inside the cell: `const raw = metricTrend(events, now, m.compute); ... windows.d7 === null ? '—' : m.format(windows.d7)`.
- Add the six raw metric imports to the existing import from `@/engine/performance` (currently only `performanceByDifficulty, performanceByNovelty, type DimensionBucket`). Add `ReviewEvent` to the `@/domain/types` import.
- Render with a CSS grid: 4 columns (`minmax(0,1fr)` for the metric label, then three equal window columns). One header row (`Metric` blank or a small caption / `7d` / `30d` / `Lifetime`) then one row per metric. Right-align the numeric cells. Use `theme.muted` for the header row and window values, `theme.ink` for metric labels, `SERIF` optional for the numbers to echo the cards (keep it simple: `SANS`, ~14px is fine). Wrap the grid in a `div` with `overflowX: 'auto'` for safety on narrow viewports.
- Reuse the existing `panel(theme)` and `panelTitle(theme)` style builders. Title the panel `Trends`. Add a one-line caption under the title (like `DimensionSection`/`PrereqSection` do) e.g. "Recent vs. lifetime — a window reads — until it has enough attempts."
- Place `<TrendsPanel events={events} now={now} theme={theme} />` inside the `hasAssessments` block, immediately after the headline-cards `<div>` grid and before the two `DimensionSection`s (`Performance.tsx:97-100`). It must NOT render in either empty state (no-assessment global, or scoped no-data) — placing it inside the `hasAssessments` branch satisfies this.

- [ ] **Step 1: Write the failing tests**

Add these tests to `tests/routes/Performance.test.tsx`. `vi` is needed — extend the top import to `import { describe, expect, it, vi } from 'vitest';`.

```tsx
describe('Performance trends panel', () => {
  it('renders a Trends panel with the three window headers and a metric row', () => {
    // 5 transfer observations → Transfer Ability = 100 in every window that contains them.
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);

    expect(screen.getByRole('heading', { name: /^trends$/i })).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText(/lifetime/i)).toBeInTheDocument();
    // A Trends row label for Transfer Ability exists (the header card also shows this label,
    // so assert there are at least two occurrences: card + trends row).
    expect(screen.getAllByText('Transfer Ability').length).toBeGreaterThanOrEqual(2);
  });

  it('shows lifetime values but em dashes for windows with too few recent attempts', () => {
    // Freeze "now" far after the events so the 7d and 30d windows are empty but lifetime is not.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-01T00:00:00.000Z'));
    try {
      // Events dated 2026-08-10 (fixture default) are >30 days before frozen now.
      const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
      render(<Performance store={storeOf(topicWith('topic_a', events))} />);

      // Lifetime column still aggregates the five observations → Transfer Ability 100 appears.
      expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1);
      // With empty 7d/30d windows, multiple trend cells read as an em dash.
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not render the Trends panel when there is no assessment data', () => {
    render(<Performance store={storeOf(topicWith('topic_a', [makeEvent(undefined)]))} />);
    expect(screen.queryByRole('heading', { name: /^trends$/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/routes/Performance.test.tsx -t "trends"`
Expected: FAIL — the `Trends` heading and `7d`/`30d` text don't exist yet.

- [ ] **Step 3: Implement `TREND_METRICS` and `TrendsPanel`, wire into the page**

In `src/routes/Performance.tsx`:

1. Extend imports:
```tsx
import type { Store, ReviewEvent } from '@/domain/types';
import {
  coldPerformance, independentPerformance, novelTaskSuccess, performanceByDifficulty,
  performanceByNovelty, performanceHealth, performanceQuality, transferAbility,
  type DimensionBucket,
} from '@/engine/performance';
import {
  allReviewEvents, courseReviewEvents, metricTrend, performanceSummary,
  unstablePrerequisites, type UnstableUpstream,
} from '@/engine/performance-view';
```

2. Add the descriptor list near the top-level helpers (module scope, after `dash`):
```tsx
const TREND_METRICS: Array<{
  label: string;
  compute: (evs: ReviewEvent[]) => number | null;
  format: (v: number) => string;
}> = [
  { label: 'Performance Health', compute: (evs) => performanceHealth(evs), format: round },
  { label: 'Cold Performance', compute: (evs) => coldPerformance(evs)?.score ?? null, format: round },
  {
    label: 'Independent Performance',
    compute: (evs) => {
      const i = independentPerformance(evs);
      return i && i.sufficient && i.independent.accuracy !== null ? i.independent.accuracy * 100 : null;
    },
    format: (v) => `${round(v)}%`,
  },
  { label: 'Transfer Ability', compute: (evs) => transferAbility(evs)?.score ?? null, format: round },
  { label: 'Performance Quality', compute: (evs) => performanceQuality(evs)?.score ?? null, format: round },
  {
    label: 'Novel-Task Success',
    compute: (evs) => {
      const n = novelTaskSuccess(evs);
      return n ? n.rate * 100 : null;
    },
    format: (v) => `${round(v)}%`,
  },
];
```

3. Add the component (place it near `DimensionSection`):
```tsx
function TrendsPanel({ events, now, theme }: { events: ReviewEvent[]; now: Date; theme: CairnTheme }) {
  const cell: CSSProperties = { fontSize: '14px', textAlign: 'right', color: theme.muted };
  const head: CSSProperties = { ...cell, fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' };
  return (
    <div style={panel(theme)}>
      <h2 style={panelTitle(theme)}>Trends</h2>
      <p style={{ fontSize: '12px', color: theme.muted, margin: '-6px 0 12px' }}>
        Recent vs. lifetime — a window reads “—” until it has enough attempts.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) repeat(3, minmax(56px, 88px))', rowGap: '10px', columnGap: '16px', minWidth: '360px' }}>
          <span style={{ ...head, textAlign: 'left' }}>Metric</span>
          <span style={head}>7d</span>
          <span style={head}>30d</span>
          <span style={head}>Lifetime</span>
          {TREND_METRICS.map((m) => {
            const w = metricTrend(events, now, m.compute);
            const fmt = (v: number | null) => (v === null ? '—' : m.format(v));
            return (
              <Fragment key={m.label}>
                <span style={{ fontSize: '14px', color: theme.ink }}>{m.label}</span>
                <span style={cell}>{fmt(w.d7)}</span>
                <span style={cell}>{fmt(w.d30)}</span>
                <span style={cell}>{fmt(w.lifetime)}</span>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```
Add `Fragment` to the React import: `import { Fragment, useMemo, useRef, useState, type CSSProperties } from 'react';`

4. Wire it into the render tree, right after the headline-cards grid closes and before the first `DimensionSection` (`Performance.tsx:97`):
```tsx
          </div>

          <TrendsPanel events={events} now={now} theme={theme} />

          <DimensionSection title="Performance by difficulty" ... />
```

- [ ] **Step 4: Run the trend tests to verify they pass**

Run: `npx vitest run tests/routes/Performance.test.tsx -t "trends"`
Expected: PASS (all three).

- [ ] **Step 5: Run typecheck + full Performance test file to confirm no regression**

Run: `npm run typecheck && npx vitest run tests/routes/Performance.test.tsx`
Expected: typecheck clean; all Performance page tests pass (existing + new). Note: the existing test "renders the headline card labels…" asserts `getByText('Transfer Ability')` (singular `getByText`) — the Trends row adds a second occurrence of that label, which makes `getByText` throw on multiple matches. **If that test now fails with "multiple elements", update it to `getAllByText('Transfer Ability').length` ≥ 1** (and similarly for `Performance Health` on line 43). This is an expected, correct consequence of adding the panel, not a defect — adjust the assertion, do not remove the panel.

- [ ] **Step 6: Commit**

```bash
git add src/routes/Performance.tsx tests/routes/Performance.test.tsx docs/superpowers/plans/2026-08-11-performance-trend-panel.md
git commit -m "feat(ui): Trends panel — 7d/30d/lifetime windows on Performance"
```

---

### Task 2: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; `npm test` → 92 files, 593+ pass (three new trend tests added), 1 skipped, 0 fail. In particular `tests/engine/read-side-only.test.ts`, `tests/shell/AppShell.test.tsx`, and `tests/routes/router.test.ts` must stay green (read-only invariant untouched).

- [ ] **Step 2: If anything unexpected fails, stop and diagnose**

Do not paper over a failure. Use superpowers:systematic-debugging if a non-obvious test breaks. The only *expected* churn is the two `getByText` → `getAllByText` assertion updates called out in Task 1 Step 5.

---

## Self-Review

**1. Spec coverage:** No separate spec (user chose to skip it as overkill). The single requirement — a dedicated Trends panel showing 7d/30d/lifetime per headline metric — is fully implemented in Task 1. ✔

**2. Placeholder scan:** No TBD/TODO. Every code step shows exact code, imports, and placement lines. ✔

**3. Type consistency:** `metricTrend` / `TrendWindows` signatures copied from `performance-view.ts:77-96`; metric return shapes (`.score`, `.rate`, `.sufficient`, `.independent.accuracy`) copied from `Performance.tsx:56-69` where the headline cards already read them. `round` (`Performance.tsx:10`) and `panel`/`panelTitle` (`Performance.tsx:209-214`) reused as-is. `ReviewEvent`/`CairnTheme` imports exist or are added explicitly. ✔

**4. Branch note:** Local `main` is ahead of `origin/main` (~9 unpushed commits from session 4). Do this work on a feature branch `feat/performance-trend-panel` off local `main`, per repo convention (don't commit feature work directly to `main`). Merge back with `--no-ff` when green.
