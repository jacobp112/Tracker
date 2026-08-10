# Performance Metrics — Phase 5b: Dashboard UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the Phase 5a view-models as a distinct **Performance** page — a headline-card row (Performance Health, Cold Performance, Independent Performance, Transfer Ability, Performance Quality, Novel-Task Success), performance-by-difficulty/novelty bars, and a prerequisite-instability list — reachable from a new nav entry, without touching the existing (mid-refactor) dashboards.

**Architecture (UI-baseline decision — additive, self-contained):** A new self-contained `src/routes/Performance.tsx` that reads the Phase 5a engine view-models and renders them with the existing `getCairnTheme` inline-style pattern (same as `Overview.tsx`). It does **not** modify or depend on the three currently-broken UI files (`app-smoke`, `CourseDashboard`, `TopicDetail`) or the stashed wispr redesign. Wiring is a minimal additive change to `router.ts`, `App.tsx`, and `AppShell.tsx`. When the redesign lands, this page restyles with everything else (same theme object).

**Tech Stack:** React 18, TypeScript 5.6, Vitest 2.1.4 + @testing-library/react (jsdom).

## Global Constraints

- **Additive & self-contained.** The new page is a new file; the wiring edits to `router.ts`/`App.tsx`/`AppShell.tsx` are purely additive (a new route, a new switch case, a new nav item). Do NOT modify `CourseDashboard.tsx`, `TopicDetail.tsx`, `Overview.tsx`, or their tests.
- **Presentation only, read-only.** The page reads the store and the Phase 5a/3 view-models; it never writes (no `useStore` mutators). Every number is derived live.
- **Honest nulls.** A metric that returns `null` (below its min-data guard) renders as **"—"**, never `0` or a fabricated value. A store with no assessment data at all shows a dedicated empty state, not a grid of dashes.
- **Baseline is NOT fully green.** 18 pre-existing UI failures in `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx`. The new component's own test must pass in isolation. After the wiring task, `router.test.ts` and `tests/shell/AppShell.test.tsx` must remain green (update them if they assert exhaustive route/nav lists — that's a legitimate change, not a regression); the 3 known files stay failing, nothing new.
- **Naming:** subject-agnostic, user-facing copy included.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/routes/Performance.tsx` | The Performance page — reads Phase 5a view-models, renders cards + diagnostics. | Create (Task 1). |
| `tests/routes/Performance.test.tsx` | Renders the page against built stores; asserts values, "—", empty state. | Create (Task 1). |
| `src/router.ts` | Hash routing. | Modify: add `performance` to `Route` + `parseHash` (Task 2). |
| `src/App.tsx` | Route→component switch. | Modify: add `case 'performance'` (Task 2). |
| `src/shell/AppShell.tsx` | Nav. | Modify: add a Performance nav item + tab (Task 2). |
| `tests/routes/router.test.ts`, `tests/shell/AppShell.test.tsx` | Existing tests. | Update only if they assert exhaustive lists (Task 2). |

---

## Task 1: The `Performance` page component (self-contained)

A new route component reading the Phase 5a view-models. No wiring yet — it is rendered directly by its own test, so it is green in isolation regardless of the broken dashboards.

**Files:**
- Create: `src/routes/Performance.tsx`
- Test: `tests/routes/Performance.test.tsx`

**Interfaces:**
- Consumes: `Store` (`@/domain/types`); `useTheme` (`@/theme/useTheme`); `getCairnTheme`, `CairnTheme` (`@/theme/cairnMock`); `allReviewEvents`, `performanceSummary`, `unstablePrerequisites` (`@/engine/performance-view`); `performanceByDifficulty`, `performanceByNovelty` (`@/engine/performance`).
- Produces: `export function Performance({ store }: { store: Store }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

Create `tests/routes/Performance.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Performance } from '@/routes/Performance';
import { emptyStore, type ReviewEvent, type Store, type Topic } from '@/domain/types';
import { makeEvent } from '../engine/assessment-fixtures';

function topicWith(id: string, events: ReviewEvent[], over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: events, error_log: [], ...over,
  };
}
function storeOf(...topics: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }] });
  return s;
}

describe('Performance page', () => {
  it('shows an empty state when there is no assessment data', () => {
    render(<Performance store={storeOf(topicWith('topic_a', [makeEvent(undefined)]))} />);
    expect(screen.getByText(/no performance data yet/i)).toBeInTheDocument();
  });

  it('renders the headline card labels and a computed value when data exists', () => {
    // 5 transfer observations → Transfer Ability = 100.
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);
    expect(screen.getByText('Transfer Ability')).toBeInTheDocument();
    expect(screen.getByText('Performance Health')).toBeInTheDocument();
    // Transfer card shows 100; a metric with no data shows an em dash.
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // e.g. Cold has no cold attempts
  });

  it('renders a performance-by-difficulty bar for independent attempts', () => {
    const events = Array.from({ length: 3 }, () =>
      makeEvent({ independence: 3, difficulty: 4 }, { test: { score: 9, out_of: 10 } }),
    );
    render(<Performance store={storeOf(topicWith('topic_a', events))} />);
    expect(screen.getByText(/performance by difficulty/i)).toBeInTheDocument();
    expect(screen.getByText(/difficulty 4/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/routes/Performance.test.tsx`
Expected: FAIL — `@/routes/Performance` does not exist.

- [ ] **Step 3: Implement**

Create `src/routes/Performance.tsx`:

```tsx
import { useMemo, useState, type CSSProperties } from 'react';
import type { Store } from '@/domain/types';
import { useTheme } from '@/theme/useTheme';
import { getCairnTheme, type CairnTheme } from '@/theme/cairnMock';
import { performanceByDifficulty, performanceByNovelty, type DimensionBucket } from '@/engine/performance';
import { allReviewEvents, performanceSummary, unstablePrerequisites, type UnstableUpstream } from '@/engine/performance-view';

const SERIF = "'EB Garamond', var(--font-display)";
const round = (x: number) => String(Math.round(x));

/** A metric value or an honest em dash when it's null (below its min-data guard). */
function dash(x: number | null | undefined): string {
  return x === null || x === undefined ? '—' : round(x);
}

export function Performance({ store }: { store: Store }) {
  const { theme: mode } = useTheme();
  const theme = getCairnTheme(mode === 'dark');
  const [now] = useState(() => new Date());

  const events = useMemo(() => allReviewEvents(store), [store]);
  const summary = useMemo(() => performanceSummary(events), [events]);
  const byDifficulty = useMemo(() => performanceByDifficulty(events), [events]);
  const byNovelty = useMemo(() => performanceByNovelty(events), [events]);
  const unstable = useMemo(() => unstablePrerequisites(store, now), [store, now]);

  const hasAssessments = events.some((e) => e.assessment);
  if (!hasAssessments) {
    return (
      <div style={content()}>
        <h1 style={pageTitle(theme)}>Performance</h1>
        <p style={{ fontSize: '15px', color: theme.muted, maxWidth: '520px' }}>
          No performance data yet. When your tutor marks assessments with difficulty,
          independence, transfer and quality, this page shows how effectively you can
          use what you know — separate from how well you retain it.
        </p>
      </div>
    );
  }

  const indep = summary.independent;
  const indepValue =
    indep && indep.sufficient && indep.independent.accuracy !== null
      ? round(indep.independent.accuracy * 100)
      : '—';

  const cards: Array<{ label: string; value: string; sub: string }> = [
    { label: 'Performance Health', value: dash(summary.performanceHealth), sub: 'effective use of knowledge' },
    { label: 'Cold Performance', value: summary.cold ? round(summary.cold.score) : '—', sub: 'unfamiliar · unaided' },
    { label: 'Independent Performance', value: indepValue, sub: indep ? `${indep.independent.n} independent attempts` : 'no data' },
    { label: 'Transfer Ability', value: summary.transfer ? round(summary.transfer.score) : '—', sub: summary.transfer ? `${summary.transfer.n} attempts` : 'not enough data' },
    { label: 'Performance Quality', value: summary.quality ? round(summary.quality.score) : '—', sub: 'reasoning · clarity · method' },
    { label: 'Novel-Task Success', value: summary.novelTaskSuccess ? `${round(summary.novelTaskSuccess.rate * 100)}%` : '—', sub: summary.novelTaskSuccess ? `${summary.novelTaskSuccess.n} novel tasks` : 'not enough data' },
  ];

  return (
    <div style={content()}>
      <h1 style={pageTitle(theme)}>Performance</h1>
      <p style={{ fontSize: '15px', color: theme.muted, maxWidth: '560px', margin: '0 0 28px' }}>
        How effectively you can use what you know — independent application, transfer, and
        performance at rising difficulty and novelty. Separate from retention.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {cards.map((c) => (
          <div key={c.label} style={card(theme)}>
            <span style={cardLabel(theme)}>{c.label}</span>
            <span style={{ fontFamily: SERIF, fontSize: '34px', lineHeight: 1.05, color: theme.ink }}>{c.value}</span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: theme.muted }}>{c.sub}</span>
          </div>
        ))}
      </div>

      <DimensionSection title="Performance by difficulty" unit="Difficulty" buckets={byDifficulty} theme={theme} />
      <DimensionSection title="Performance by novelty" unit="Novelty" buckets={byNovelty} theme={theme} />

      {unstable.length > 0 && <PrereqSection items={unstable} theme={theme} />}
    </div>
  );
}

function DimensionSection({ title, unit, buckets, theme }: { title: string; unit: string; buckets: DimensionBucket[]; theme: CairnTheme }) {
  return (
    <div style={panel(theme)}>
      <h2 style={panelTitle(theme)}>{title}</h2>
      {buckets.length === 0 ? (
        <p style={{ fontSize: '13px', color: theme.muted }}>No independent attempts yet.</p>
      ) : (
        buckets.map((b) => {
          const rate = b.successRate === null ? null : Math.round(b.successRate * 100);
          return (
            <div key={b.level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
              <span style={{ width: '96px', fontSize: '13px', color: theme.ink }}>{unit} {b.level}</span>
              <div style={{ flex: 1, height: '10px', borderRadius: '9999px', background: theme.surfaceAlt, overflow: 'hidden' }}>
                <div style={{ width: `${rate ?? 0}%`, height: '100%', background: theme.pine, borderRadius: '9999px' }} />
              </div>
              <span style={{ width: '64px', textAlign: 'right', fontSize: '13px', color: theme.muted }}>
                {rate === null ? '—' : `${rate}%`} · n={b.n}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function PrereqSection({ items, theme }: { items: UnstableUpstream[]; theme: CairnTheme }) {
  return (
    <div style={panel(theme)}>
      <h2 style={panelTitle(theme)}>Upstream instability</h2>
      <p style={{ fontSize: '12px', color: theme.muted, margin: '-6px 0 10px' }}>
        Topics you're struggling with whose prerequisites look shaky — the root may be upstream.
      </p>
      {items.map((it) => (
        <div key={it.topic_id} style={{ padding: '8px 0', borderBottom: `1px solid ${theme.border}` }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: theme.ink }}>{it.title}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: theme.muted }}>
            {it.report.upstream.filter((u) => u.unstable).map((u) => u.title).join(', ')}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── style builders (lean; align with Overview.tsx's theme usage) ── */
function content(): CSSProperties {
  return { flex: 1, width: '100%', maxWidth: '1440px', boxSizing: 'border-box', padding: '36px 40px 56px' };
}
function pageTitle(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '34px', color: t.ink, margin: '0 0 6px' };
}
function card(t: CairnTheme): CSSProperties {
  return { display: 'flex', flexDirection: 'column', gap: '6px', background: t.surface, border: `2px solid ${t.border}`, borderRadius: '14px', padding: '16px 18px 18px', boxShadow: `4px 5px 0 ${t.shadow}`, boxSizing: 'border-box' };
}
function cardLabel(t: CairnTheme): CSSProperties {
  return { fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.muted };
}
function panel(t: CairnTheme): CSSProperties {
  return { background: t.surface, border: `2px solid ${t.border}`, borderRadius: '14px', padding: '22px 24px', marginBottom: '24px', boxShadow: `4px 5px 0 ${t.shadow}`, boxSizing: 'border-box' };
}
function panelTitle(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontWeight: 400, fontSize: '20px', color: t.ink, margin: '0 0 14px' };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/routes/Performance.test.tsx`
Expected: PASS (3 tests).

Run: `npm run typecheck`
Expected: GREEN.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Performance.tsx tests/routes/Performance.test.tsx
git commit -m "feat(ui): Performance page — headline cards + diagnostics

Self-contained route reading the Phase 5a view-models: six headline cards
(each "—" below its min-data guard), performance-by-difficulty/novelty bars,
and an upstream-instability list. Empty state when no assessment data. Does
not touch the existing dashboards; tested in isolation.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Wire the route in (nav + routing)

Make the page reachable: a `performance` route, the App switch case, and a nav entry. Additive edits only; existing shell/router tests re-verified.

**Files:**
- Modify: `src/router.ts`
- Modify: `src/App.tsx`
- Modify: `src/shell/AppShell.tsx`
- Verify/update: `tests/routes/router.test.ts`, `tests/shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: `Performance` (`@/routes/Performance`, Task 1).
- Produces: reachable `#/performance` route rendering `<Performance store={store} />`, plus a "Performance" nav item.

- [ ] **Step 1: Write/extend the failing test**

Add to `tests/routes/router.test.ts` (a `parseHash` unit test — follow the file's existing style):

```ts
it('routes #/performance to the performance page', () => {
  expect(parseHash('#/performance')).toEqual({ name: 'performance' });
});
```

Run: `npx vitest run tests/routes/router.test.ts` → FAIL (returns `{ name: 'overview' }` today).

- [ ] **Step 2: Add the route to `router.ts`**

In the `Route` union (`src/router.ts`), add:
```ts
  | { name: 'performance' }
```
In `parseHash`, add a case before `default`:
```ts
    case 'performance':
      return { name: 'performance' };
```

- [ ] **Step 3: Add the App switch case**

In `src/App.tsx`, import the page near the other route imports:
```ts
import { Performance } from '@/routes/Performance';
```
In `AppInner`'s `switch (route.name)`, add:
```ts
      case 'performance':
        return <Performance store={store} />;
```

- [ ] **Step 4: Add the nav entry in `AppShell.tsx`**

In the `TABS` array, add after Overview:
```ts
  { name: 'performance' as const, label: 'Performance', href: '#/performance', Icon: OverviewIcon },
```
And in the sidebar `<nav>`, add a nav-item button after the Overview button:
```tsx
          <button
            type="button"
            className={`nav-item ${active === 'performance' ? 'active' : ''}`}
            onClick={() => navigate('/performance')}
            aria-current={active === 'performance' ? 'page' : undefined}
          >
            <OverviewIcon />
            Performance
          </button>
```
(Reusing `OverviewIcon` keeps the change dependency-free; a dedicated icon can follow with the redesign.)

- [ ] **Step 5: Run tests to verify pass + no shell/router regression**

Run: `npx vitest run tests/routes/router.test.ts`
Expected: PASS (new case + existing cases).

Run: `npx vitest run tests/shell/AppShell.test.tsx`
Expected: PASS. If it asserts an exhaustive set of nav items/tabs and now fails on the added "Performance" entry, update those assertions to include it — that is a correct expectation change, not a regression. Do NOT weaken any other assertion.

Run: `npm run typecheck`
Expected: GREEN.

- [ ] **Step 6: Full verification**

Run: `npx vitest run tests/engine tests/domain tests/core`
Expected: PASS.

Run: `npm test`
Expected: the SAME 3 pre-existing UI files failing (`app-smoke`, `CourseDashboard`, `TopicDetail`) and nothing new. `router.test`, `AppShell.test`, and `Performance.test` are green.

Note on `app-smoke`: it is already failing pre-existing. Confirm the failure set is unchanged (same 3 files) — adding a route/case must not add a 4th failing file. If `app-smoke` fails in a *new* way that traces to this wiring, treat it as a regression and fix it; if it fails identically to before, leave it (out of scope).

- [ ] **Step 7: Commit**

```bash
git add src/router.ts src/App.tsx src/shell/AppShell.tsx tests/routes/router.test.ts tests/shell/AppShell.test.tsx
git commit -m "feat(ui): wire the Performance route into nav + routing

Add the performance hash route, the App switch case, and a sidebar/tab nav
entry. Additive; existing router/shell tests updated for the new entry and
re-verified. The 3 pre-existing UI test failures are unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §17 dashboard):**
- Distinct Performance section (not cluttering retention dashboard) → new route/page, existing dashboards untouched. ✔
- Headline cards: Cold, Independent, Transfer, Performance Quality, Novel-Task Success, Performance Health → Task 1 card grid. ✔
- Diagnostic views: performance-by-difficulty, -by-novelty, prerequisite instability → Task 1 sections. (Assisted-vs-independent is surfaced via the Independent Performance card's tier count; the full assisted/lightly-assisted breakdown and the 7/30/lifetime trend charts are a deliberate v2 — the engine support (`metricTrend`, independent tiers) already exists, so they are pure UI additions later. YAGNI for v1.) ✔ / noted
- Existing dashboard remains the primary retention view → unchanged. ✔

**2. Placeholder scan:** No TBD/TODO. Every step has concrete code or an exact command. ✔

**3. Type consistency:** `Performance({ store })` matches the App switch usage and the test. View-model imports (`allReviewEvents`, `performanceSummary`, `unstablePrerequisites`, `performanceByDifficulty/Novelty`) and their result types (`DimensionBucket`, `UnstableUpstream`, and the summary's nested types) are the exact Phase 5a/3 exports. `Route` `performance` addition matches `parseHash`, the App case, and `activeFor`'s default. ✔

**4. UI-baseline safety:** the page is a new file with its own isolated test (green regardless of the 3 broken files); wiring is additive and re-verifies `router.test`/`AppShell.test`; the plan explicitly forbids modifying the broken dashboards and calls out watching the `app-smoke` failure set for a *new* failure. ✔

**5. Honest degradation:** every card uses `dash()`/explicit `'—'` for null metrics; a no-assessment store gets a dedicated empty state (not a wall of dashes). ✔
