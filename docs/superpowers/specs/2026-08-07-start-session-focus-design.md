# Start-session briefing + focus mode — design

**Status:** approved for planning
**Date:** 2026-08-07

## 1. Problem & goal

Today a study session is only ever recorded **retrospectively**: the learner copies
`sessionPrompt`, has their AI log a *completed* session, and pastes the JSON back
(`ingest`/`commit`). There is no way to **start** a session — to brief the AI on what to
focus on *before* studying, and to record the real time spent.

Goal: let the learner **start a focused session for a topic**. The app produces a
structured **briefing** that tells the AI tutor what the session is about and what needs
attention (unresolved errors, faded retention, related gaps), then drops into a
**focus mode** with a study **timer**. When the learner finishes, they import the AI's
session-log JSON, which commits through the existing pipeline — with the **real measured
duration** attached.

This stays within the app's paste-in / paste-out model (no built-in AI calls) and does
not change the retention/health engine. It adds one genuinely new data point: **real
study time** (replacing today's nominal 30-min-per-session proxy).

## 2. Core principle: the app is the only timekeeper

LLMs are unreliable at elapsed time. **All duration comes from the in-app timer, never
from the AI.** The briefing's OUTPUT block instructs the AI to set `duration_minutes` to
`0` ("the app records this"); at commit the app **overwrites** `duration_minutes` with
the measured value, and that measured value is what is persisted. The AI's number is
ignored by construction.

## 3. End-to-end flow

1. **Entry.** A **Start session** button in the topic-detail drawer (primary). The
   due-review "Review" buttons on Overview and the Course dashboard open the same flow
   for that topic.
2. **Setup modal** (`StartSession`). The learner picks, with **no preselected defaults**:
   - **Intent** — `Remediate` · `Retention` · `New content` · `Adaptive`
   - **Scope** — `Clean slate` · `This topic` · `This section` · `Whole course`
   - **Timer** — `Count-up` · `Pomodoro` (then enter work / break / long-break minutes —
     fully custom, no preset)

   The modal shows the generated **briefing** with a **Copy** button. → **Begin focus**.
3. **Focus mode** (`FocusMode`). A distraction-light view: topic + intent, a large
   **timer** (count-up, or Pomodoro cycling work/break/long-break phases), **pause/resume**,
   the topic's **unresolved-errors checklist**, a "copy briefing again" link, and
   **End session**.
4. **Wrap-up.** Ending the timer **awaits import of the session JSON** — the existing
   paste → detect → validate → preview → commit step. On commit the app injects the
   **measured minutes** as the session's `duration_minutes` and records session meta.

The existing standalone **Log session** flow (retrospective) stays as-is for sessions
studied offline/elsewhere; it shares the commit path.

### 3.1 The errors checklist is a focus aid, not a data mutation

Ticking a checkbox in focus mode means only **"I believe I've covered this"** — a personal
prompt to keep on track. It does **not** clear the unresolved error and does **not** change
mastery, health, or the review schedule. The **committed AI session log** (and the topic
drawer's explicit resolve toggle) remain the authoritative source for whether an error is
resolved. Checkbox state lives with the resumable-session state (§3.2) and is discarded
when the session is committed or abandoned; it is never written to the store.

### 3.2 Resumability

A focus session is **resumable until it is committed or explicitly discarded**. Its state
— topic, intent, scope, timer mode/config, elapsed time (or Pomodoro phase + started-at),
and checkbox ticks — is persisted to `localStorage`, so a refresh, tab-away, or full
browser close does not lose elapsed time. On next launch an unfinished session is
**restored**: the learner is offered to **continue** it (re-enter focus mode) or **discard**
it. Only one focus session is active at a time; starting a new one while another is
unfinished prompts to resume or discard the existing one first.

## 4. The briefing (`startSessionPrompt`)

Structured, labelled blocks (LLMs handle structured input better than prose). Example:

```
SESSION
Intent: Remediate
Topic: Price Elasticity of Demand   (Elasticity · Microeconomics)

LEARNER
Retention: 64%   Confidence: 4/5   Overconfident: yes   Status: Practising

UNRESOLVED ERRORS
- Confuses elastic vs inelastic demand
- Misapplies percentage-point change

RELATED TOPICS
- Demand   - Supply   - Revenue

INSTRUCTIONS
Focus entirely on the unresolved errors. Use retrieval before explanation.
Do not move on until each error is corrected.

AVOID
Do not reteach mastered concepts unless retrieval shows they have faded.
Do not estimate how long this took — the app records the time.

OUTPUT
When finished, output ONLY the session-log JSON (no prose, no fences):
{ schema_version, session_id, course_id, date, duration_minutes: 0, topics_covered[] }
Set duration_minutes to 0; the app fills in the real time.
```

### Config-driven assembly (no scope/intent branching)

`startSessionPrompt()` must **assemble blocks from configuration**, not `if (scope === …)`
chains. Two lookup tables drive it:

```ts
// which context blocks each scope contributes
const scopeConfig: Record<SessionScope, Block[]> = {
  clean_slate: ['topic-title'],
  topic:       ['topic-title', 'learner', 'unresolved-errors'],
  section:     ['topic-title', 'learner', 'unresolved-errors', 'related-topics'],
  course:      ['topic-title', 'learner', 'unresolved-errors', 'course-snapshot'],
};

// the INSTRUCTIONS + AVOID copy (and sibling-ranking weights) per intent
const intentConfig: Record<SessionIntent, {
  instructions: string[];
  avoid: string[];
  siblingWeights: { retention: number; errors: number; proximity: number };
}> = {
  remediate: { … }, retention: { … }, new_content: { … }, adaptive: { … },
};
```

`startSessionPrompt(ctx)` maps the scope's block list through a block-renderer registry,
then appends INSTRUCTIONS/AVOID from `intentConfig` and the fixed OUTPUT block. Adding a
scope or intent is a config entry, not new branching. The sibling ranking (§5) reads its
weights from `intentConfig[intent].siblingWeights`.

### Block rules

- **SESSION / TOPIC** — always present (title, section, course).
- **LEARNER / UNRESOLVED ERRORS / RELATED TOPICS / COURSE SNAPSHOT** — included per **scope**
  (§5). Omitted blocks are dropped, not shown empty.
- **INSTRUCTIONS + AVOID** — per **intent** (§6).
- **OUTPUT** — always the session-log schema with the duration disclaimer above.

## 5. Scope → what data is injected

| Scope | Injected |
|---|---|
| **Clean slate** | Topic title only — no learner history. A teach-from-scratch session. |
| **This topic** | Focal topic signals: unresolved errors (typed), retention %, status, confidence + overconfidence flag, recent session notes. |
| **This section** | Focal signals **+** ≤5 relevance-ranked siblings from the same section as *secondary* context (title · status · retention · unresolved-error count). |
| **Whole course** | Focal signals **+** a **course snapshot**: per-section mastery ratio (`Microeconomics — 18/22 mastered`) and a **Top weaknesses** shortlist (≤5, lowest retention / most unresolved errors). No per-topic dump, so it stays compact at any course size. |

### Sibling relevance ranking (This section)

Rank the section's other topics by a score combining:

- **low retention** (more faded → more relevant),
- **unresolved-error count** (more open errors → more relevant),
- **section-order proximity** to the focal topic (immediate previous/next favoured).

Take the top 5. **Intent nudges the weights:** `New content` favours *earlier* (prerequisite)
neighbours; `Retention` favours the *most faded*; `Remediate` favours siblings with open
errors (and may legitimately return none); `Adaptive` uses the balanced score.

## 6. Intent → INSTRUCTIONS + AVOID

- **Remediate** — "Work through the unresolved errors until cleared. Retrieval before
  explanation. Don't move on until each is corrected." Avoid: reteaching solid material.
- **Retention** — "Test recall first, then patch what's faded." Avoid: re-explaining what
  retrieval shows is solid.
- **New content** — "Confirm the foundation briefly, then extend / move to what's next."
  Avoid: reteaching mastered concepts unless retrieval shows they've faded.
- **Adaptive** — "Here is the full picture; spend time where it's weakest." Avoid:
  spreading thin; prioritise retrieval over exposition.

All intents include: "Do not estimate elapsed time — the app records it."

## 7. Data model — real study time (additive)

`Store` gains an optional session log (default `[]`; legacy stores migrate to empty, no
data loss):

```ts
interface SessionRecord {
  session_id: string;
  topic_id: string;         // focal topic — enables per-topic / per-section / most-studied
                            // queries without recovering it from the imported JSON
  course_id: string;
  created_at: string;       // ISO — when the session (timer) was started
  completed_at: string;     // ISO — when it was committed
  duration_minutes: number; // MEASURED by the app timer — authoritative
  intent: SessionIntent;    // 'remediate' | 'retention' | 'new_content' | 'adaptive'
  scope: SessionScope;      // 'clean_slate' | 'topic' | 'section' | 'course'
  timer_mode: 'count_up' | 'pomodoro';
  pomodoro_config?: { work_minutes: number; break_minutes: number; long_break_minutes: number };
}
interface Store { /* … */ sessions: SessionRecord[]; }
```

Rationale for the extra fields: `topic_id` keeps analytics ("time on Elasticity",
"most-studied topic", "time per section" via topic→section) a direct query. `timer_mode`
+ `pomodoro_config` let us later answer "does Pomodoro improve completion?". Separate
`created_at`/`completed_at` (rather than a single `date`) leave room for interruptions,
breaks, and average-start-time analysis without another migration.

- On committing a **focus** session, append a `SessionRecord` with the measured minutes.
- `engine/overview.weeklyVolume` and `engine/progress.workLogged` **prefer** real
  durations from `store.sessions` (matched by `session_id` = the review events' `source_id`),
  falling back to the current nominal 30-min proxy for sessions with no record
  (retrospective / AI-logged).
- **Migration:** `core/storage` load defaults a missing `sessions` to `[]`. Bump the store
  `SCHEMA_VERSION` accordingly; the additive field needs no data transform.

The AI-supplied `duration_minutes` is always discarded/overwritten (it is `0` by
instruction anyway).

## 8. Components & modules

- **`src/domain/prompts.ts`** — add `startSessionPrompt(ctx)` (structured builder).
- **`src/engine/session.ts`** (new) — `buildSessionContext(store, course, topic, intent, scope, now)`
  returning focal signals, ranked siblings, and/or course snapshot; plus the sibling
  ranking + snapshot helpers. Pure, unit-tested.
- **`src/hooks/useStudyTimer.ts`** (new) — count-up + fully-custom Pomodoro; pause/resume;
  returns elapsed minutes and the current phase. Respects `prefers-reduced-motion` for any
  phase transitions.
- **Resumable-session draft** — the in-progress session (topic, intent, scope, timer
  mode/config, elapsed/started-at + phase, checkbox ticks) is persisted to a **dedicated
  `localStorage` key** (e.g. `cairn-focus-session`), separate from the domain store. It is
  written live during focus mode, restored on launch (continue/discard), and cleared on
  commit or discard. The domain store only ever receives the committed `SessionRecord`.
- **`src/routes/StartSession.tsx`** (new) — setup modal (intent/scope/timer pickers +
  briefing preview + Copy). Styled with the `cairnMock` theme, consistent with `AddFlow`.
- **`src/routes/FocusMode.tsx`** (new) — focus view + timer + errors checklist + End.
- **Resume prompt** — on launch, if a focus-session draft exists, offer Continue / Discard
  (a small prompt surfaced from the app shell).
- **Wiring:** `TopicDetail` gains the Start-session button; due-queue Review buttons in
  `Overview` + `CourseDashboard` open the flow; `useStore` gains a `recordSession(meta)`
  action (or a `commitValue` variant) that commits the session **and** appends the
  `SessionRecord` (with `topic_id`, `created_at`/`completed_at`, `timer_mode`,
  `pomodoro_config`). Reuses the existing `ingest`/`commit` pipeline for the JSON.

## 9. Testing

- `engine/session` — sibling ranking (relevance ordering, ≤5 cap, intent weighting),
  course-snapshot compaction, and context assembly per scope. Pure functions.
- `startSessionPrompt` — includes/omits blocks per scope; OUTPUT always carries the
  duration disclaimer; intent drives INSTRUCTIONS/AVOID.
- `useStudyTimer` — count-up accrual, Pomodoro phase transitions, pause/resume.
- Resumability — a draft persists across reload and is restored (continue/discard); a
  committed or discarded session clears the draft.
- Checkbox semantics — ticking an error does **not** mutate the store (no change to
  `error_log`, mastery, or health); it lives only in the draft.
- Commit path — a focus session persists a `SessionRecord` with the **measured** minutes,
  `topic_id`, and timestamps; `weeklyVolume`/`workLogged` use real durations and fall back
  to the proxy otherwise.
- Honesty — the AI's `duration_minutes` never reaches storage.

## 10. Out of scope (YAGNI)

- No prerequisite graph — relatedness is derived from section membership + weakness/order.
- No cross-course context in a briefing.
- No topicless / free-floating sessions — a session is always anchored to a topic.
- No OS/desktop notifications for Pomodoro phases (in-page only).
- No change to the retention/health/leveling math.
