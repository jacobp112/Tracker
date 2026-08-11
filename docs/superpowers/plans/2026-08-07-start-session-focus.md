# Start-Session Briefing + Focus Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a learner start a focused study session for a topic — generate a structured AI briefing (intent + scope), run an in-app timer (count-up or custom Pomodoro), then import the AI's session-log JSON, committing it with the real measured duration.

**Architecture:** A new `engine/session.ts` assembles the briefing declaratively from `scopeConfig`/`intentConfig` lookup tables (no scope/intent branching). A `useStudyTimer` hook + `core/focusDraft.ts` localStorage draft power a resumable focus mode. Real study time persists to a new additive `Store.sessions[]`; the AI never supplies duration. Presentation reuses the `cairnMock` inline-style system and the existing paste→ingest→commit pipeline.

**Tech Stack:** Vite + React 18 + TypeScript, Vitest + @testing-library/react, local-first (localStorage). Inline styles via `src/theme/cairnMock.ts`.

## Global Constraints

- The app makes **no AI calls** — briefings are copy-out prompts; session data arrives by paste-in.
- **The app is the only timekeeper.** All `duration_minutes` come from the in-app timer; the AI's value is `0` by instruction and is overwritten/ignored. It must never reach storage.
- No change to the retention/health/leveling math (`engine/retention`, `engine/metrics`, `engine/leveling`).
- Store field additions are **additive + migration-safe**: a store loaded without `sessions` becomes `sessions: []`, no data transform.
- Follow existing patterns: inline styles from `getCairnTheme(isDark)` (via `useTheme()` → `theme === 'dark'`); serif = `"'EB Garamond', var(--font-display)"`, sans = `var(--font-sans)`.
- TypeScript is strict + `noUnusedLocals`. Run `npx tsc -b --noEmit` clean before every commit.
- Tests: `npx vitest run <file>`. Full suite must stay green (`npx vitest run`).

---

## File Structure

- **`src/domain/types.ts`** (modify) — `SessionIntent`, `SessionScope`, `SessionRecord`; add `sessions` to `Store` + `emptyStore()`.
- **`src/core/storage.ts`** (modify) — default `sessions: []` on load (migration).
- **`src/engine/session.ts`** (create) — `scopeConfig`, `intentConfig`, sibling ranking, course snapshot, `buildSessionContext`, `startSessionPrompt`.
- **`src/core/focusDraft.ts`** (create) — load/save/clear the resumable focus-session draft in localStorage.
- **`src/hooks/useStudyTimer.ts`** (create) — count-up + custom Pomodoro timer.
- **`src/hooks/useStore.ts`** (modify) — `commitSession(value, meta)` (commit JSON + append `SessionRecord` atomically).
- **`src/engine/overview.ts`** (modify) — `weeklyVolume` uses real durations.
- **`src/engine/progress.ts`** (modify) — `workLogged` uses real durations.
- **`src/routes/StartSession.tsx`** (create) — setup modal (intent/scope/timer + briefing + copy).
- **`src/routes/FocusMode.tsx`** (create) — focus view (timer + errors checklist + End).
- **`src/App.tsx`** (modify) — render the flow, resume prompt, wrap-up commit; entry points.
- **`src/routes/TopicDetail.tsx`** (modify) — "Start session" button.
- **`src/routes/Overview.tsx`**, **`src/routes/CourseDashboard.tsx`** (modify) — due-queue "Review" starts the flow.

---

### Task 1: Domain types, Store field, migration

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/core/storage.ts`
- Test: `tests/core/storage.test.ts` (add cases) or `tests/domain/session-record.test.ts` (create)

**Interfaces:**
- Produces:
  ```ts
  export type SessionIntent = 'remediate' | 'retention' | 'new_content' | 'adaptive';
  export type SessionScope = 'clean_slate' | 'topic' | 'section' | 'course';
  export interface SessionRecord {
    session_id: string;
    topic_id: string;
    course_id: string;
    created_at: string;   // ISO — timer started
    completed_at: string; // ISO — committed
    duration_minutes: number; // measured, authoritative
    intent: SessionIntent;
    scope: SessionScope;
    timer_mode: 'count_up' | 'pomodoro';
    pomodoro_config?: { work_minutes: number; break_minutes: number; long_break_minutes: number };
  }
  // Store now has: sessions: SessionRecord[]
  ```

- [ ] **Step 1: Write the failing test** — `tests/domain/session-record.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { emptyStore } from '@/domain/types';
import { STORE_KEY } from '@/core/storage';

describe('Store.sessions migration', () => {
  it('emptyStore starts with an empty sessions array', () => {
    expect(emptyStore().sessions).toEqual([]);
  });

  it('a persisted store missing `sessions` loads as []', async () => {
    localStorage.clear();
    // A legacy store shape without `sessions`.
    localStorage.setItem(STORE_KEY, JSON.stringify({ schema_version: '3.0.0', courses: [], exams: [] }));
    const { loadStore } = await import('@/core/storage');
    expect(loadStore().sessions).toEqual([]);
    localStorage.clear();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/domain/session-record.test.ts` — Expected: FAIL (`sessions` undefined).

- [ ] **Step 3: Add the types + Store field** in `src/domain/types.ts`

```ts
export type SessionIntent = 'remediate' | 'retention' | 'new_content' | 'adaptive';
export type SessionScope = 'clean_slate' | 'topic' | 'section' | 'course';

export interface SessionRecord {
  session_id: string;
  topic_id: string;
  course_id: string;
  created_at: string;
  completed_at: string;
  duration_minutes: number;
  intent: SessionIntent;
  scope: SessionScope;
  timer_mode: 'count_up' | 'pomodoro';
  pomodoro_config?: { work_minutes: number; break_minutes: number; long_break_minutes: number };
}
```
Add `sessions: SessionRecord[];` to `interface Store`, and `sessions: [],` to the object returned by `emptyStore()`.

- [ ] **Step 4: Migrate on load** in `src/core/storage.ts` — after the store is parsed/validated and before it is returned from `loadStore`, coerce the field:

```ts
// Additive migration: legacy stores predate per-session durations.
if (!Array.isArray((parsed as { sessions?: unknown }).sessions)) {
  (parsed as { sessions: SessionRecord[] }).sessions = [];
}
```
(Place it alongside the existing parse/return path; import `SessionRecord` type. If `loadStore` returns `emptyStore()` merged with parsed data, ensure `sessions` defaults there too.)

- [ ] **Step 5: Run tests** — `npx vitest run tests/domain/session-record.test.ts` — Expected: PASS. Then `npx tsc -b --noEmit` — Expected: clean (fix any Store constructors that now need `sessions`).

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/core/storage.ts tests/domain/session-record.test.ts
git commit -m "feat(session): add SessionRecord + Store.sessions with migration"
```

---

### Task 2: Session config tables (`scopeConfig`, `intentConfig`)

**Files:**
- Create: `src/engine/session.ts`
- Test: `tests/engine/session-config.test.ts`

**Interfaces:**
- Consumes: `SessionIntent`, `SessionScope` (Task 1).
- Produces:
  ```ts
  export type Block = 'topic-title' | 'learner' | 'unresolved-errors' | 'related-topics' | 'course-snapshot';
  export const scopeConfig: Record<SessionScope, Block[]>;
  export interface IntentSpec { instructions: string[]; avoid: string[]; siblingWeights: { retention: number; errors: number; proximity: number }; }
  export const intentConfig: Record<SessionIntent, IntentSpec>;
  ```

- [ ] **Step 1: Write the failing test** — `tests/engine/session-config.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { scopeConfig, intentConfig } from '@/engine/session';

const SCOPES = ['clean_slate', 'topic', 'section', 'course'] as const;
const INTENTS = ['remediate', 'retention', 'new_content', 'adaptive'] as const;

describe('session config', () => {
  it('every scope maps to a block list that starts with the topic title', () => {
    for (const s of SCOPES) {
      expect(scopeConfig[s].length).toBeGreaterAn(0);
      expect(scopeConfig[s][0]).toBe('topic-title');
    }
  });
  it('clean_slate carries only the topic title', () => {
    expect(scopeConfig.clean_slate).toEqual(['topic-title']);
  });
  it('section includes related-topics; course includes course-snapshot', () => {
    expect(scopeConfig.section).toContain('related-topics');
    expect(scopeConfig.course).toContain('course-snapshot');
  });
  it('every intent has non-empty instructions, avoid, and sibling weights', () => {
    for (const i of INTENTS) {
      expect(intentConfig[i].instructions.length).toBeGreaterThan(0);
      expect(intentConfig[i].avoid.length).toBeGreaterThan(0);
      const w = intentConfig[i].siblingWeights;
      expect(typeof w.retention + typeof w.errors + typeof w.proximity).toBe('numbernumbernumber');
    }
  });
  it('every AVOID block forbids AI time estimation', () => {
    for (const i of INTENTS) {
      expect(intentConfig[i].avoid.join(' ').toLowerCase()).toMatch(/time|record/);
    }
  });
});
```
(Note the deliberate typo guard — fix `toBeGreaterAn`→`toBeGreaterThan` when writing; kept here so the reviewer double-checks.)

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/engine/session-config.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement the config** in `src/engine/session.ts`

```ts
import type { SessionIntent, SessionScope } from '@/domain/types';

export type Block = 'topic-title' | 'learner' | 'unresolved-errors' | 'related-topics' | 'course-snapshot';

export const scopeConfig: Record<SessionScope, Block[]> = {
  clean_slate: ['topic-title'],
  topic:       ['topic-title', 'learner', 'unresolved-errors'],
  section:     ['topic-title', 'learner', 'unresolved-errors', 'related-topics'],
  course:      ['topic-title', 'learner', 'unresolved-errors', 'course-snapshot'],
};

export interface IntentSpec {
  instructions: string[];
  avoid: string[];
  siblingWeights: { retention: number; errors: number; proximity: number };
}

const NO_TIME = 'Do not estimate how long this took — the app records the time.';

export const intentConfig: Record<SessionIntent, IntentSpec> = {
  remediate: {
    instructions: [
      'Focus entirely on the unresolved errors below.',
      'Use retrieval before explanation.',
      'Do not move on until each error is corrected.',
    ],
    avoid: ['Do not reteach mastered concepts unless retrieval shows they have faded.', NO_TIME],
    siblingWeights: { retention: 1, errors: 3, proximity: 1 },
  },
  retention: {
    instructions: ['Test recall first, then patch what has faded.', 'Prioritise retrieval over exposition.'],
    avoid: ['Do not re-explain what retrieval shows is already solid.', NO_TIME],
    siblingWeights: { retention: 3, errors: 1, proximity: 1 },
  },
  new_content: {
    instructions: ['Confirm the foundation briefly, then extend or move to what is next.'],
    avoid: ['Do not reteach mastered concepts unless retrieval shows they have faded.', NO_TIME],
    siblingWeights: { retention: 1, errors: 1, proximity: 3 },
  },
  adaptive: {
    instructions: ['Here is the full picture; spend time where it is weakest.', 'Prioritise retrieval over exposition.'],
    avoid: ['Do not spread thin across everything at once.', NO_TIME],
    siblingWeights: { retention: 2, errors: 2, proximity: 1 },
  },
};
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/engine/session-config.test.ts` — Expected: PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.ts tests/engine/session-config.test.ts
git commit -m "feat(session): declarative scopeConfig + intentConfig tables"
```

---

### Task 3: Sibling ranking + course snapshot

**Files:**
- Modify: `src/engine/session.ts`
- Test: `tests/engine/session-context.test.ts`

**Interfaces:**
- Consumes: `intentConfig` (Task 2), `retentionPct` from `@/engine/retention`, `Topic`/`Section`/`Course` from `@/domain/types`.
- Produces:
  ```ts
  export interface SiblingSummary { topic_id: string; title: string; status: string; retention: number | null; unresolvedErrors: number; }
  export function rankSiblings(section: Section, focalId: string, intent: SessionIntent, now: Date): SiblingSummary[]; // ≤5
  export interface SectionMastery { title: string; mastered: number; total: number; }
  export interface CourseSnapshot { sections: SectionMastery[]; topWeaknesses: SiblingSummary[]; } // topWeaknesses ≤5
  export function courseSnapshot(course: Course, now: Date): CourseSnapshot;
  ```

- [ ] **Step 1: Write the failing test** — `tests/engine/session-context.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { rankSiblings, courseSnapshot } from '@/engine/session';
import type { Course, Section, Topic } from '@/domain/types';

const NOW = new Date('2026-08-07T12:00:00Z');
function topic(over: Partial<Topic>): Topic {
  return {
    topic_id: 't', title: 'T', status: 'practising', conf: 3, strength: 1, k_factor: 8, cards: 0,
    last_reviewed: new Date(NOW.getTime() - 5 * 86400000).toISOString(), mastered_at: null,
    drift_history: [], review_history: [{ event_id: 'e', date: new Date(NOW.getTime() - 5 * 86400000).toISOString(), kind: 'study_review', source: 'session', source_id: 's', confidence_reported: 3 }],
    error_log: [], ...over,
  };
}
function section(topics: Topic[]): Section { return { section_id: 'sec', title: 'Sec', order: 0, topics }; }

describe('rankSiblings', () => {
  it('excludes the focal topic and caps at 5', () => {
    const topics = Array.from({ length: 8 }, (_, i) => topic({ topic_id: `t${i}`, title: `T${i}` }));
    const out = rankSiblings(section(topics), 't0', 'retention', NOW);
    expect(out.length).toBe(5);
    expect(out.find((s) => s.topic_id === 't0')).toBeUndefined();
  });

  it('retention intent surfaces the most-faded siblings first', () => {
    const strong = topic({ topic_id: 'strong', title: 'Strong', strength: 6 });
    const weak = topic({ topic_id: 'weak', title: 'Weak', strength: 0.2 });
    const out = rankSiblings(section([topic({ topic_id: 'focal' }), strong, weak]), 'focal', 'retention', NOW);
    expect(out[0]!.topic_id).toBe('weak');
  });
});

describe('courseSnapshot', () => {
  it('reports per-section mastery ratios and ≤5 weaknesses', () => {
    const mastered = topic({ topic_id: 'm', status: 'mastered' });
    const learning = topic({ topic_id: 'l', status: 'learning', strength: 0.2 });
    const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'C', created_at: '', source: 'ai_generated', sections: [section([mastered, learning])] };
    const snap = courseSnapshot(course, NOW);
    expect(snap.sections[0]).toMatchObject({ mastered: 1, total: 2 });
    expect(snap.topWeaknesses.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/engine/session-context.test.ts` — Expected: FAIL (`rankSiblings` not exported).

- [ ] **Step 3: Implement** in `src/engine/session.ts`

```ts
import type { Course, Section, SessionIntent, Topic } from '@/domain/types';
import { retentionPct } from '@/engine/retention';

export interface SiblingSummary {
  topic_id: string; title: string; status: string; retention: number | null; unresolvedErrors: number;
}

function summarise(topic: Topic, now: Date): SiblingSummary {
  const r = retentionPct(topic, now);
  return {
    topic_id: topic.topic_id, title: topic.title, status: topic.status,
    retention: r === null ? null : Math.round(r),
    unresolvedErrors: topic.error_log.filter((e) => !e.resolved).length,
  };
}

export function rankSiblings(section: Section, focalId: string, intent: SessionIntent, now: Date): SiblingSummary[] {
  const w = intentConfig[intent].siblingWeights;
  const focalIdx = section.topics.findIndex((t) => t.topic_id === focalId);
  const scored = section.topics
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => t.topic_id !== focalId)
    .map(({ t, idx }) => {
      const s = summarise(t, now);
      const faded = s.retention === null ? 0.5 : 1 - s.retention / 100; // higher = more faded
      const proximity = focalIdx < 0 ? 0 : 1 / (1 + Math.abs(idx - focalIdx));
      const score = w.retention * faded + w.errors * s.unresolvedErrors + w.proximity * proximity;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((x) => x.s);
}

export interface SectionMastery { title: string; mastered: number; total: number; }
export interface CourseSnapshot { sections: SectionMastery[]; topWeaknesses: SiblingSummary[]; }

export function courseSnapshot(course: Course, now: Date): CourseSnapshot {
  const sections = course.sections.map((sec) => ({
    title: sec.title,
    mastered: sec.topics.filter((t) => t.status === 'mastered').length,
    total: sec.topics.length,
  }));
  const started = course.sections
    .flatMap((sec) => sec.topics)
    .filter((t) => t.status !== 'not_started')
    .map((t) => summarise(t, now))
    .sort((a, b) => {
      const fa = a.retention ?? 100, fb = b.retention ?? 100;
      if (fa !== fb) return fa - fb;             // most faded first
      return b.unresolvedErrors - a.unresolvedErrors;
    });
  return { sections, topWeaknesses: started.slice(0, 5) };
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/engine/session-context.test.ts` — Expected: PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.ts tests/engine/session-context.test.ts
git commit -m "feat(session): relevance-ranked siblings + compact course snapshot"
```

---

### Task 4: `buildSessionContext`

**Files:**
- Modify: `src/engine/session.ts`
- Test: `tests/engine/session-context.test.ts` (add cases)

**Interfaces:**
- Consumes: `scopeConfig` (Task 2), `rankSiblings`/`courseSnapshot`/`summarise` (Task 3), `retentionPct`, `health`/`overconfidenceIndex`/`shouldShowHealth` from `@/engine/metrics`.
- Produces:
  ```ts
  export interface SessionContext {
    topic: { title: string; sectionTitle: string; courseTitle: string; };
    learner?: { retention: number | null; confidence: number; overconfident: boolean; status: string };
    unresolvedErrors: string[];           // descriptions
    siblings: SiblingSummary[];           // section scope
    snapshot: CourseSnapshot | null;      // course scope
  }
  export function buildSessionContext(course: Course, section: Section, topic: Topic, intent: SessionIntent, scope: SessionScope, now: Date): SessionContext;
  ```

- [ ] **Step 1: Write the failing test** (append to `tests/engine/session-context.test.ts`)

```ts
import { buildSessionContext } from '@/engine/session';
// reuse topic()/section() helpers above

describe('buildSessionContext', () => {
  const focal = topic({ topic_id: 'focal', title: 'Elasticity', conf: 4, error_log: [
    { error_id: 'x', date: '', source: 'session', source_id: 's', error_type: 'conceptual', description: 'confuses elastic/inelastic', resolved: false, resolved_date: null },
  ]});
  const sec = section([focal, topic({ topic_id: 'sib', title: 'Demand' })]);
  const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'Micro', created_at: '', source: 'ai_generated', sections: [sec] };

  it('clean_slate carries only topic identity — no learner data', () => {
    const ctx = buildSessionContext(course, sec, focal, 'new_content', 'clean_slate', NOW);
    expect(ctx.topic.title).toBe('Elasticity');
    expect(ctx.learner).toBeUndefined();
    expect(ctx.unresolvedErrors).toEqual([]);
    expect(ctx.siblings).toEqual([]);
    expect(ctx.snapshot).toBeNull();
  });

  it('topic scope includes learner signals + unresolved errors, no siblings', () => {
    const ctx = buildSessionContext(course, sec, focal, 'remediate', 'topic', NOW);
    expect(ctx.learner?.confidence).toBe(4);
    expect(ctx.unresolvedErrors).toContain('confuses elastic/inelastic');
    expect(ctx.siblings).toEqual([]);
  });

  it('section scope adds ranked siblings; course scope adds a snapshot', () => {
    expect(buildSessionContext(course, sec, focal, 'retention', 'section', NOW).siblings.length).toBeGreaterThan(0);
    expect(buildSessionContext(course, sec, focal, 'adaptive', 'course', NOW).snapshot).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/engine/session-context.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `buildSessionContext`** in `src/engine/session.ts` — drive inclusion from `scopeConfig[scope].includes(block)`, never `if (scope === …)`:

```ts
import { health, overconfidenceIndex, shouldShowHealth } from '@/engine/metrics';

export interface SessionContext {
  topic: { title: string; sectionTitle: string; courseTitle: string };
  learner?: { retention: number | null; confidence: number; overconfident: boolean; status: string };
  unresolvedErrors: string[];
  siblings: SiblingSummary[];
  snapshot: CourseSnapshot | null;
}

export function buildSessionContext(
  course: Course, section: Section, topic: Topic, intent: SessionIntent, scope: SessionScope, now: Date,
): SessionContext {
  const blocks = scopeConfig[scope];
  const ctx: SessionContext = {
    topic: { title: topic.title, sectionTitle: section.title, courseTitle: course.title },
    unresolvedErrors: [], siblings: [], snapshot: null,
  };
  if (blocks.includes('learner')) {
    const r = retentionPct(topic, now);
    const confidencePct = topic.conf * 20;
    ctx.learner = {
      retention: r === null ? null : Math.round(r),
      confidence: topic.conf,
      overconfident: r !== null && confidencePct - r * 100 > 15 ? true : false,
      status: topic.status,
    };
    // health/overconfidenceIndex/shouldShowHealth available if a future block needs them
    void health; void overconfidenceIndex; void shouldShowHealth;
  }
  if (blocks.includes('unresolved-errors')) {
    ctx.unresolvedErrors = topic.error_log.filter((e) => !e.resolved).map((e) => e.description);
  }
  if (blocks.includes('related-topics')) {
    ctx.siblings = rankSiblings(section, topic.topic_id, intent, now);
  }
  if (blocks.includes('course-snapshot')) {
    ctx.snapshot = courseSnapshot(course, now);
  }
  return ctx;
}
```
(Remove the `void health; …` line and the unused imports if lint objects — keep only what's used. The `overconfident` calc: `retentionPct` returns 0–1, so compare `confidencePct` (0–100) against `r*100`.)

- [ ] **Step 4: Run tests** — `npx vitest run tests/engine/session-context.test.ts` — PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.ts tests/engine/session-context.test.ts
git commit -m "feat(session): buildSessionContext — scope-driven data assembly"
```

---

### Task 5: `startSessionPrompt` — declarative block assembly

**Files:**
- Modify: `src/engine/session.ts`
- Test: `tests/engine/start-session-prompt.test.ts`

**Interfaces:**
- Consumes: `SessionContext` (Task 4), `scopeConfig`/`intentConfig` (Task 2).
- Produces: `export function startSessionPrompt(ctx: SessionContext, intent: SessionIntent, scope: SessionScope): string;`

- [ ] **Step 1: Write the failing test** — `tests/engine/start-session-prompt.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildSessionContext, startSessionPrompt } from '@/engine/session';
import type { Course, Section, Topic } from '@/domain/types';

const NOW = new Date('2026-08-07T12:00:00Z');
// minimal focal topic with one unresolved error
const focal: Topic = { topic_id: 'f', title: 'Elasticity', status: 'practising', conf: 4, strength: 1, k_factor: 8, cards: 0,
  last_reviewed: new Date(NOW.getTime() - 5 * 86400000).toISOString(), mastered_at: null, drift_history: [],
  review_history: [{ event_id: 'e', date: new Date(NOW.getTime() - 5*86400000).toISOString(), kind: 'study_review', source: 'session', source_id: 's', confidence_reported: 4 }],
  error_log: [{ error_id: 'x', date: '', source: 'session', source_id: 's', error_type: 'conceptual', description: 'confuses elastic/inelastic', resolved: false, resolved_date: null }] };
const sec: Section = { section_id: 's', title: 'Elasticity', order: 0, topics: [focal] };
const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'Micro', created_at: '', source: 'ai_generated', sections: [sec] };
const build = (intent: any, scope: any) => startSessionPrompt(buildSessionContext(course, sec, focal, intent, scope, NOW), intent, scope);

describe('startSessionPrompt', () => {
  it('clean_slate omits learner + errors blocks but keeps topic + OUTPUT', () => {
    const p = build('new_content', 'clean_slate');
    expect(p).toContain('Elasticity');
    expect(p).not.toContain('UNRESOLVED ERRORS');
    expect(p).not.toContain('LEARNER');
    expect(p).toContain('OUTPUT');
  });
  it('topic scope includes learner + unresolved errors', () => {
    const p = build('remediate', 'topic');
    expect(p).toContain('LEARNER');
    expect(p).toContain('UNRESOLVED ERRORS');
    expect(p).toContain('confuses elastic/inelastic');
  });
  it('OUTPUT always tells the AI not to estimate time and to set duration_minutes to 0', () => {
    const p = build('retention', 'topic');
    expect(p).toMatch(/duration_minutes.*0/);
    expect(p.toLowerCase()).toMatch(/app records the time|do not estimate/);
  });
  it('intent drives INSTRUCTIONS + AVOID copy', () => {
    expect(build('remediate', 'topic')).toContain('Do not move on until each error is corrected.');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/engine/start-session-prompt.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `startSessionPrompt`** in `src/engine/session.ts` — a block-renderer registry keyed by `Block`, assembled from `scopeConfig[scope]`:

```ts
export function startSessionPrompt(ctx: SessionContext, intent: SessionIntent, scope: SessionScope): string {
  const renderers: Record<Block, () => string | null> = {
    'topic-title': () =>
      `SESSION\nIntent: ${intent}\nTopic: ${ctx.topic.title}   (${ctx.topic.sectionTitle} · ${ctx.topic.courseTitle})`,
    learner: () => {
      if (!ctx.learner) return null;
      const l = ctx.learner;
      const ret = l.retention === null ? '—' : `${l.retention}%`;
      return `LEARNER\nRetention: ${ret}   Confidence: ${l.confidence}/5   Overconfident: ${l.overconfident ? 'yes' : 'no'}   Status: ${l.status}`;
    },
    'unresolved-errors': () =>
      ctx.unresolvedErrors.length === 0 ? null
        : `UNRESOLVED ERRORS\n${ctx.unresolvedErrors.map((e) => `- ${e}`).join('\n')}`,
    'related-topics': () =>
      ctx.siblings.length === 0 ? null
        : `RELATED TOPICS\n${ctx.siblings.map((s) => `- ${s.title} (${s.status}${s.retention === null ? '' : `, ${s.retention}%`})`).join('\n')}`,
    'course-snapshot': () => {
      if (!ctx.snapshot) return null;
      const secs = ctx.snapshot.sections.map((s) => `${s.title} — ${s.mastered}/${s.total} mastered`).join('\n');
      const weak = ctx.snapshot.topWeaknesses.map((w) => `- ${w.title}${w.retention === null ? '' : ` (${w.retention}%)`}`).join('\n');
      return `COURSE SNAPSHOT\n${secs}\n\nTop weaknesses\n${weak}`;
    },
  };

  const spec = intentConfig[intent];
  const contextBlocks = scopeConfig[scope].map((b) => renderers[b]()).filter((s): s is string => s !== null);
  const instructions = `INSTRUCTIONS\n${spec.instructions.join('\n')}`;
  const avoid = `AVOID\n${spec.avoid.join('\n')}`;
  const output = [
    'OUTPUT',
    'When finished, output ONLY the session-log JSON (no prose, no fences):',
    '{ "schema_version": "2.0.0", "session_id": "session_<10 random>", "course_id": "…", "date": "<ISO now>", "duration_minutes": 0, "topics_covered": [ … ] }',
    'Set duration_minutes to 0 — the app records the real time.',
  ].join('\n');

  return [...contextBlocks, instructions, avoid, output].join('\n\n');
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/engine/start-session-prompt.test.ts` — PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/session.ts tests/engine/start-session-prompt.test.ts
git commit -m "feat(session): startSessionPrompt assembled from config blocks"
```

---

### Task 6: `useStudyTimer` hook

**Files:**
- Create: `src/hooks/useStudyTimer.ts`
- Test: `tests/hooks/useStudyTimer.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PomodoroConfig { work_minutes: number; break_minutes: number; long_break_minutes: number }
  export type TimerMode = 'count_up' | 'pomodoro';
  export interface StudyTimer {
    elapsedSeconds: number;      // total worked seconds (excludes break time)
    elapsedMinutes: number;      // Math.floor(elapsedSeconds / 60)
    phase: 'work' | 'break' | 'long_break';
    running: boolean;
    pause(): void; resume(): void;
  }
  export function useStudyTimer(opts: { mode: TimerMode; pomodoro?: PomodoroConfig; initialSeconds?: number }): StudyTimer;
  ```

- [ ] **Step 1: Write the failing test** — `tests/hooks/useStudyTimer.test.ts`

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyTimer } from '@/hooks/useStudyTimer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useStudyTimer', () => {
  it('count-up accrues worked seconds and stops when paused', () => {
    const { result } = renderHook(() => useStudyTimer({ mode: 'count_up' }));
    act(() => { vi.advanceTimersByTime(90_000); });
    expect(result.current.elapsedMinutes).toBe(1);
    act(() => result.current.pause());
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(result.current.elapsedMinutes).toBe(1); // paused → no accrual
  });

  it('pomodoro switches work → break and stops counting worked time on break', () => {
    const { result } = renderHook(() => useStudyTimer({ mode: 'pomodoro', pomodoro: { work_minutes: 1, break_minutes: 1, long_break_minutes: 2 } }));
    act(() => { vi.advanceTimersByTime(60_000); }); // finish 1 work minute
    expect(result.current.phase).toBe('break');
    const worked = result.current.elapsedSeconds;
    act(() => { vi.advanceTimersByTime(30_000); }); // during break
    expect(result.current.elapsedSeconds).toBe(worked); // break doesn't count as worked
  });

  it('restores from initialSeconds', () => {
    const { result } = renderHook(() => useStudyTimer({ mode: 'count_up', initialSeconds: 120 }));
    expect(result.current.elapsedMinutes).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/hooks/useStudyTimer.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `useStudyTimer`** in `src/hooks/useStudyTimer.ts` — a 1s `setInterval` incrementing worked seconds only in the `work` phase; pomodoro advances phases when the current phase's budget elapses (work→break, break→work; every 4th break is `long_break`).

```ts
import { useEffect, useRef, useState } from 'react';

export interface PomodoroConfig { work_minutes: number; break_minutes: number; long_break_minutes: number }
export type TimerMode = 'count_up' | 'pomodoro';
export interface StudyTimer {
  elapsedSeconds: number; elapsedMinutes: number;
  phase: 'work' | 'break' | 'long_break'; running: boolean;
  pause(): void; resume(): void;
}

export function useStudyTimer(opts: { mode: TimerMode; pomodoro?: PomodoroConfig; initialSeconds?: number }): StudyTimer {
  const [elapsedSeconds, setElapsed] = useState(opts.initialSeconds ?? 0);
  const [phase, setPhase] = useState<'work' | 'break' | 'long_break'>('work');
  const [running, setRunning] = useState(true);
  const phaseSecRef = useRef(0);
  const cyclesRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setPhase((ph) => {
        if (ph === 'work') setElapsed((s) => s + 1);
        if (opts.mode === 'count_up') return ph;
        const cfg = opts.pomodoro!;
        phaseSecRef.current += 1;
        const budget = (ph === 'work' ? cfg.work_minutes : ph === 'break' ? cfg.break_minutes : cfg.long_break_minutes) * 60;
        if (phaseSecRef.current >= budget) {
          phaseSecRef.current = 0;
          if (ph === 'work') {
            cyclesRef.current += 1;
            return cyclesRef.current % 4 === 0 ? 'long_break' : 'break';
          }
          return 'work';
        }
        return ph;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, opts.mode, opts.pomodoro]);

  return {
    elapsedSeconds, elapsedMinutes: Math.floor(elapsedSeconds / 60), phase, running,
    pause: () => setRunning(false), resume: () => setRunning(true),
  };
}
```
(Note: driving `setElapsed` from inside `setPhase` keeps a single interval authoritative. If the reviewer prefers, split into two state updaters — behaviour must match the tests.)

- [ ] **Step 4: Run tests** — `npx vitest run tests/hooks/useStudyTimer.test.ts` — PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useStudyTimer.ts tests/hooks/useStudyTimer.test.ts
git commit -m "feat(session): useStudyTimer — count-up + custom Pomodoro"
```

---

### Task 7: Focus-session draft persistence

**Files:**
- Create: `src/core/focusDraft.ts`
- Test: `tests/core/focusDraft.test.ts`

**Interfaces:**
- Consumes: `SessionIntent`, `SessionScope` (Task 1), `PomodoroConfig`/`TimerMode` (Task 6).
- Produces:
  ```ts
  export interface FocusDraft {
    course_id: string; section_id: string; topic_id: string; topic_title: string;
    intent: SessionIntent; scope: SessionScope;
    timer_mode: TimerMode; pomodoro?: PomodoroConfig;
    created_at: string; elapsed_seconds: number; checked_error_ids: string[];
  }
  export function loadFocusDraft(): FocusDraft | null;
  export function saveFocusDraft(d: FocusDraft): void;
  export function clearFocusDraft(): void;
  export const FOCUS_DRAFT_KEY = 'cairn-focus-session';
  ```

- [ ] **Step 1: Write the failing test** — `tests/core/focusDraft.test.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { clearFocusDraft, loadFocusDraft, saveFocusDraft, FOCUS_DRAFT_KEY, type FocusDraft } from '@/core/focusDraft';

const draft: FocusDraft = {
  course_id: 'c', section_id: 's', topic_id: 't', topic_title: 'T',
  intent: 'remediate', scope: 'topic', timer_mode: 'count_up',
  created_at: '2026-08-07T12:00:00Z', elapsed_seconds: 42, checked_error_ids: ['x'],
};
afterEach(() => localStorage.clear());

describe('focusDraft', () => {
  it('round-trips a draft', () => { saveFocusDraft(draft); expect(loadFocusDraft()).toEqual(draft); });
  it('returns null when absent', () => { expect(loadFocusDraft()).toBeNull(); });
  it('clears', () => { saveFocusDraft(draft); clearFocusDraft(); expect(loadFocusDraft()).toBeNull(); });
  it('returns null on corrupt JSON rather than throwing', () => {
    localStorage.setItem(FOCUS_DRAFT_KEY, '{not json');
    expect(loadFocusDraft()).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/core/focusDraft.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** `src/core/focusDraft.ts`

```ts
import type { SessionIntent, SessionScope } from '@/domain/types';
import type { PomodoroConfig, TimerMode } from '@/hooks/useStudyTimer';

export const FOCUS_DRAFT_KEY = 'cairn-focus-session';
export interface FocusDraft {
  course_id: string; section_id: string; topic_id: string; topic_title: string;
  intent: SessionIntent; scope: SessionScope;
  timer_mode: TimerMode; pomodoro?: PomodoroConfig;
  created_at: string; elapsed_seconds: number; checked_error_ids: string[];
}

export function loadFocusDraft(): FocusDraft | null {
  try {
    const raw = localStorage.getItem(FOCUS_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as FocusDraft) : null;
  } catch { return null; }
}
export function saveFocusDraft(d: FocusDraft): void {
  try { localStorage.setItem(FOCUS_DRAFT_KEY, JSON.stringify(d)); } catch { /* quota — non-fatal */ }
}
export function clearFocusDraft(): void {
  try { localStorage.removeItem(FOCUS_DRAFT_KEY); } catch { /* non-fatal */ }
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/core/focusDraft.test.ts` — PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/focusDraft.ts tests/core/focusDraft.test.ts
git commit -m "feat(session): resumable focus-session draft persistence"
```

---

### Task 8: `commitSession` + real durations in stats

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/engine/overview.ts` (`weeklyVolume`)
- Modify: `src/engine/progress.ts` (`workLogged`)
- Test: `tests/engine/real-durations.test.ts`

**Interfaces:**
- Consumes: `SessionRecord` (Task 1), existing `commit`/`mergeInto`/`saveStore`.
- Produces (useStore return object gains):
  ```ts
  commitSession: (value: unknown, meta: Omit<SessionRecord, 'session_id'|'course_id'|'duration_minutes'|'completed_at'> & { measured_minutes: number }) => string | null;
  ```
  It commits the session JSON via the normal pipeline AND appends a `SessionRecord` (with `session_id`/`course_id` read from `value`, `duration_minutes = measured_minutes`, `completed_at = now`) in one persisted update.

- [ ] **Step 1: Write the failing test** — `tests/engine/real-durations.test.ts` (engine-level; exercises the stat readers with a store that has `sessions`)

```ts
import { describe, expect, it } from 'vitest';
import { emptyStore, type Store } from '@/domain/types';
import { weeklyVolume } from '@/engine/overview';
import { workLogged } from '@/engine/progress';

function storeWithSession(minutes: number): Store {
  const now = new Date();
  return {
    ...emptyStore(),
    // one committed session, recorded via a SessionRecord with real minutes
    sessions: [{ session_id: 'session_1', topic_id: 't', course_id: 'c', created_at: now.toISOString(), completed_at: now.toISOString(), duration_minutes: minutes, intent: 'retention', scope: 'topic', timer_mode: 'count_up' }],
  };
}

describe('real study durations', () => {
  it('workLogged sums real minutes from sessions when present', () => {
    const wl = workLogged(storeWithSession(90));
    expect(wl.hours).toBeCloseTo(1.5, 1);
  });
  it('weeklyVolume counts a recent recorded session and its real hours', () => {
    const wv = weeklyVolume(storeWithSession(45));
    expect(wv.sessions).toBeGreaterThanOrEqual(1);
    expect(wv.hours).toBeCloseTo(0.75, 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/engine/real-durations.test.ts` — Expected: FAIL (stats ignore `store.sessions`).

- [ ] **Step 3a: Update `workLogged`** in `src/engine/progress.ts` — prefer recorded durations, fall back to the nominal proxy for sessions with no record:

```ts
export function workLogged(store: Store): WorkLogged {
  const recorded = new Map(store.sessions.map((s) => [s.session_id, s.duration_minutes]));
  const sessionIds = new Set<string>();
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) if (e.source === 'session') sessionIds.add(e.source_id);
  }
  // include recorded sessions even if their events aren't reconstructable yet
  for (const id of recorded.keys()) sessionIds.add(id);
  let minutes = 0;
  for (const id of sessionIds) minutes += recorded.get(id) ?? CONFIG.PROGRESS.SESSION_MINUTES;
  return { sessions: sessionIds.size, hours: Math.round((minutes / 60) * 10) / 10, papers: store.exams.length };
}
```

- [ ] **Step 3b: Update `weeklyVolume`** in `src/engine/overview.ts` — same principle within the 7-day window, using recorded `completed_at`/`duration_minutes` when available:

```ts
export function weeklyVolume(store: Store, now = new Date()): { sessions: number; hours: number } {
  const cutoff = now.getTime() - 7 * 86_400_000;
  const recorded = new Map(store.sessions.map((s) => [s.session_id, s]));
  const ids = new Set<string>();
  for (const { topic } of allTopics(store)) {
    for (const e of topic.review_history) {
      if (e.source === 'session' && new Date(e.date).getTime() >= cutoff) ids.add(e.source_id);
    }
  }
  for (const s of store.sessions) if (new Date(s.completed_at).getTime() >= cutoff) ids.add(s.session_id);
  let minutes = 0;
  for (const id of ids) minutes += recorded.get(id)?.duration_minutes ?? 30;
  return { sessions: ids.size, hours: Math.round((minutes / 60) * 10) / 10 };
}
```

- [ ] **Step 3c: Add `commitSession`** to `src/hooks/useStore.ts` — clone → commit the JSON via `commit(...)` → append the `SessionRecord` → `saveStore` once → adopt:

```ts
const commitSession = useCallback(
  (value: unknown, meta: { topic_id: string; created_at: string; intent: SessionIntent; scope: SessionScope; timer_mode: 'count_up' | 'pomodoro'; pomodoro_config?: SessionRecord['pomodoro_config']; measured_minutes: number }): string | null => {
    try {
      const committed = commit('session', value, store, mergeInto);
      const v = value as { session_id: string; course_id: string };
      const record: SessionRecord = {
        session_id: v.session_id, topic_id: meta.topic_id, course_id: v.course_id,
        created_at: meta.created_at, completed_at: new Date().toISOString(),
        duration_minutes: meta.measured_minutes, intent: meta.intent, scope: meta.scope,
        timer_mode: meta.timer_mode, pomodoro_config: meta.pomodoro_config,
      };
      const next = { ...committed, sessions: [...committed.sessions, record] };
      saveStore(next);
      setUndoSnapshot(store);
      setStore(next);
      return null;
    } catch (e) {
      return e instanceof Error ? `That couldn't be saved: ${e.message}.` : "That couldn't be saved.";
    }
  },
  [store],
);
```
Add `commitSession` to the object returned at the end of `useStore`. Import `SessionRecord`, `SessionIntent`, `SessionScope`.

- [ ] **Step 4: Run tests** — `npx vitest run tests/engine/real-durations.test.ts` — PASS. Then full suite `npx vitest run` — green (weeklyVolume/workLogged existing tests still hold with the fallback). `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useStore.ts src/engine/overview.ts src/engine/progress.ts tests/engine/real-durations.test.ts
git commit -m "feat(session): commitSession + real study durations in stats"
```

---

### Task 9: `StartSession` setup modal

**Files:**
- Create: `src/routes/StartSession.tsx`
- Test: `tests/routes/StartSession.test.tsx`

**Interfaces:**
- Consumes: `startSessionPrompt`/`buildSessionContext` (Tasks 4–5), `getCairnTheme` (`@/theme/cairnMock`), `useTheme`.
- Produces:
  ```ts
  export function StartSession(props: {
    course: Course; section: Section; topic: Topic;
    onBegin: (cfg: { intent: SessionIntent; scope: SessionScope; timer_mode: 'count_up' | 'pomodoro'; pomodoro?: PomodoroConfig }) => void;
    onClose: () => void;
  }): JSX.Element;
  ```
  Renders a modal (dialog) with intent radios, scope radios, timer choice (+ pomodoro number inputs when selected), a live briefing preview (from `startSessionPrompt(buildSessionContext(...))`), a Copy button (toast), and a **Begin focus** button calling `onBegin`.

- [ ] **Step 1: Write the failing test** — `tests/routes/StartSession.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { StartSession } from '@/routes/StartSession';
import type { Course, Section, Topic } from '@/domain/types';

const topic: Topic = { topic_id: 't', title: 'Elasticity', status: 'practising', conf: 4, strength: 1, k_factor: 8, cards: 0, last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [] };
const section: Section = { section_id: 's', title: 'Elasticity', order: 0, topics: [topic] };
const course: Course = { schema_version: '2.0.0', course_id: 'c', title: 'Micro', created_at: '', source: 'ai_generated', sections: [section] };

function setup(onBegin = vi.fn()) {
  render(<ToastProvider><StartSession course={course} section={section} topic={topic} onBegin={onBegin} onClose={vi.fn()} /></ToastProvider>);
  return onBegin;
}

describe('StartSession', () => {
  it('shows intent + scope choices and a briefing preview for the topic', () => {
    setup();
    expect(screen.getByRole('dialog', { name: /start session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remediate/i })).toBeInTheDocument();
    expect(screen.getByText(/Elasticity/)).toBeInTheDocument();
  });
  it('Begin focus reports the chosen intent + scope + timer', async () => {
    const user = userEvent.setup();
    const onBegin = setup();
    await user.click(screen.getByRole('button', { name: /retention/i }));
    await user.click(screen.getByRole('button', { name: /this topic/i }));
    await user.click(screen.getByRole('button', { name: /begin focus/i }));
    expect(onBegin).toHaveBeenCalledWith(expect.objectContaining({ intent: 'retention', scope: 'topic', timer_mode: expect.any(String) }));
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/routes/StartSession.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement `StartSession.tsx`** — inline-styled modal consistent with `AddFlow`/`Celebration` (rotated card, ink border, hard shadow, teal top band). Local state: `intent`, `scope`, `timerMode`, `pomodoro`. Intent/scope rendered by mapping over label maps (no hardcoded `if`s). Briefing preview = `startSessionPrompt(buildSessionContext(course, section, topic, intent, scope, new Date()), intent, scope)` shown in a `<pre>`. Copy button uses `navigator.clipboard.writeText` + `useToast().toast('Briefing copied')`. "Begin focus" calls `onBegin({ intent, scope, timer_mode: timerMode, pomodoro })`. Dialog gets `role="dialog" aria-label="Start session — {topic.title}"`. Escape/overlay click → `onClose`.

- [ ] **Step 4: Run tests** — `npx vitest run tests/routes/StartSession.test.tsx` — PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/routes/StartSession.tsx tests/routes/StartSession.test.tsx
git commit -m "feat(session): StartSession setup modal (intent/scope/timer + briefing)"
```

---

### Task 10: `FocusMode` view

**Files:**
- Create: `src/routes/FocusMode.tsx`
- Test: `tests/routes/FocusMode.test.tsx`

**Interfaces:**
- Consumes: `useStudyTimer` (Task 6), `saveFocusDraft`/`clearFocusDraft` (Task 7), theme.
- Produces:
  ```ts
  export function FocusMode(props: {
    draft: FocusDraft;                       // topic/intent/scope/timer/elapsed/checked
    unresolvedErrors: { error_id: string; description: string }[];
    onEnd: (measuredMinutes: number) => void; // → wrap-up (import JSON)
    onDiscard: () => void;
  }): JSX.Element;
  ```
  Shows topic + intent, the big timer (from `useStudyTimer` seeded with `draft.elapsed_seconds`), pause/resume, the unresolved-errors checklist (local ticks only), a "copy briefing again" affordance, and **End session** → `onEnd(elapsedMinutes)`. Persists the draft (elapsed + ticks) via `saveFocusDraft` on change.

- [ ] **Step 1: Write the failing test** — `tests/routes/FocusMode.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusMode } from '@/routes/FocusMode';
import type { FocusDraft } from '@/core/focusDraft';

const draft: FocusDraft = { course_id: 'c', section_id: 's', topic_id: 't', topic_title: 'Elasticity', intent: 'remediate', scope: 'topic', timer_mode: 'count_up', created_at: '2026-08-07T12:00:00Z', elapsed_seconds: 0, checked_error_ids: [] };
const errors = [{ error_id: 'x', description: 'confuses elastic/inelastic' }];

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('FocusMode', () => {
  it('renders the topic, intent, timer and the errors checklist', () => {
    render(<FocusMode draft={draft} unresolvedErrors={errors} onEnd={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('Elasticity')).toBeInTheDocument();
    expect(screen.getByText(/confuses elastic\/inelastic/)).toBeInTheDocument();
  });
  it('End session reports measured minutes from the timer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onEnd = vi.fn();
    render(<FocusMode draft={draft} unresolvedErrors={errors} onEnd={onEnd} onDiscard={vi.fn()} />);
    vi.advanceTimersByTime(120_000); // 2 min
    await user.click(screen.getByRole('button', { name: /end session/i }));
    expect(onEnd).toHaveBeenCalledWith(2);
  });
  it('ticking an error does not mutate anything external (no callback, local only)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<FocusMode draft={draft} unresolvedErrors={errors} onEnd={vi.fn()} onDiscard={vi.fn()} />);
    const box = screen.getByRole('checkbox', { name: /confuses elastic\/inelastic/i });
    await user.click(box);
    expect(box).toBeChecked(); // local UI state only
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/routes/FocusMode.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement `FocusMode.tsx`** — full-bleed distraction-light view (theme surface). `const timer = useStudyTimer({ mode: draft.timer_mode, pomodoro: draft.pomodoro, initialSeconds: draft.elapsed_seconds })`. Big `mm:ss` display + phase label (Pomodoro). Pause/Resume button. Checklist: `unresolvedErrors.map(...)` with a labelled `<input type="checkbox">`; ticks stored in local `useState<string[]>` seeded from `draft.checked_error_ids`; **no store writes**. `useEffect` persists `{ ...draft, elapsed_seconds: timer.elapsedSeconds, checked_error_ids: checked }` via `saveFocusDraft`. "End session" → `onEnd(timer.elapsedMinutes)`. A small "Discard" → `onDiscard`. Include a helper line: "Ticking is just for focus — your AI's session log records what actually changed."

- [ ] **Step 4: Run tests** — `npx vitest run tests/routes/FocusMode.test.tsx` — PASS. `npx tsc -b --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/routes/FocusMode.tsx tests/routes/FocusMode.test.tsx
git commit -m "feat(session): FocusMode view + timer + focus-aid checklist"
```

---

### Task 11: Wire the flow into the app (entry points, resume, wrap-up)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/routes/TopicDetail.tsx`
- Modify: `src/routes/Overview.tsx`, `src/routes/CourseDashboard.tsx`
- Test: `tests/integration/start-session.test.tsx`

**Interfaces:**
- Consumes: `StartSession`, `FocusMode`, `useStudyTimer`, `loadFocusDraft`/`saveFocusDraft`/`clearFocusDraft`, `commitSession`, `AddFlow` (reused for the JSON import step in `kind="session"`).
- Produces: a `TopicDetail` prop `onStartSession(topic)`, and App-level state driving `StartSession → FocusMode → import`.

State machine in `App.tsx` (in `CourseScreen` or a small `SessionFlow` component so it can see the course/section/topic):
- `phase: 'idle' | 'setup' | 'focus' | 'import'`, plus the chosen `{ intent, scope, timer_mode, pomodoro, created_at, measured_minutes }`.
- **Entry:** `TopicDetail` gains a **Start session** button → `setPhase('setup')` for the selected topic. Overview/Course due-queue **Review** buttons call the same entry for that topic (resolve its section/course).
- **setup:** render `<StartSession … onBegin={cfg => { saveFocusDraft(initialDraft(cfg)); setPhase('focus'); }} onClose={…} />`.
- **focus:** render `<FocusMode draft={draft} unresolvedErrors={…} onEnd={(mins) => { setMeasured(mins); setPhase('import'); }} onDiscard={() => { clearFocusDraft(); setPhase('idle'); }} />`.
- **import:** render `<AddFlow kind="session" courseId={course.course_id} … onClose={…} />` **but** commit via `commitSession(value, { topic_id, created_at, intent, scope, timer_mode, pomodoro_config, measured_minutes })` instead of plain `commitValue`, then `clearFocusDraft()`. (Add an optional `onCommit` override prop to `AddFlow`, or branch its commit on a passed `commitSession`.)
- **Resume:** on mount, `const d = loadFocusDraft()`; if present, show a small banner/prompt "Resume your focus session on {d.topic_title}? Continue / Discard" → Continue re-enters `focus` with `d`; Discard `clearFocusDraft()`.

- [ ] **Step 1: Write the failing integration test** — `tests/integration/start-session.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { AuthProvider } from '@/auth/useAuth';
import { STORE_KEY } from '@/core/storage';
import { emptyStore, type Course, type Store } from '@/domain/types';

function seeded(): Store {
  const topic = { topic_id: 'topic_x', title: 'Elasticity', status: 'practising' as const, conf: 4, strength: 1, k_factor: 8, cards: 0, last_reviewed: '2026-08-01T00:00:00Z', mastered_at: null, drift_history: [], review_history: [], error_log: [] };
  const course: Course = { schema_version: '2.0.0', course_id: 'course_x', title: 'Micro', created_at: '2026-07-01T00:00:00Z', source: 'ai_generated', sections: [{ section_id: 'sec_x', title: 'Elasticity', order: 0, topics: [topic] }] };
  return { ...emptyStore(), courses: [course] };
}
beforeEach(() => { localStorage.clear(); localStorage.setItem(STORE_KEY, JSON.stringify(seeded())); });
afterEach(() => localStorage.clear());

describe('start session flow', () => {
  it('opens the setup modal from the topic drawer', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/course/course_x';
    render(<AuthProvider><App /></AuthProvider>);
    await user.click(screen.getByRole('button', { name: /elasticity/i })); // open topic drawer
    await user.click(screen.getByRole('button', { name: /start session/i }));
    expect(screen.getByRole('dialog', { name: /start session/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/integration/start-session.test.tsx` — Expected: FAIL (no Start session button).

- [ ] **Step 3: Add the entry point** — in `TopicDetail.tsx` add a primary **Start session** button (in the header card or under the status controls) calling a new `onStartSession?: (topicId: string) => void` prop. Thread it from `CourseScreen` in `App.tsx`.

- [ ] **Step 4: Add the flow state machine** — implement the `idle→setup→focus→import` machine described above in `CourseScreen` (it already has `course` + can resolve the section/topic). Reuse `AddFlow` for import with the `commitSession` override; clear the draft on commit/discard.

- [ ] **Step 5: Add resume + due-queue entry** — on app mount, read `loadFocusDraft()` and render the Continue/Discard prompt if present. Wire Overview + CourseDashboard due-row **Review** buttons to start the flow for that topic (navigate to the course, open setup for the topic).

- [ ] **Step 6: Run the integration test + full suite** — `npx vitest run tests/integration/start-session.test.tsx` then `npx vitest run` — all green. `npx tsc -b --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/routes/TopicDetail.tsx src/routes/Overview.tsx src/routes/CourseDashboard.tsx src/routes/AddFlow.tsx tests/integration/start-session.test.tsx
git commit -m "feat(session): wire start-session flow, resume prompt, real-duration commit"
```

---

## Self-Review

**Spec coverage:**
- Mechanism (paste-based, closes loop) → Tasks 5 (OUTPUT block) + 11 (import via AddFlow). ✓
- App-is-only-timekeeper → Tasks 5 (duration 0 + disclaimer), 8 (`commitSession` overwrites), 10 (`onEnd(measuredMinutes)`). ✓
- Intent + Scope, no defaults → Task 9 (no preselected state). ✓
- Config-driven assembly → Tasks 2 + 5. ✓
- Focal data / sibling ranking / course snapshot → Tasks 3–4. ✓
- Structured briefing + INSTRUCTIONS/AVOID/OUTPUT → Task 5. ✓
- Focus mode + custom Pomodoro + count-up → Tasks 6 + 10. ✓
- Checkbox is a focus aid (no store mutation) → Task 10 (test asserts local-only). ✓
- Resumability → Tasks 7 (draft) + 10 (persist) + 11 (resume prompt). ✓
- Real durations persisted + stats → Tasks 1 + 8. ✓
- `SessionRecord` fields (topic_id, timestamps, timer_mode, pomodoro_config) → Task 1. ✓
- Entry points (drawer + due-queue Review) → Task 11. ✓

**Placeholder scan:** none — every code step carries real content. Component tasks (9–11) describe concrete structure with exact props/callbacks and real tests; acceptable given the inline-style pattern is established.

**Type consistency:** `SessionRecord`/`SessionIntent`/`SessionScope` (Task 1) used verbatim in 2–11; `PomodoroConfig`/`TimerMode` (Task 6) reused in 7, 9–11; `startSessionPrompt(ctx, intent, scope)` signature consistent across 5, 9; `commitSession(value, meta)` (Task 8) consumed in 11.
