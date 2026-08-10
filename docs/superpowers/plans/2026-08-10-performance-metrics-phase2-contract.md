# Performance Metrics — Phase 2: Tutor Contract — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tutor JSON actually carry the Phase 1 assessment fields — extend the Ajv schemas and the merge/decompose layer additively, apply the exam-level cold fallback, and bump the schema version — with no behaviour change to any existing metric and full backward compatibility.

**Architecture:** Three additive changes. (1) Bump `SCHEMA_VERSION` `3.1.0 → 3.2.0` — no migration, because the new fields are optional and old stores load verbatim. (2) Add a shared `ASSESSMENT_EVIDENCE` Ajv object and attach it to the review-event, session, exam-breakdown, and topic schemas, plus a top-level exam `cold` flag. (3) In `merge.ts`, copy the tutor's `assessment` block onto the `ReviewEvent` it already builds, applying the three-case exam-level cold fallback. Nothing reads these values yet — that is Phase 3.

**Tech Stack:** TypeScript 5.6 (strict), Ajv 8 (`additionalProperties: false`, `ajv-formats` for `date-time`), Vitest 2.1.4.

## Global Constraints

- **Purely additive, optional (design §C; requirement #15).** No new *required* field in any schema. Every existing course/session/exam JSON that omits the new fields must still validate and merge byte-for-byte as before.
- **Read-side-only invariant (design §A).** Phase 2 only *stores* the values (schema + merge pass-through). It must not read them into `retention`, `k_factor`, `strength`, `health`, `topicLevel`, EXP, mastery, badges, OCI, or projections. `applyEvent` is untouched.
- **No manufactured values (design §B, §14).** The only value the tracker ever synthesises is `assessment.cold = true`, and only under the explicit exam-level cold fallback (Task 3). Every other dimension is copied verbatim or left absent — never defaulted, inferred, or zero-filled.
- **Exam-level cold fallback is a THREE-way rule (design §C, review gap).** For each linked topic of an exam with top-level `cold: true`: (1) per-breakdown `assessment.cold` present → it wins; (2) per-breakdown `assessment` exists but has no `cold` → fill `cold: true`; (3) no per-breakdown `assessment` at all (including the no-breakdown uniform/smeared path) → **construct** a minimal `{ cold: true }` block rather than skipping the topic. All three are named test cases in Task 3.
- **`predicted_at` is stored, not yet enforced.** Phase 2 accepts and passes it through verbatim. The strictly-before-completion foresight check is a Phase 3 calibration concern (design §D) — do not add timing logic here.
- **Baseline is NOT fully green — do not chase pre-existing failures.** The branch carries **18 pre-existing UI-test failures** in exactly three files: `tests/integration/app-smoke.test.tsx`, `tests/routes/CourseDashboard.test.tsx`, `tests/routes/TopicDetail.test.tsx` (mid-refactor base; reconciling work is stashed). Verify against `npm run typecheck` + `tests/domain tests/engine tests/core` (green) and treat `npm test` as *"still exactly those 3 files failing, nothing new."*
- **Naming:** storage/JSON field names are snake_case (`transfer_level`, `predicted_at`, `quality_rationale`); no subject-specific terminology.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/domain/types.ts` | Domain + ingestion-input types. | Modify: bump `SCHEMA_VERSION` (Task 1); add `assessment?` to `SessionTopicEntry`/`ExamBreakdownEntry` and `cold?` to `Exam` (Task 3). |
| `src/domain/schemas.ts` | Ajv encoding of the ingestion contract. | Modify: add `ASSESSMENT_EVIDENCE`; attach to `REVIEW_EVENT`, `SESSION_SCHEMA`, `EXAM_SCHEMA` (breakdown + top-level `cold`), `TOPIC.prerequisites` (Task 2). |
| `src/core/merge.ts` | Decompose ingestion objects into events. | Modify: pass `assessment` through in `mergeSession`; add `resolveExamAssessment` + wire into `mergeExam` (Task 3). |
| `tests/domain/schema-version.test.ts` | Version bump + backward-compat load. | Create (Task 1). |
| `tests/domain/schema-assessment.test.ts` | Schema accepts new fields / rejects bad ones / still accepts legacy JSON. | Create (Task 2). |
| `tests/core/merge-assessment.test.ts` | Merge pass-through + the three-case cold fallback. | Create (Task 3). |

Not changed (verified during planning): `detect.ts` (keys only on `sections`/`topics_covered`/`linked_topic_ids` discriminators), `storage.ts`/`migrations.ts` (additive-optional bump needs no migration; `migrate` carries data verbatim and only recomputes for stores `< '3.1.0'`), `errorTranslation.ts` (its generic fallback already covers new error paths — no silent failure), `recalculate.ts` (read-side invariant).

---

## Task 1: Bump `SCHEMA_VERSION` to 3.2.0 + backward-compat load

The version stamp for the extended contract. No migration: old stores load verbatim.

**Files:**
- Modify: `src/domain/types.ts:9`
- Test: `tests/domain/schema-version.test.ts`

**Interfaces:**
- Consumes: existing `SCHEMA_VERSION` const, `emptyStore()`, `loadStore()` (`@/core/storage`), `STORE_KEY` (`@/core/storage`).
- Produces: `SCHEMA_VERSION === '3.2.0'`.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/schema-version.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, emptyStore } from '@/domain/types';
import { STORE_KEY, loadStore } from '@/core/storage';

afterEach(() => localStorage.clear());

describe('schema version 3.2.0 (Performance contract)', () => {
  it('the app version is 3.2.0', () => {
    expect(SCHEMA_VERSION).toBe('3.2.0');
    expect(emptyStore().schema_version).toBe('3.2.0');
  });

  it('a 3.1.0 store (no assessment / prerequisites fields) loads intact and is stamped current', () => {
    const legacy = {
      schema_version: '3.1.0',
      courses: [
        {
          schema_version: '3.1.0', course_id: 'course_1', title: 'C',
          created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
          sections: [{
            section_id: 'section_1', title: 'S', order: 0,
            topics: [{
              topic_id: 'topic_a', title: 'T', status: 'practising', conf: 3,
              strength: 1, k_factor: 8.4, cards: 0,
              last_reviewed: '2026-08-01T00:00:00.000Z', mastered_at: null,
              drift_history: [], review_history: [
                { event_id: 'event_1', date: '2026-08-01T00:00:00.000Z',
                  kind: 'study_review', source: 'session', source_id: 'session_1',
                  confidence_reported: 3 },
              ], error_log: [],
            }],
          }],
        },
      ],
      exams: [],
      sessions: [],
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(legacy));

    const store = loadStore();

    // Stamped to current, but no field invented on the historical event/topic.
    expect(store.schema_version).toBe('3.2.0');
    const topic = store.courses[0]!.sections[0]!.topics[0]!;
    expect(topic.prerequisites).toBeUndefined();
    expect(topic.review_history[0]!.assessment).toBeUndefined();
    expect(store.courses).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/domain/schema-version.test.ts`
Expected: FAIL — `expected '3.1.0' to be '3.2.0'`.

- [ ] **Step 3: Bump the version**

In `src/domain/types.ts:9`, change:

```ts
export const SCHEMA_VERSION = '3.2.0';
```

- [ ] **Step 4: Run the test + storage regression**

Run: `npx vitest run tests/domain/schema-version.test.ts tests/core/storage.test.ts tests/domain/session-record.test.ts`
Expected: PASS. (`storage.test.ts` reads the `SCHEMA_VERSION` constant, so its assertions auto-follow the bump; the `session-record` legacy-load test still passes because `'3.0.0' < '3.2.0'`.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts tests/domain/schema-version.test.ts
git commit -m "feat(domain): bump SCHEMA_VERSION to 3.2.0 for the assessment contract

Additive-optional contract extension — no migration. Old stores load
verbatim (loadStore only rejects newer-than-app); the bump is just the
stamp. Backward-compat load test included.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Ajv schema — `ASSESSMENT_EVIDENCE`, exam `cold`, `TOPIC.prerequisites`

Encode the extended contract so tutor JSON carrying the new fields validates, bad values are rejected, and legacy JSON still passes.

**Files:**
- Modify: `src/domain/schemas.ts` (add `ASSESSMENT_EVIDENCE` after `TEST_EVIDENCE` ~line 49; attach in `REVIEW_EVENT` ~line 62, `TOPIC` ~line 100, `SESSION_SCHEMA` topics_covered ~line 170, `EXAM_SCHEMA` breakdown ~line 200 and top-level ~line 187)
- Test: `tests/domain/schema-assessment.test.ts`

**Interfaces:**
- Consumes: existing `validateAgainst` (`@/core/validate`), `ID_PATTERN`, `ISO_DATETIME`, `SchemaObject`.
- Produces: `ASSESSMENT_EVIDENCE` schema object (module-local); `assessment` accepted on review events / session topics / exam breakdown items; `cold` accepted at exam top level; `prerequisites` accepted on course topics.

- [ ] **Step 1: Write the failing test**

Create `tests/domain/schema-assessment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateAgainst } from '@/core/validate';

const fullAssessment = {
  difficulty: 4, novelty: 3, independence: 3, transfer_level: 2,
  performance_quality: 5, quality_rationale: 'clear method', cold: true,
  predicted_success: 0.7, predicted_at: '2026-08-10T09:00:00.000Z',
  assessed_by: 'tutor:opus',
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '3.2.0', session_id: 'session_1', course_id: 'course_1',
    date: '2026-08-10T10:00:00.000Z', duration_minutes: 0,
    topics_covered: [{ topic_id: 'topic_a', confidence_reported: 4, ...overrides }],
  };
}

function exam(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '3.2.0', exam_id: 'exam_1', title: 'E',
    date: '2026-08-10T10:00:00.000Z', linked_topic_ids: ['topic_a'],
    score: 8, max_score: 10, ...overrides,
  };
}

describe('assessment schema — acceptance', () => {
  it('accepts a session topic carrying a full assessment block', () => {
    expect(validateAgainst('session', session({ assessment: fullAssessment })).ok).toBe(true);
  });

  it('accepts an exam with top-level cold and a breakdown assessment', () => {
    const r = validateAgainst('exam', exam({
      cold: true,
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10, assessment: { difficulty: 3 } }],
    }));
    expect(r.ok).toBe(true);
  });

  it('accepts an exam with top-level cold and no breakdown', () => {
    expect(validateAgainst('exam', exam({ cold: true })).ok).toBe(true);
  });

  it('accepts a course topic declaring prerequisites', () => {
    const course = {
      schema_version: '3.2.0', course_id: 'course_1', title: 'C',
      created_at: '2026-08-10T00:00:00.000Z', source: 'manual',
      sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
        topic_id: 'topic_c', title: 'T', status: 'not_started', conf: 1,
        strength: 0, k_factor: 8.4, cards: 0, last_reviewed: null,
        drift_history: [], review_history: [], error_log: [],
        prerequisites: ['topic_a', 'topic_b'],
      }] }],
    };
    expect(validateAgainst('course', course).ok).toBe(true);
  });
});

describe('assessment schema — backward compatibility', () => {
  it('still accepts a legacy session with no assessment', () => {
    expect(validateAgainst('session', session()).ok).toBe(true);
  });
  it('still accepts a legacy exam with no cold / no breakdown assessment', () => {
    expect(validateAgainst('exam', exam({
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10 }],
    })).ok).toBe(true);
  });
});

describe('assessment schema — rejection', () => {
  it('rejects an out-of-range difficulty (6)', () => {
    expect(validateAgainst('session', session({ assessment: { difficulty: 6 } })).ok).toBe(false);
  });
  it('rejects predicted_success outside 0–1', () => {
    expect(validateAgainst('session', session({ assessment: { predicted_success: 1.5 } })).ok).toBe(false);
  });
  it('rejects an unknown key inside assessment (additionalProperties:false)', () => {
    expect(validateAgainst('session', session({ assessment: { made_up: 1 } })).ok).toBe(false);
  });
  it('rejects a malformed predicted_at (Ajv date-time format assertion)', () => {
    // The one field whose only runtime guard is the format assertion — a bad
    // date-time from a tutor paste must not slip through as a valid string.
    expect(validateAgainst('session', session({ assessment: { predicted_at: 'not-a-date' } })).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/domain/schema-assessment.test.ts`
Expected: FAIL — the acceptance tests fail because `additionalProperties: false` currently rejects `assessment`/`cold`/`prerequisites` (e.g. *"must NOT have additional properties"*).

- [ ] **Step 3: Add the `ASSESSMENT_EVIDENCE` schema object**

In `src/domain/schemas.ts`, immediately after the `TEST_EVIDENCE` object (~line 49), add:

```ts
// Design 2026-08-10 §B. Every dimension optional (partial applicability, #16);
// additionalProperties:false so a hallucinated dimension fails rather than being
// silently accepted (§1.5). Ordinals are integers with explicit bounds.
const ASSESSMENT_EVIDENCE: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    difficulty: { type: 'integer', minimum: 0, maximum: 5 },
    novelty: { type: 'integer', minimum: 0, maximum: 4 },
    independence: { type: 'integer', minimum: 0, maximum: 3 },
    transfer_level: { type: 'integer', minimum: 0, maximum: 3 },
    performance_quality: { type: 'integer', minimum: 0, maximum: 5 },
    quality_rationale: { type: 'string', maxLength: 1000 },
    cold: { type: 'boolean' },
    // 0–1 probability. Stored now; the strictly-before-completion foresight
    // check for calibration is a Phase 3 concern (design §D).
    predicted_success: { type: 'number', minimum: 0, maximum: 1 },
    predicted_at: ISO_DATETIME,
    assessed_by: { type: 'string', maxLength: 200 },
  },
};
```

- [ ] **Step 4: Attach `assessment` to the review-event schema**

In `REVIEW_EVENT.properties` (~line 62, alongside `notes`), add:

```ts
    assessment: ASSESSMENT_EVIDENCE,
```

- [ ] **Step 5: Attach `prerequisites` to the topic schema**

In `TOPIC.properties` (~line 115, after `error_log`), add:

```ts
    // Design 2026-08-10 §E — optional upstream dependency list (topic_ids).
    prerequisites: { type: 'array', items: ID_PATTERN('topic') },
```

- [ ] **Step 6: Attach `assessment` to the session topic-entry schema**

In `SESSION_SCHEMA` → `topics_covered.items.properties` (~line 170, after `errors`), add:

```ts
          assessment: ASSESSMENT_EVIDENCE,
```

- [ ] **Step 7: Attach `assessment` to the exam breakdown-entry schema and `cold` at exam top level**

In `EXAM_SCHEMA.properties.breakdown.items.properties` (~line 206, after `errors`), add:

```ts
          assessment: ASSESSMENT_EVIDENCE,
```

And in `EXAM_SCHEMA.properties` (~line 187, after `confidence_reported`), add:

```ts
    // Design 2026-08-10 §C — tutor marks the whole paper cold; per-breakdown
    // assessment.cold overrides per topic (fallback resolved in merge.ts).
    cold: { type: 'boolean' },
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/domain/schema-assessment.test.ts`
Expected: PASS (all acceptance, backward-compat, and rejection cases).

Run: `npx vitest run tests/core/pipeline.test.ts tests/core/detect.test.ts`
Expected: PASS — existing ingestion/detection unaffected.

- [ ] **Step 9: Commit**

```bash
git add src/domain/schemas.ts tests/domain/schema-assessment.test.ts
git commit -m "feat(schema): accept assessment block, exam cold, topic prerequisites

Add ASSESSMENT_EVIDENCE (all-optional, ordinal-bounded, additionalProperties
false) and attach to review events, session topics, exam breakdown; add
top-level exam cold and topic prerequisites. Additive — legacy JSON still
validates; out-of-range and hallucinated dimensions are rejected.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Merge pass-through + three-case exam-level cold fallback

Carry the tutor's `assessment` onto the `ReviewEvent`, and resolve exam-level `cold` across all three per-breakdown states.

**Files:**
- Modify: `src/domain/types.ts` (add `SessionTopicEntry.assessment?`, `ExamBreakdownEntry.assessment?`, `Exam.cold?`)
- Modify: `src/core/merge.ts` (import `AssessmentEvidence`; pass-through in `mergeSession`; add `resolveExamAssessment` + wire into `mergeExam`)
- Test: `tests/core/merge-assessment.test.ts`

**Interfaces:**
- Consumes: `AssessmentEvidence` (`@/domain/types`), existing `applyEvent`, `mergeInto`, `makeId`.
- Produces:
  - `SessionTopicEntry.assessment?: AssessmentEvidence`
  - `ExamBreakdownEntry.assessment?: AssessmentEvidence`
  - `Exam.cold?: boolean`
  - `resolveExamAssessment(entryAssessment: AssessmentEvidence | undefined, examCold: boolean): AssessmentEvidence | undefined` (exported from `merge.ts`)
  - Post-merge: a session/exam event carries `event.assessment` when the tutor supplied one (or when the exam-level cold fallback constructs one).

- [ ] **Step 1: Add the ingestion-input type fields**

In `src/domain/types.ts`:

`SessionTopicEntry` (~line 108) — add after `errors?`:
```ts
  assessment?: AssessmentEvidence;
```

`ExamBreakdownEntry` (~line 124) — add after `errors?`:
```ts
  assessment?: AssessmentEvidence;
```

`Exam` (~line 132) — add after `breakdown?`:
```ts
  /** Tutor-marked cold paper (design 2026-08-10 §C). Applied to every linked
   *  topic's event unless a per-breakdown assessment.cold overrides. */
  cold?: boolean;
```

- [ ] **Step 2: Write the failing test**

Create `tests/core/merge-assessment.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeInto, resolveExamAssessment } from '@/core/merge';
import { emptyStore, type Course, type Exam, type Store, type StudySession } from '@/domain/types';

function storeWithTopic(id = 'topic_a'): Store {
  const course: Course = {
    schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [{
      topic_id: id, title: 'T', status: 'practising', conf: 3, strength: 1,
      k_factor: 8.4, cards: 0, last_reviewed: '2026-08-01T00:00:00.000Z',
      mastered_at: null, drift_history: [], review_history: [], error_log: [],
    }] }],
  };
  const s = emptyStore(); s.courses.push(course); return s;
}

function lastEvent(s: Store, topicId = 'topic_a') {
  return s.courses[0]!.sections[0]!.topics.find((t) => t.topic_id === topicId)!.review_history.at(-1)!;
}

describe('resolveExamAssessment — three-case cold fallback', () => {
  it('CASE 1: per-breakdown cold wins over exam-level cold', () => {
    expect(resolveExamAssessment({ cold: false }, true)).toEqual({ cold: false });
  });
  it('CASE 2: block present without cold → exam-level cold fills it, other dims preserved', () => {
    expect(resolveExamAssessment({ difficulty: 3 }, true)).toEqual({ difficulty: 3, cold: true });
  });
  it('CASE 3: no block at all + exam cold → constructs a minimal { cold: true }', () => {
    expect(resolveExamAssessment(undefined, true)).toEqual({ cold: true });
  });
  it('exam not cold + no block → nothing to attach', () => {
    expect(resolveExamAssessment(undefined, false)).toBeUndefined();
  });
  it('exam not cold + block present → block passes through unchanged', () => {
    expect(resolveExamAssessment({ difficulty: 2 }, false)).toEqual({ difficulty: 2 });
  });
  it('does not mutate the caller’s block', () => {
    const input = { difficulty: 3 };
    resolveExamAssessment(input, true);
    expect(input).toEqual({ difficulty: 3 });
  });
});

describe('mergeSession — assessment pass-through', () => {
  it('copies a topic’s assessment onto the event', () => {
    const s = storeWithTopic();
    const session: StudySession = {
      schema_version: '3.2.0', session_id: 'session_1', course_id: 'course_1',
      date: '2026-08-08T00:00:00.000Z', duration_minutes: 0,
      topics_covered: [{ topic_id: 'topic_a', confidence_reported: 4,
        assessment: { independence: 3, transfer_level: 2 } }],
    };
    mergeInto(s, 'session', session);
    expect(lastEvent(s).assessment).toEqual({ independence: 3, transfer_level: 2 });
  });
  it('leaves assessment undefined when the tutor supplied none', () => {
    const s = storeWithTopic();
    const session: StudySession = {
      schema_version: '3.2.0', session_id: 'session_1', course_id: 'course_1',
      date: '2026-08-08T00:00:00.000Z', duration_minutes: 0,
      topics_covered: [{ topic_id: 'topic_a', confidence_reported: 4 }],
    };
    mergeInto(s, 'session', session);
    expect(lastEvent(s).assessment).toBeUndefined();
  });
});

describe('mergeExam — cold fallback applied per topic', () => {
  it('CASE 3 via the no-breakdown (smeared) path: cold paper tags every event', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10, cold: true,
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toEqual({ cold: true });
  });
  it('CASE 2: breakdown assessment without cold gets cold filled', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10, cold: true,
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10, assessment: { difficulty: 4 } }],
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toEqual({ difficulty: 4, cold: true });
  });
  it('non-cold exam with a breakdown assessment passes it through untouched', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10,
      breakdown: [{ topic_id: 'topic_a', points_earned: 8, points_possible: 10, assessment: { difficulty: 4 } }],
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toEqual({ difficulty: 4 });
  });
  it('non-cold exam with no assessment leaves the event assessment undefined', () => {
    const s = storeWithTopic();
    const exam: Exam = {
      schema_version: '3.2.0', exam_id: 'exam_1', title: 'E', date: '2026-08-08T00:00:00.000Z',
      linked_topic_ids: ['topic_a'], score: 8, max_score: 10,
    };
    mergeInto(s, 'exam', exam);
    expect(lastEvent(s).assessment).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/core/merge-assessment.test.ts`
Expected: FAIL — `resolveExamAssessment` is not exported from `@/core/merge` (and events carry no `assessment`).

- [ ] **Step 4: Add `resolveExamAssessment` and the import in `merge.ts`**

At the top of `src/core/merge.ts`, add `AssessmentEvidence` to the type import from `@/domain/types`. Then add the helper (near `testKind`, ~line 43):

```ts
/**
 * Resolve the assessment block for an exam-sourced event, applying the exam-level
 * cold fallback (design 2026-08-10 §C — three cases):
 *  1. per-breakdown assessment.cold present → it wins (leave as-is).
 *  2. per-breakdown assessment exists but has no cold → exam-level cold fills it.
 *  3. no per-breakdown assessment at all → construct a minimal { cold: true }.
 * Returns undefined when there is nothing to attach (no per-topic assessment and
 * the exam isn't cold). Never mutates the caller's block.
 */
export function resolveExamAssessment(
  entryAssessment: AssessmentEvidence | undefined,
  examCold: boolean,
): AssessmentEvidence | undefined {
  if (entryAssessment) {
    const copy: AssessmentEvidence = { ...entryAssessment };
    if (examCold && copy.cold === undefined) copy.cold = true; // case 2 (case 1: untouched)
    return copy;
  }
  if (examCold) return { cold: true }; // case 3
  return undefined;
}
```

- [ ] **Step 5: Wire pass-through into `mergeSession`**

In `mergeSession`, extend the event literal (currently ends with the `notes` spread, ~line 107) to also carry a copied assessment:

```ts
    const event: ReviewEvent = {
      event_id: makeId('event'),
      date: session.date,
      kind: 'study_review',
      source: 'session',
      source_id: session.session_id,
      confidence_reported: entry.confidence_reported,
      ...(entry.notes ? { notes: entry.notes } : {}),
      ...(entry.assessment ? { assessment: { ...entry.assessment } } : {}),
    };
```

- [ ] **Step 6: Wire the fallback into `mergeExam`**

In `mergeExam`, inside the `for (const topicId of exam.linked_topic_ids)` loop, after `const entry = byTopic.get(topicId);`, compute the assessment and add it to the event literal:

```ts
    const assessment = resolveExamAssessment(entry?.assessment, exam.cold === true);

    const event: ReviewEvent = {
      event_id: makeId('event'),
      date: exam.date,
      kind: testKind(earned, possible),
      source: 'exam',
      source_id: exam.exam_id,
      confidence_reported: confidence ?? topic.conf,
      test: {
        score: earned,
        out_of: possible,
        actual_retention: earned / possible,
      },
      smeared: !entry,
      fanout: exam.linked_topic_ids.length,
      ...(assessment ? { assessment } : {}),
    };
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/core/merge-assessment.test.ts`
Expected: PASS (all `resolveExamAssessment`, session, and exam cases).

- [ ] **Step 8: Full verification**

Run: `npm run typecheck`
Expected: GREEN.

Run: `npx vitest run tests/domain tests/engine tests/core`
Expected: PASS — the layer Phase 2 touches is fully green.

Run: `npm test`
Expected: the SAME 3 pre-existing UI files still failing and nothing new (see Global Constraints). Do NOT fix those 3.

- [ ] **Step 9: Commit**

```bash
git add src/domain/types.ts src/core/merge.ts tests/core/merge-assessment.test.ts
git commit -m "feat(merge): carry assessment onto events + exam-level cold fallback

mergeSession/mergeExam copy the tutor's assessment block verbatim. Adds
resolveExamAssessment for the three-case exam-level cold rule: per-breakdown
cold wins; block-without-cold gets filled; no block → minimal { cold: true }
(incl. the no-breakdown smeared path). No other dimension is ever synthesised;
read-side invariant intact (applyEvent untouched).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (design §C — the Phase 2 scope):**
- Schema additions to session/exam/breakdown + `assessment` block → Task 2. ✔
- Exam top-level `cold` + `TOPIC.prerequisites` in schema → Task 2. ✔
- Merge pass-through (`mergeSession`/`mergeExam`) → Task 3. ✔
- **Three-case exam-level cold fallback** (the design-review gap) → `resolveExamAssessment` + three named test cases (CASE 1/2/3) in Task 3, incl. the no-breakdown smeared variant. ✔
- `predicted_at` accepted, not enforced → schema field in Task 2; Global Constraints note; no timing logic. ✔
- Version bump `3.1.0 → 3.2.0`, no migration, backward-compatible load → Task 1. ✔
- Old JSON still validates / old stores load verbatim (#15) → Task 2 backward-compat cases + Task 1 legacy-load test. ✔
- Read-side-only (§A) → Global Constraints; `applyEvent`/`recalculate.ts` untouched; only `cold` is ever synthesised, under the explicit fallback. ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Every step has concrete code or an exact command. ✔

**3. Type consistency:** `AssessmentEvidence` (Phase 1) is reused verbatim. Field names match across schema, types, merge, and tests: `assessment`, `cold`, `difficulty`, `predicted_success`, `predicted_at`, `transfer_level`, `prerequisites`. `resolveExamAssessment(entryAssessment, examCold)` signature is identical in the Interfaces block, Task 3 Step 4 implementation, and the test's direct calls. `Exam.cold`, `SessionTopicEntry.assessment`, `ExamBreakdownEntry.assessment` are defined in Task 3 Step 1 and consumed in Steps 5–6 and the tests. ✔

**4. Gate correctness:** Schema/merge changes are runtime-checkable, so Vitest is the red/green gate here (unlike Phase 1's type-only tests); `npm run typecheck` still runs at Task 3 Step 8 to catch the new input-type wiring. Baseline caveat carried so `npm test` isn't misread. ✔
