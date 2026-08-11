# Per-course Performance scope + cross-course prerequisites — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Performance page scope its metrics (including upstream instability) to one course via a segmented selector, and let the course-construction prompt declare prerequisites that reference topics in already-tracked courses.

**Architecture:** Three independent changes. (1) Add an optional `courseId` filter to the pure, read-only `unstablePrerequisites` engine helper — it narrows which *downstream* struggling topics are considered while the *upstream* walk stays store-wide. (2) Add a cairn-styled segmented scope selector to `Performance.tsx` that switches the event source between `allReviewEvents` and `courseReviewEvents`, from which every metric already flows. (3) Convert the static `COURSE_PROMPT` template into a `coursePrompt(store)` function that relaxes the same-course prerequisite restriction and injects the existing topic list.

**Tech Stack:** TypeScript, React (function components, inline `getCairnTheme` styles on this route), Vitest + Testing Library, path alias `@/` → `src/`.

## Global Constraints

- Schema version is `"3.2.0"` — copy verbatim in any test fixture course/topic.
- The Performance layer is **read-side-only**: no function on this path may write to a topic or the store (pinned by `tests/engine/read-side-only.test.ts`). All three tasks are read-only.
- `Performance.tsx` and `AddFlow.tsx` are styled with **inline `getCairnTheme(...)` styles** (`theme.pine`, `theme.border`, `theme.shadow`, hard offset shadows), NOT the `.segmented`/design-token CSS. New UI on these routes follows that inline pattern.
- No schema or validation change is needed or permitted here — `schemas.ts:140` already accepts any well-formed `topic_` id as a prerequisite; the engine already resolves prerequisites store-wide.
- Run the full suite with `npm test`; a single file with `npx vitest run <path>`; types with `npm run typecheck`.

---

### Task 1: Engine — course-scope filter on `unstablePrerequisites`

**Files:**
- Modify: `src/engine/performance-view.ts:109-121`
- Test: `tests/engine/unstable-prerequisites.test.ts`

**Interfaces:**
- Consumes: `allTopics(store)` yields `{ topic, course }` (already used by `examPrompt`); `activeErrorCount`, `isDue`, `prerequisiteInstability` unchanged.
- Produces: `unstablePrerequisites(store: Store, now?: Date, courseId?: string): UnstableUpstream[]` — when `courseId` is set, only downstream topics whose `course.course_id === courseId` are considered; upstream resolution stays store-wide. Backward compatible (3rd param optional).

- [ ] **Step 1: Write the failing test**

Append to `tests/engine/unstable-prerequisites.test.ts` (reuses the existing `topic`, `anError` helpers and `NOW` constant already in that file):

```ts
function twoCourseStore(courseA: Topic[], courseB: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'One',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: courseA }] });
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_2', title: 'Two',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_2', title: 'S', order: 0, topics: courseB }] });
  return s;
}

describe('unstablePrerequisites course scope', () => {
  it('scopes struggling downstream topics to a course while resolving upstream store-wide', () => {
    // course_1: topic_c is struggling and depends on topic_a, which lives in course_2.
    const c = topic('topic_c', { prerequisites: ['topic_a'], error_log: [anError('error_1')] });
    // course_2: topic_a is an unstable upstream; topic_d is course_2's own struggling topic.
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, strength: 0 });
    const d = topic('topic_d', { prerequisites: ['topic_a'], error_log: [anError('error_2')] });
    const store = twoCourseStore([c], [a, d]);

    const scoped = unstablePrerequisites(store, NOW, 'course_1');
    expect(scoped.map((u) => u.topic_id)).toEqual(['topic_c']); // only course_1's downstream
    expect(scoped[0].report.unstableCount).toBeGreaterThanOrEqual(1); // upstream topic_a (course_2) resolved

    const all = unstablePrerequisites(store, NOW);
    expect(all.map((u) => u.topic_id).sort()).toEqual(['topic_c', 'topic_d']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/unstable-prerequisites.test.ts`
Expected: FAIL — the scoped call currently ignores the 3rd argument and returns both `topic_c` and `topic_d`, so `toEqual(['topic_c'])` fails.

- [ ] **Step 3: Add the `courseId` filter**

In `src/engine/performance-view.ts`, change the signature and loop of `unstablePrerequisites`:

```ts
export function unstablePrerequisites(store: Store, now: Date = new Date(), courseId?: string): UnstableUpstream[] {
  const out: UnstableUpstream[] = [];
  for (const { topic, course } of allTopics(store)) {
    if (courseId && course.course_id !== courseId) continue;
    if (!topic.prerequisites || topic.prerequisites.length === 0) continue;
    const struggling = activeErrorCount(topic) > 0 || isDue(topic, now);
    if (!struggling) continue;
    const report = prerequisiteInstability(topic, store, now);
    if (report.unstableCount > 0) {
      out.push({ topic_id: topic.topic_id, title: topic.title, report });
    }
  }
  return out;
}
```

(`prerequisiteInstability(topic, store, now)` still receives the whole `store`, so upstream stays store-wide — the cross-course resolution is unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/unstable-prerequisites.test.ts tests/engine/read-side-only.test.ts`
Expected: PASS — new scope test green, existing `unstablePrerequisites` tests and the read-side-only invariant unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/engine/performance-view.ts tests/engine/unstable-prerequisites.test.ts
git commit -m "feat(engine): course-scope filter on unstablePrerequisites

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: UI — cairn-styled scope selector on `Performance.tsx`

**Files:**
- Modify: `src/routes/Performance.tsx` (component body lines 16-80; add `SANS` const near line 8; add `ScopeTabs` component + `scopeBar`/`scopeSeg` style builders)
- Test: `tests/routes/Performance.test.tsx`

**Interfaces:**
- Consumes: `allReviewEvents(store)`, `courseReviewEvents(store, courseId)` from `@/engine/performance-view`; `unstablePrerequisites(store, now, courseId?)` from Task 1; `getCairnTheme`, `CairnTheme`; `store.courses[]` (`{ course_id, title }`).
- Produces: no new exports. Renders a `role="tablist"` with a `role="tab"` per option (`All courses` + one per course) when `store.courses.length > 1`.

- [ ] **Step 1: Write the failing test**

In `tests/routes/Performance.test.tsx`, add the userEvent import at the top and a multi-course helper + test. Add after line 2 (`import { describe, expect, it } from 'vitest';`):

```ts
import userEvent from '@testing-library/user-event';
```

Add this helper below the existing `storeOf` helper:

```ts
function storeOfCourses(courses: Array<{ id: string; title: string; topics: Topic[] }>): Store {
  const s = emptyStore();
  courses.forEach((c, i) => {
    s.courses.push({ schema_version: '3.2.0', course_id: c.id, title: c.title,
      created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
      sections: [{ section_id: `section_${i}`, title: 'S', order: 0, topics: c.topics }] });
  });
  return s;
}
```

Add these tests inside the `describe('Performance page', ...)` block:

```ts
it('scopes the metrics to the selected course', async () => {
  const user = userEvent.setup();
  const alpha = topicWith('topic_a', Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 })));
  const beta = topicWith('topic_b', [makeEvent(undefined)]); // no assessment
  render(<Performance store={storeOfCourses([
    { id: 'course_a', title: 'Alpha', topics: [alpha] },
    { id: 'course_b', title: 'Beta', topics: [beta] },
  ])} />);

  // Default "All courses": Alpha's five transfer observations aggregate to 100.
  expect(screen.getByText('100')).toBeInTheDocument();

  // Scope to Beta (no assessment data) → the 100 is gone and a scoped empty message shows.
  await user.click(screen.getByRole('tab', { name: 'Beta' }));
  expect(screen.queryByText('100')).not.toBeInTheDocument();
  expect(screen.getByText(/no performance data for this course yet/i)).toBeInTheDocument();
});

it('shows no scope selector when there is only one course', () => {
  const events = Array.from({ length: 5 }, () => makeEvent({ transfer_level: 3 }));
  render(<Performance store={storeOf(topicWith('topic_a', events))} />);
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/Performance.test.tsx`
Expected: FAIL — no `role="tab"` named "Beta" exists yet (`getByRole('tab', { name: 'Beta' })` throws).

- [ ] **Step 3: Add the `SANS` const**

In `src/routes/Performance.tsx`, below line 8 (`const SERIF = ...`) add:

```ts
const SANS = 'var(--font-sans)';
```

- [ ] **Step 4: Rewrite the component body to add scope state, source switch, selector, and scoped empty state**

Replace the current component body (lines 16-79, from `export function Performance` through its closing `}`) with:

```tsx
export function Performance({ store }: { store: Store }) {
  const { theme: mode } = useTheme();
  const theme = getCairnTheme(mode === 'dark');
  const [now] = useState(() => new Date());
  const [scope, setScope] = useState<string>('all');

  const anyAssessments = useMemo(() => allReviewEvents(store).some((e) => e.assessment), [store]);

  const events = useMemo(
    () => (scope === 'all' ? allReviewEvents(store) : courseReviewEvents(store, scope)),
    [store, scope],
  );
  const summary = useMemo(() => performanceSummary(events), [events]);
  const byDifficulty = useMemo(() => performanceByDifficulty(events), [events]);
  const byNovelty = useMemo(() => performanceByNovelty(events), [events]);
  const unstable = useMemo(
    () => unstablePrerequisites(store, now, scope === 'all' ? undefined : scope),
    [store, now, scope],
  );

  if (!anyAssessments) {
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

  const scopeOptions = [
    { value: 'all', label: 'All courses' },
    ...store.courses.map((c) => ({ value: c.course_id, label: c.title })),
  ];
  const hasAssessments = events.some((e) => e.assessment);

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
      <p style={{ fontSize: '15px', color: theme.muted, maxWidth: '560px', margin: '0 0 20px' }}>
        How effectively you can use what you know — independent application, transfer, and
        performance at rising difficulty and novelty. Separate from retention.
      </p>

      {store.courses.length > 1 && (
        <ScopeTabs options={scopeOptions} value={scope} onChange={setScope} theme={theme} />
      )}

      {!hasAssessments ? (
        <p style={{ fontSize: '14px', color: theme.muted, maxWidth: '520px' }}>
          No performance data for this course yet.
        </p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function ScopeTabs({ options, value, onChange, theme }: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  theme: CairnTheme;
}) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    if (next) onChange(next.value);
  };
  return (
    <div role="tablist" aria-label="Course scope" style={scopeBar(theme)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
            }}
            style={scopeSeg(theme, active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Add the two style builders**

At the end of `src/routes/Performance.tsx` (with the other `function …(t: CairnTheme): CSSProperties` builders), add:

```ts
function scopeBar(t: CairnTheme): CSSProperties {
  return { display: 'inline-flex', flexWrap: 'wrap', gap: '4px', padding: '4px', marginBottom: '28px', background: t.bg, border: `2px solid ${t.border}`, borderRadius: '9999px', boxShadow: `2px 2px 0 ${t.shadow}` };
}
function scopeSeg(t: CairnTheme, active: boolean): CSSProperties {
  return { border: 'none', borderRadius: '9999px', padding: '7px 16px', fontFamily: SANS, fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: active ? t.pine : 'transparent', color: active ? t.onAccent : t.muted };
}
```

- [ ] **Step 6: Run tests + typecheck to verify they pass**

Run: `npx vitest run tests/routes/Performance.test.tsx && npm run typecheck`
Expected: PASS — scope test green, single-course test confirms no `tablist`, existing three tests unchanged, types clean.

- [ ] **Step 7: Commit**

```bash
git add src/routes/Performance.tsx tests/routes/Performance.test.tsx
git commit -m "feat(ui): per-course scope selector on the Performance page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Prompt — `coursePrompt(store)` with cross-course prerequisites

**Files:**
- Modify: `src/domain/prompts.ts:32-54` (replace `export const COURSE_PROMPT` with `export function coursePrompt(store)`)
- Modify: `src/routes/AddCourse.tsx:5,46`
- Modify: `src/routes/AddFlow.tsx:5,87,91,95`
- Test: `tests/domain/prompts.test.ts:2,45-47`
- Test: `tests/components/PasteValidateInput.test.tsx:5,43`

**Interfaces:**
- Consumes: `allTopics(store)` yields `{ topic, course }`; `Store` type.
- Produces: `coursePrompt(store: Store): string` (replaces the `COURSE_PROMPT` const). Contains the literal `prerequisites`; when the store has topics, embeds each existing `topic_id` so it can be cited as a cross-course prerequisite.

- [ ] **Step 1: Update the seam test to the new signature (failing)**

In `tests/domain/prompts.test.ts`, change the import on line 2 from `COURSE_PROMPT` to `coursePrompt`:

```ts
import { coursePrompt, sessionPrompt, examPrompt, coldAssessmentPrompt } from '@/domain/prompts';
```

Replace the course-prompt test (lines 45-47) with:

```ts
it('the course prompt asks for prerequisites and lists existing topics for cross-course dependencies', () => {
  const p = coursePrompt(storeWithTopic());
  expect(p).toContain('prerequisites');
  expect(p).toContain('topic_1'); // existing topic injected so it can be cited as a prerequisite
});

it('the course prompt still works when no other courses exist', () => {
  const p = coursePrompt(emptyStore());
  expect(p).toContain('prerequisites');
});
```

(`emptyStore` is already imported on line 3 of that file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/prompts.test.ts`
Expected: FAIL — `coursePrompt` is not exported yet (import/type error).

- [ ] **Step 3: Replace `COURSE_PROMPT` with `coursePrompt(store)`**

In `src/domain/prompts.ts`, replace the entire `export const COURSE_PROMPT = \`...\`;` block (lines 32-54) with:

```ts
export function coursePrompt(store: Store): string {
  const existing = allTopics(store)
    .map(({ topic, course }) => `${topic.topic_id} → ${topic.title} (${course.title})`)
    .join('\n');
  const crossCourseBlock = existing
    ? `\n\nEXISTING topics already in the tracker — you MAY cite any of these topic_ids as a prerequisite when this new course genuinely builds on that already-tracked material. Do NOT redefine them; only reference their ids.\n${existing}`
    : '';

  return `You are converting a course syllabus into a structured JSON object for a study tracker. Output only valid JSON matching this exact schema — no markdown fences, no commentary, no extra fields.

Schema (v3.2.0):
- Root: {schema_version, course_id, title, created_at, source, sections[]}
- schema_version: always "3.2.0".
- course_id: generate as course_ followed by a random 10-character alphanumeric string.
- created_at: ISO 8601 UTC, now.
- source: always "ai_generated".
- Each section: {section_id, title, order, topics[]}. section_id follows the same random-suffix pattern with prefix section_. order is 0-indexed.
- Each topic: {topic_id, title, status, conf, strength, k_factor, cards, last_reviewed, drift_history, review_history, error_log, prerequisites}.
  - topic_id: prefix topic_.
  - status: always "not_started" for a fresh syllabus.
  - conf: always 1. (Confidence is a 1-5 scale, not a percentage.)
  - strength: always 0.
  - k_factor: always 8.4.
  - cards: always 0.
  - last_reviewed: always null.
  - drift_history, review_history, error_log: always empty arrays [].
  - prerequisites: OPTIONAL array of topic_id values this topic depends on — the upstream concepts to master first. Reference topic_ids you define in THIS course, and/or any id from the EXISTING topics listed below when this course builds on already-tracked material. Use [] or omit if none. This lets the tracker trace whether errors in a topic stem from shaky foundations upstream.

Break the syllabus into sections matching its natural structure (chapters/weeks/units), and topics matching individual concepts/skills within each section — granular enough that a topic represents something masterable in a single study session, not an entire chapter. Where the syllabus implies a dependency (B builds on A), record it in B's prerequisites — including when A is an already-tracked topic listed below.${crossCourseBlock}

Here is the syllabus: [PASTE SYLLABUS HERE]`;
}
```

(`Store` and `allTopics` are already imported at the top of `prompts.ts`.)

- [ ] **Step 4: Run the seam test to verify it passes**

Run: `npx vitest run tests/domain/prompts.test.ts`
Expected: PASS — both course-prompt tests green.

- [ ] **Step 5: Update `AddCourse.tsx`**

`src/routes/AddCourse.tsx` line 5:

```ts
import { coursePrompt } from '@/domain/prompts';
```

Line 46 (the `PasteValidateInput` prop):

```tsx
            prompt={coursePrompt(store)}
```

- [ ] **Step 6: Update `AddFlow.tsx`**

`src/routes/AddFlow.tsx` line 5 — swap `COURSE_PROMPT` for `coursePrompt`:

```ts
import { coldAssessmentPrompt, coursePrompt, examPrompt, sessionPrompt } from '@/domain/prompts';
```

Then the three `COURSE_PROMPT` uses in `promptFor` (lines 87, 91, 95) become `coursePrompt(store)`:

```tsx
    if (kind === 'course') return coursePrompt(store);
    if (kind === 'exam') return examCold ? coldAssessmentPrompt(store) : examPrompt(store);
    if (kind === 'session') {
      const course = store.courses.find((c) => c.course_id === courseId) ?? store.courses[0];
      if (!course) return coursePrompt(store);
      const topics = courseTopics(course).map((r) => ({ topic_id: r.topic.topic_id, title: r.topic.title }));
      return sessionPrompt(course.course_id, topics);
    }
    return coursePrompt(store);
```

- [ ] **Step 7: Update `PasteValidateInput.test.tsx`**

`tests/components/PasteValidateInput.test.tsx` line 5:

```ts
import { coursePrompt } from '@/domain/prompts';
```

Line 43 (the `prompt` prop in `setup`):

```tsx
      prompt={coursePrompt(emptyStore())}
```

(`emptyStore` is already imported on line 6 of that file.)

- [ ] **Step 8: Run affected tests + typecheck**

Run: `npx vitest run tests/domain/prompts.test.ts tests/components/PasteValidateInput.test.tsx && npm run typecheck`
Expected: PASS — no remaining reference to `COURSE_PROMPT` anywhere; types clean.

- [ ] **Step 9: Full suite**

Run: `npm test`
Expected: PASS — whole suite green, no regressions.

- [ ] **Step 10: Commit**

```bash
git add src/domain/prompts.ts src/routes/AddCourse.tsx src/routes/AddFlow.tsx tests/domain/prompts.test.ts tests/components/PasteValidateInput.test.tsx
git commit -m "feat(prompts): coursePrompt injects existing topics for cross-course prerequisites

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Part A control (segmented, default All, all courses listed) → Task 2 (`ScopeTabs`, `scopeOptions` with `All courses` + every course, `scope` defaults to `'all'`). Cairn-styled inline per the Global Constraints note rather than the design-token `.segmented`; same UX.
- Part A scoping (source swap; all metrics follow) → Task 2 `events` useMemo + downstream `summary`/`byDifficulty`/`byNovelty`.
- Part A Option B upstream filter (downstream scoped, upstream store-wide, read-only) → Task 1.
- Part A empty states (global no-selector vs. scoped message) → Task 2 (`anyAssessments` guard returns early with no selector; `hasAssessments` gates the scoped "No performance data for this course yet." message).
- Part B convert to `coursePrompt(store)`, relax restriction, inject existing topics → Task 3 Step 3.
- Part B consumer + test updates → Task 3 Steps 5-7 (`AddCourse`, `AddFlow`, `prompts.test`, `PasteValidateInput.test`).
- Non-goals (per-section scoping, trend charts, calibration, backfill) → untouched.

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full content.

**Type consistency:** `unstablePrerequisites(store, now?, courseId?)` defined in Task 1 and called with all three args in Task 2. `coursePrompt(store: Store): string` defined in Task 3 Step 3 and called with `store` (AddCourse/AddFlow) and `emptyStore()`/`storeWithTopic()` (tests) — all `Store`. `ScopeTabs` props match its call site. `SANS`, `scopeBar`, `scopeSeg`, `CairnTheme` all defined within Task 2's file edits.

**One refinement beyond the spec (low-risk, noted):** the selector is hidden when `store.courses.length < 2` — with a single course, "All" and that course are identical, so the control would be redundant noise. Covered by the "shows no scope selector when there is only one course" test.
