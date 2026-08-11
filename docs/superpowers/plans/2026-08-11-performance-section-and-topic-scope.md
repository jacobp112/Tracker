# Per-Section & Per-Topic Performance Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Performance page with a course→section scope drill-down (piece A), and add a raw per-topic "Assessment diagnostics" card to the TopicDetail drawer (piece B).

**Architecture:** Two small read-only engine view-model helpers in `src/engine/performance-view.ts` composed from functions that already exist, then two presentation-only UI changes. Piece A adds `sectionReviewEvents(store, courseId, sectionId)` and a second radiogroup on `Performance.tsx`. Piece B adds `topicDiagnostics(events)` — a deliberately **unguarded** raw view (it bypasses the headline min-N guards, which exist to protect the global dashboard number, not a single topic's diagnostics) — and a card in `TopicDetail.tsx`. No engine metric math changes, no schema change, no writes.

**Tech Stack:** React + TypeScript, inline `CSSProperties` style builders (existing route pattern), Vitest + Testing Library, `getCairnTheme` / `CairnTheme` design tokens.

## Global Constraints

- **READ-SIDE-ONLY:** never write to the store; never modify the existing metric functions in `src/engine/performance.ts` or `src/engine/metrics.ts`. New helpers only *read* events and *compose* existing pure functions. `tests/engine/read-side-only.test.ts` must stay green.
- **Honest nulls:** every metric/diagnostic value is `number | null`; render `null` as an em dash `—`, never `0`. Piece B deliberately shows *raw* values at low N (where the guarded composites would read `—`), but a genuinely absent value is still `—`, never a false `0`.
- **Section lookup is course-qualified:** `section_id`s come from tutor/manual JSON and are NOT guaranteed unique across courses. `sectionReviewEvents` must take BOTH `courseId` and `sectionId` and resolve the section *within* that course.
- **Design tokens only:** all colors/typography from `CairnTheme` tokens (`theme.ink`, `theme.muted`, `theme.border`, `theme.surface`, `theme.surfaceAlt`, `theme.pine`, …) + the existing `SERIF`/`SANS` constants in each file. No hardcoded hex.
- **Suite baseline:** `npm run typecheck` clean; `npm test` = 92 files / 600 pass / 1 skipped / 0 fail. Nothing green today may regress.

---

### Task 1: `sectionReviewEvents` engine helper

**Files:**
- Modify: `src/engine/performance-view.ts`
- Test: `tests/engine/performance-summary.test.ts`

**Interfaces:**
- Consumes: `Store`, `ReviewEvent` from `@/domain/types` (already imported in the file).
- Produces: `sectionReviewEvents(store: Store, courseId: string, sectionId: string): ReviewEvent[]`

- [ ] **Step 1: Write the failing tests**

Add to `tests/engine/performance-summary.test.ts`. First extend the top import:
```ts
import { allReviewEvents, courseReviewEvents, sectionReviewEvents, performanceSummary } from '@/engine/performance-view';
```
Add this store builder below the existing `storeOf` helper (it builds a course with two named sections):
```ts
function storeOfSections(): Store {
  const s = emptyStore();
  s.courses.push({
    schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [
      { section_id: 'section_1', title: 'Intro', order: 0, topics: [topicWith('topic_a', [makeEvent({ difficulty: 1 })])] },
      { section_id: 'section_2', title: 'Advanced', order: 1, topics: [topicWith('topic_b', [makeEvent({ difficulty: 2 }), makeEvent({ difficulty: 3 })])] },
    ],
  });
  return s;
}
```
Add these tests inside the existing `describe('event flattening', …)` block:
```ts
it('sectionReviewEvents scopes to one section within its course', () => {
  const store = storeOfSections();
  expect(sectionReviewEvents(store, 'course_1', 'section_1')).toHaveLength(1);
  expect(sectionReviewEvents(store, 'course_1', 'section_2')).toHaveLength(2);
});
it('sectionReviewEvents is empty for an unknown course or section id', () => {
  const store = storeOfSections();
  expect(sectionReviewEvents(store, 'course_missing', 'section_1')).toEqual([]);
  expect(sectionReviewEvents(store, 'course_1', 'section_missing')).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/performance-summary.test.ts -t "sectionReviewEvents"`
Expected: FAIL — `sectionReviewEvents` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/engine/performance-view.ts`, directly after `courseReviewEvents` (around line 39):
```ts
/** Every review event within one section of one course (empty if either id
 *  doesn't resolve). Scoped by BOTH ids: section_ids are not guaranteed unique
 *  across courses (tutor/manual JSON), so the section is resolved within its
 *  course, mirroring courseReviewEvents one level deeper. */
export function sectionReviewEvents(store: Store, courseId: string, sectionId: string): ReviewEvent[] {
  const course = store.courses.find((c) => c.course_id === courseId);
  const section = course?.sections.find((s) => s.section_id === sectionId);
  if (!section) return [];
  return section.topics.flatMap((t) => t.review_history);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/performance-summary.test.ts`
Expected: PASS (all, existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance-view.ts tests/engine/performance-summary.test.ts
git commit -m "feat(engine): sectionReviewEvents — course-qualified section event scope"
```

---

### Task 2: `topicDiagnostics` engine helper

**Files:**
- Modify: `src/engine/performance-view.ts`
- Test: `tests/engine/topic-diagnostics.test.ts` (new)

**Interfaces:**
- Consumes (already exported from `@/engine/performance`): `independentPerformance`, `performanceByDifficulty`, `performanceByNovelty`, `normalizedPresentMean`, `type DimensionBucket`. And `CONFIG` from `@/config/constants` (already imported in `performance-view.ts`).
- Produces:
  ```ts
  export interface TopicDiagnostics {
    assessedCount: number;              // events carrying an assessment block
    independentAccuracy: number | null; // 0–1, raw (no min-N guard)
    independentN: number;               // count of independent (===3) attempts
    difficulty: DimensionBucket[];      // independent-only spread
    novelty: DimensionBucket[];         // independent-only spread
    avgTransfer: number | null;         // 0–100, raw
    avgQuality: number | null;          // 0–100, raw
  }
  export function topicDiagnostics(events: ReviewEvent[]): TopicDiagnostics
  ```

**Design notes:**
- `independentPerformance(events)` returns `null` only when NO event carries an independence value; when non-null, `.independent` is a `TierStats { n, accuracy, avgDifficulty, avgNovelty }` where `accuracy` is a raw mean (no min-N) and `n` is the independent-attempt count. Use `?.independent ?? null`.
- `avgTransfer`/`avgQuality` reuse `normalizedPresentMean(events, pick, max)` (returns a 0–1 mean or null) × 100. This is the raw, unguarded mean — the whole point of the drawer diagnostics.
- This is pure assembly of existing pure functions; add NO new metric math.

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/topic-diagnostics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { topicDiagnostics } from '@/engine/performance-view';
import { makeEvent } from './assessment-fixtures';

describe('topicDiagnostics — raw, unguarded per-topic view', () => {
  it('surfaces raw independent accuracy and transfer/quality below the headline min-N (would be null in the guarded composites)', () => {
    // Two independent (===3) attempts, each a full pass, carrying transfer + quality.
    const events = [
      makeEvent({ independence: 3, difficulty: 4, novelty: 3, transfer_level: 3, performance_quality: 4 }, { test: { score: 10, out_of: 10 } }),
      makeEvent({ independence: 3, difficulty: 5, novelty: 4, transfer_level: 3, performance_quality: 4 }, { test: { score: 8, out_of: 10 } }),
    ];
    const d = topicDiagnostics(events);
    expect(d.assessedCount).toBe(2);
    expect(d.independentN).toBe(2);
    expect(d.independentAccuracy).toBeCloseTo(0.9); // mean(1.0, 0.8)
    expect(d.avgTransfer).toBeCloseTo(100);         // transfer 3/3 → 100
    expect(d.avgQuality).toBeCloseTo(80);           // quality 4/5 → 80
    expect(d.difficulty.length).toBeGreaterThan(0); // independent-only spread present
    expect(d.novelty.length).toBeGreaterThan(0);
  });

  it('returns honest zeros/nulls/empties when there is no assessment data', () => {
    const events = [makeEvent(undefined)]; // a bare review_history event, no assessment
    const d = topicDiagnostics(events);
    expect(d.assessedCount).toBe(0);
    expect(d.independentAccuracy).toBeNull();
    expect(d.independentN).toBe(0);
    expect(d.avgTransfer).toBeNull();
    expect(d.avgQuality).toBeNull();
    expect(d.difficulty).toEqual([]);
    expect(d.novelty).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/topic-diagnostics.test.ts`
Expected: FAIL — `topicDiagnostics` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/engine/performance-view.ts`, extend the existing import from `./performance`:
```ts
import {
  calibrationError,
  coldPerformance,
  independentPerformance,
  novelTaskSuccess,
  normalizedPresentMean,
  performanceByDifficulty,
  performanceByNovelty,
  performanceHealth,
  performanceQuality,
  transferAbility,
  type Calibration,
  type ColdPerformance,
  type DimensionBucket,
  type IndependentPerformance,
  type NovelTaskSuccess,
  type QualityScore,
  type TransferAbility,
} from './performance';
```
(Keep whatever of these were already imported; add `independentPerformance`, `normalizedPresentMean`, `performanceByDifficulty`, `performanceByNovelty`, and `type DimensionBucket`.)

Add near the other view-model exports (e.g. after `performanceSummary`):
```ts
export interface TopicDiagnostics {
  assessedCount: number;
  independentAccuracy: number | null; // 0–1, raw (no min-N guard)
  independentN: number;
  difficulty: DimensionBucket[];
  novelty: DimensionBucket[];
  avgTransfer: number | null; // 0–100, raw
  avgQuality: number | null;  // 0–100, raw
}

/** Raw, UNGUARDED per-topic assessment diagnostics for the TopicDetail drawer.
 *  Deliberately bypasses the headline min-N guards — those protect the global
 *  dashboard number, not one topic's diagnostics — so a topic with 1–2 assessed
 *  attempts still surfaces its spread and raw means. Pure read; never writes. */
export function topicDiagnostics(events: ReviewEvent[]): TopicDiagnostics {
  const indep = independentPerformance(events)?.independent ?? null;
  const transfer = normalizedPresentMean(events, (e) => e.assessment?.transfer_level, CONFIG.PERFORMANCE.TRANSFER_MAX);
  const quality = normalizedPresentMean(events, (e) => e.assessment?.performance_quality, CONFIG.PERFORMANCE.QUALITY_MAX);
  return {
    assessedCount: events.filter((e) => e.assessment).length,
    independentAccuracy: indep?.accuracy ?? null,
    independentN: indep?.n ?? 0,
    difficulty: performanceByDifficulty(events),
    novelty: performanceByNovelty(events),
    avgTransfer: transfer === null ? null : transfer * 100,
    avgQuality: quality === null ? null : quality * 100,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/topic-diagnostics.test.ts`
Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance-view.ts tests/engine/topic-diagnostics.test.ts
git commit -m "feat(engine): topicDiagnostics — raw unguarded per-topic assessment view"
```

---

### Task 3: Course→section scope drill-down on `Performance.tsx`

**Files:**
- Modify: `src/routes/Performance.tsx`
- Test: `tests/routes/Performance.test.tsx`

**Interfaces:**
- Consumes: `sectionReviewEvents` (Task 1), plus existing `allReviewEvents`, `courseReviewEvents`, `unstablePrerequisites`.

**Design notes:**
- Replace the single `scope` state with two: `courseScope` ('all' | courseId) and `sectionScope` ('all' | sectionId). Selecting a course resets `sectionScope` to 'all'.
- Support section scoping even for a **single-course** store (where the top-level course selector is hidden): compute an `effectiveCourseId` = the sole course's id when there's exactly one course, else `courseScope` when a specific course is selected, else `null`.
- Section selector shows only when the effective course exists AND has >1 section — mirroring how the course selector hides for single-course stores.
- Keep `unstablePrerequisites` course-scoped (section-level prereq filtering is out of scope).
- The `ScopeSelector` sub-component currently hardcodes `aria-label="Course scope"`. Parameterize it with a `label` prop so the two radiogroups have distinct accessible names.
- The scoped-empty copy currently reads "No performance data for this course yet." Generalize to "No performance data for this selection yet." (covers course and section) — this changes an existing test assertion; update it (see Step 5).

- [ ] **Step 1: Write the failing tests**

In `tests/routes/Performance.test.tsx`, add a two-section store builder near the other builders:
```ts
function storeOfSections(sections: Array<{ id: string; title: string; topics: Topic[] }>): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: sections.map((sec, i) => ({ section_id: sec.id, title: sec.title, order: i, topics: sec.topics })) });
  return s;
}
```
Add this describe block:
```ts
describe('Performance section scope', () => {
  it('shows a section selector for a multi-section course and scopes to the chosen section', async () => {
    const user = userEvent.setup();
    // Intro section has 5 transfer obs (→ Transfer Ability 100); Advanced has none.
    const intro = topicWith('topic_a', Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 })));
    const advanced = topicWith('topic_b', [makeEvent(undefined)]);
    render(<Performance store={storeOfSections([
      { id: 'section_1', title: 'Intro', topics: [intro] },
      { id: 'section_2', title: 'Advanced', topics: [advanced] },
    ])} />);

    // Sole course → section selector is visible immediately (Whole course + both sections).
    expect(screen.getByRole('radio', { name: 'Whole course' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Intro' })).toBeInTheDocument();
    // Whole course aggregates Intro's five transfer obs → 100 present.
    expect(screen.getByText('100')).toBeInTheDocument();

    // Scope to Advanced (no data) → 100 gone, scoped-empty message shows.
    await user.click(screen.getByRole('radio', { name: 'Advanced' }));
    expect(screen.queryByText('100')).not.toBeInTheDocument();
    expect(screen.getByText(/no performance data for this selection yet/i)).toBeInTheDocument();

    // Scope to Intro → 100 returns.
    await user.click(screen.getByRole('radio', { name: 'Intro' }));
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('shows no section selector for a single-section course', () => {
    const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
    render(<Performance store={storeOfSections([{ id: 'section_1', title: 'Only', topics: [topicWith('topic_a', events)] }])} />);
    expect(screen.queryByRole('radio', { name: 'Whole course' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/routes/Performance.test.tsx -t "section scope"`
Expected: FAIL — no section selector exists.

- [ ] **Step 3: Implement the scope drill-down**

In `src/routes/Performance.tsx`:

1. Add the import:
```ts
import { allReviewEvents, courseReviewEvents, sectionReviewEvents, metricTrend, performanceSummary, unstablePrerequisites, type UnstableUpstream } from '@/engine/performance-view';
```

2. Replace the single scope state (`const [scope, setScope] = useState<string>('all');`) with:
```ts
const [courseScope, setCourseScope] = useState<string>('all');
const [sectionScope, setSectionScope] = useState<string>('all');
const selectCourse = (v: string) => { setCourseScope(v); setSectionScope('all'); };

const soleCourse = store.courses.length === 1 ? store.courses[0] : null;
const effectiveCourseId = soleCourse ? soleCourse.course_id : (courseScope === 'all' ? null : courseScope);
const effectiveCourse = effectiveCourseId ? store.courses.find((c) => c.course_id === effectiveCourseId) ?? null : null;
```

3. Replace the `events` memo:
```ts
const events = useMemo(() => {
  if (sectionScope !== 'all' && effectiveCourseId) return sectionReviewEvents(store, effectiveCourseId, sectionScope);
  if (courseScope !== 'all') return courseReviewEvents(store, courseScope);
  return allReviewEvents(store);
}, [store, courseScope, sectionScope, effectiveCourseId]);
```

4. Replace the `unstable` memo's courseId arg to use `effectiveCourseId`:
```ts
const unstable = useMemo(
  () => unstablePrerequisites(store, now, effectiveCourseId ?? undefined),
  [store, now, effectiveCourseId],
);
```

5. Build the section options and render a second selector. Replace the existing course-selector render block:
```tsx
{store.courses.length > 1 && (
  <ScopeSelector label="Course scope" options={scopeOptions} value={courseScope} onChange={selectCourse} theme={theme} />
)}
```
and immediately after it add:
```tsx
{effectiveCourse && effectiveCourse.sections.length > 1 && (
  <ScopeSelector
    label="Section scope"
    options={[
      { value: 'all', label: 'Whole course' },
      ...[...effectiveCourse.sections].sort((a, b) => a.order - b.order).map((s) => ({ value: s.section_id, label: s.title })),
    ]}
    value={sectionScope}
    onChange={setSectionScope}
    theme={theme}
  />
)}
```
(Keep the existing `scopeOptions` definition for the course selector: `const scopeOptions = [{ value: 'all', label: 'All courses' }, ...store.courses.map((c) => ({ value: c.course_id, label: c.title }))];`.)

6. Parameterize `ScopeSelector`'s aria-label. Change its signature and the `role="radiogroup"` element:
```tsx
function ScopeSelector({ options, value, onChange, theme, label }: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  theme: CairnTheme;
  label: string;
}) {
```
and
```tsx
<div role="radiogroup" aria-label={label} style={scopeBar(theme)}>
```

7. Generalize the scoped-empty copy:
```tsx
<p style={{ fontSize: '14px', color: theme.muted, maxWidth: '520px' }}>
  No performance data for this selection yet.
</p>
```

- [ ] **Step 4: Run the section tests to verify they pass**

Run: `npx vitest run tests/routes/Performance.test.tsx -t "section scope"`
Expected: PASS (both).

- [ ] **Step 5: Fix the existing test the copy change touches, then run the whole file**

The existing test "scopes the metrics to the selected course" (around `Performance.test.tsx:73`) asserts `/no performance data for this course yet/i`. The copy is now generalized. Update that one assertion to `/no performance data for this selection yet/i`. This is a correct consequence of the copy change, not a workaround — do not revert the copy.

Run: `npm run typecheck && npx vitest run tests/routes/Performance.test.tsx`
Expected: typecheck clean; all Performance page tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/routes/Performance.tsx tests/routes/Performance.test.tsx
git commit -m "feat(ui): course→section scope drill-down on Performance"
```

---

### Task 4: "Assessment diagnostics" card in `TopicDetail.tsx`

**Files:**
- Modify: `src/routes/TopicDetail.tsx`
- Test: `tests/routes/TopicDetail.test.tsx`

**Interfaces:**
- Consumes: `topicDiagnostics`, `type TopicDiagnostics` (Task 2). `DimensionBucket` type is re-exported through `topicDiagnostics`'s fields; import the value function and its interface from `@/engine/performance-view`.

**Design notes:**
- Compute `const diag = t ? topicDiagnostics(t.review_history) : null;` alongside the other derived values (near line 91).
- Render a new card ONLY when `diag && diag.assessedCount > 0` — topics with no assessment data stay uncluttered.
- Placement: after the badges block (`TopicDetail.tsx:259-267`), before the "Review history" `<h3>` (line 270).
- Reuse the drawer's existing style idioms: a `theme.surfaceAlt` card, the `sectionLabel` builder for the heading, `SERIF` for numeric values.
- Rows:
  - **Independent accuracy** — `{independentN === 0 ? '—' : `${Math.round(independentAccuracy*100)}% · n=${independentN}`}` (guard: `independentAccuracy` is null exactly when `independentN === 0`).
  - **Difficulty** / **Novelty** spreads — render each only if its array is non-empty; one compact row per bucket: `D{level}`  a mini bar (`successRate`)  `{passes-as-rate}% · n={n}` (`—%` when `successRate === null`). Write a small local `SpreadRow` renderer; do NOT import the private `DimensionSection` from `Performance.tsx`.
  - **Transfer / Quality** — a two-value row: `Transfer {avgTransfer===null?'—':Math.round(avgTransfer)} · Quality {avgQuality===null?'—':Math.round(avgQuality)}`.

- [ ] **Step 1: Write the failing tests**

In `tests/routes/TopicDetail.test.tsx`, extend imports:
```ts
import { makeEvent } from '../engine/assessment-fixtures';
import type { ReviewEvent } from '@/domain/types';
```
Add an assessed-topic fixture and tests:
```ts
function assessedTopic(events: ReviewEvent[]): Topic {
  return { ...masteredTopic(), topic_id: 't2', title: 'Recursion', review_history: events };
}

describe('TopicDetail — assessment diagnostics', () => {
  it('shows the diagnostics card with raw values for an assessed topic', () => {
    const events = [
      makeEvent({ independence: 3, difficulty: 4, novelty: 3, transfer_level: 3, performance_quality: 4 }, { test: { score: 10, out_of: 10 } }),
      makeEvent({ independence: 3, difficulty: 5, novelty: 4, transfer_level: 3, performance_quality: 4 }, { test: { score: 8, out_of: 10 } }),
    ];
    render(
      <TopicDetail topic={assessedTopic(events)} sectionTitle="Core"
        onClose={() => {}} onResolveError={() => {}} onPromote={() => {}} onQuickReview={() => {}} now={NOW} />,
    );
    expect(screen.getByText(/assessment diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/n=2/i)).toBeInTheDocument();          // independent accuracy row
    expect(screen.getByText(/transfer/i)).toBeInTheDocument();     // transfer/quality row
  });

  it('omits the diagnostics card for a topic with no assessment data', () => {
    // masteredTopic()'s single event has a `test` block but no `assessment`.
    render(
      <TopicDetail topic={masteredTopic()} sectionTitle="Core"
        onClose={() => {}} onResolveError={() => {}} onPromote={() => {}} onQuickReview={() => {}} now={NOW} />,
    );
    expect(screen.queryByText(/assessment diagnostics/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/routes/TopicDetail.test.tsx -t "diagnostics"`
Expected: FAIL — the "Assessment diagnostics" card doesn't exist.

- [ ] **Step 3: Implement the card**

In `src/routes/TopicDetail.tsx`:

1. Add the import:
```ts
import { topicDiagnostics, type TopicDiagnostics } from '@/engine/performance-view';
import type { DimensionBucket } from '@/engine/performance';
```

2. Compute the diagnostics near the other derived values (after `const topicBadges = …`, ~line 92):
```ts
const diag = t ? topicDiagnostics(t.review_history) : null;
```

3. Insert the card between the badges block and the "Review history" heading (after line 267, before line 269's `{/* Review history */}`):
```tsx
{diag && diag.assessedCount > 0 && <DiagnosticsCard diag={diag} theme={theme} />}
```

4. Add the component and a compact spread renderer near the other module-scope components (below the main export, above the style builders):
```tsx
function DiagnosticsCard({ diag, theme }: { diag: TopicDiagnostics; theme: CairnTheme }) {
  const acc = diag.independentN === 0 || diag.independentAccuracy === null
    ? '—'
    : `${Math.round(diag.independentAccuracy * 100)}% · n=${diag.independentN}`;
  const stat = (v: number | null) => (v === null ? '—' : String(Math.round(v)));
  return (
    <div style={{ background: theme.surfaceAlt, border: `2px solid ${theme.border}`, borderRadius: '16px', padding: '16px 18px', marginBottom: '18px' }}>
      <p style={sectionLabel(theme)}>Assessment diagnostics</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', color: theme.muted }}>Independent accuracy</span>
        <span style={{ fontFamily: SERIF, fontSize: '18px', color: theme.ink }}>{acc}</span>
      </div>

      {diag.difficulty.length > 0 && <Spread label="Difficulty" buckets={diag.difficulty} theme={theme} />}
      {diag.novelty.length > 0 && <Spread label="Novelty" buckets={diag.novelty} theme={theme} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
        <span style={{ fontSize: '13px', color: theme.muted }}>Transfer · Quality</span>
        <span style={{ fontFamily: SERIF, fontSize: '18px', color: theme.ink }}>{stat(diag.avgTransfer)} · {stat(diag.avgQuality)}</span>
      </div>
    </div>
  );
}

function Spread({ label, buckets, theme }: { label: string; buckets: DimensionBucket[]; theme: CairnTheme }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: theme.muted, margin: '6px 0 6px' }}>{label}</p>
      {buckets.map((b) => {
        const rate = b.successRate === null ? null : Math.round(b.successRate * 100);
        return (
          <div key={b.level} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 0' }}>
            <span style={{ width: '42px', fontSize: '12px', color: theme.ink }}>L{b.level}</span>
            <div style={{ flex: 1, height: '8px', borderRadius: '9999px', background: theme.surface, overflow: 'hidden' }}>
              <div style={{ width: `${rate ?? 0}%`, height: '100%', background: theme.pine, borderRadius: '9999px' }} />
            </div>
            <span style={{ width: '72px', textAlign: 'right', fontSize: '12px', color: theme.muted }}>
              {rate === null ? '—' : `${rate}%`} · n={b.n}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the diagnostics tests to verify they pass**

Run: `npx vitest run tests/routes/TopicDetail.test.tsx`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/routes/TopicDetail.tsx tests/routes/TopicDetail.test.tsx
git commit -m "feat(ui): raw Assessment diagnostics card in TopicDetail drawer"
```

---

### Task 5: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; `npm test` → 92 files, 606+ pass (≈6 new tests added across Tasks 1–4), 1 skipped, 0 fail. `tests/engine/read-side-only.test.ts`, `tests/shell/AppShell.test.tsx`, `tests/routes/router.test.ts` must stay green.

- [ ] **Step 2: If anything unexpected fails, stop and diagnose**

Use superpowers:systematic-debugging for any non-obvious failure. The only *expected* churn is the one copy-assertion update in Task 3 Step 5.

---

## Self-Review

**1. Spec coverage:** Piece A (section scoping) → Tasks 1 + 3. Piece B (per-topic diagnostics) → Tasks 2 + 4. Both engine helpers are read-only compositions; both UI changes are presentation-only. ✔

**2. Placeholder scan:** No TBD/TODO. Every code step gives exact code, imports, and placement anchors. ✔

**3. Type consistency:** `sectionReviewEvents(store, courseId, sectionId)` and `topicDiagnostics(events): TopicDiagnostics` are defined in Tasks 1–2 and consumed with the same signatures in Tasks 3–4. `TopicDiagnostics` field names (`assessedCount`, `independentAccuracy`, `independentN`, `difficulty`, `novelty`, `avgTransfer`, `avgQuality`) are used verbatim in Task 4. `DimensionBucket` (`level`, `n`, `successRate`) matches `src/engine/performance.ts`. `ScopeSelector` gains a required `label` prop, and both call sites pass it. ✔

**4. Read-only invariant:** No task modifies `src/engine/performance.ts` / `metrics.ts` internals; new helpers only compose existing pure functions and read events. `read-side-only.test.ts` is unaffected. ✔

**5. Branch note:** Work on a feature branch `feat/performance-section-and-topic-scope` off local `main`, per repo convention. Merge back with `--no-ff` when green. Local `main` is ahead of `origin/main` (unpushed) — do not push unless asked.
