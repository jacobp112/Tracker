import type { Course, Section, SessionIntent, SessionScope, Topic } from '@/domain/types';
import { retentionPct } from '@/engine/retention';

export interface SessionContext {
  topic: { title: string; sectionTitle: string; courseTitle: string };
  learner?: { retention: number | null; confidence: number; overconfident: boolean; status: string };
  unresolvedErrors: string[];
  siblings: SiblingSummary[];
  snapshot: CourseSnapshot | null;
}

export type Block = 'topic-title' | 'learner' | 'unresolved-errors' | 'related-topics' | 'course-snapshot';

export const scopeConfig: Record<SessionScope, Block[]> = {
  clean_slate: ['topic-title'],
  topic: ['topic-title', 'learner', 'unresolved-errors'],
  section: ['topic-title', 'learner', 'unresolved-errors', 'related-topics'],
  course: ['topic-title', 'learner', 'unresolved-errors', 'course-snapshot'],
};

export interface IntentSpec {
  instructions: string[];
  avoid: string[];
  siblingWeights: { retention: number; errors: number; proximity: number };
  /** Blocks this intent needs regardless of scope. `remediate` is defined by
   *  the error log, so it must always carry the unresolved-errors block even
   *  under `clean_slate` — otherwise its instructions reference errors that
   *  aren't there. Unioned with `scopeConfig[scope]` (see `blocksFor`). */
  requireBlocks?: Block[];
}

const NO_TIME = 'Do not estimate how long this took — the app records the time.';

export const intentConfig: Record<SessionIntent, IntentSpec> = {
  remediate: {
    instructions: [
      'Focus entirely on the unresolved errors listed above.',
      'Use retrieval before explanation.',
      'Do not move on until each error is corrected.',
    ],
    avoid: ['Do not reteach mastered concepts unless retrieval shows they have faded.', NO_TIME],
    siblingWeights: { retention: 1, errors: 3, proximity: 1 },
    requireBlocks: ['unresolved-errors'],
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

/** Canonical block ordering — the union in `blocksFor` is sorted by this so a
 *  required block lands in its natural place (e.g. errors right after the title
 *  under clean_slate) rather than tacked on at the end. */
const BLOCK_ORDER: Block[] = ['topic-title', 'learner', 'unresolved-errors', 'related-topics', 'course-snapshot'];

/** The blocks a briefing actually carries: the scope's blocks unioned with any
 *  the intent requires (`remediate` always keeps its error log). */
export function blocksFor(intent: SessionIntent, scope: SessionScope): Block[] {
  const set = new Set<Block>([...scopeConfig[scope], ...(intentConfig[intent].requireBlocks ?? [])]);
  return BLOCK_ORDER.filter((b) => set.has(b));
}

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

export function buildSessionContext(
  course: Course, section: Section, topic: Topic, intent: SessionIntent, scope: SessionScope, now: Date,
): SessionContext {
  const blocks = blocksFor(intent, scope);
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
      overconfident: r !== null && confidencePct - r > 15,
      status: topic.status,
    };
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
  const contextBlocks = blocksFor(intent, scope).map((b) => renderers[b]()).filter((s): s is string => s !== null);
  const instructions = `INSTRUCTIONS\n${spec.instructions.join('\n')}`;
  const avoid = `AVOID\n${spec.avoid.join('\n')}`;
  // The briefing KICKS OFF a live tutoring session — it deliberately carries no
  // JSON schema. Handing the model an output schema up front makes it dump the
  // log immediately instead of teaching. The session-log JSON is requested
  // separately at the end via `sessionWrapUpPrompt` (shown at the import step).
  const begin = [
    'BEGIN',
    'Start the session now and tutor me interactively — teach, ask questions, and drill the items above according to the intent.',
    'Do NOT output any JSON or session log yet — we are studying. When the session is over I will ask you for the log.',
  ].join('\n');

  return [...contextBlocks, instructions, avoid, begin].join('\n\n');
}

/**
 * The wrap-up prompt — copied at the import step, after the timed session ends.
 * Requests the session-log JSON from the same conversation the briefing started.
 * `duration_minutes` is always 0: the app is the only timekeeper and overwrites
 * it with the measured time on commit (never trusts the model's estimate).
 */
export function sessionWrapUpPrompt(courseId: string, topics: Array<{ topic_id: string; title: string }>): string {
  const list = topics.map((t) => `${t.topic_id} → ${t.title}`).join('\n');
  return [
    'The study session is over.',
    'Based on our conversation, output ONLY the session-log JSON — no prose, no markdown fences:',
    `{ "schema_version": "2.0.0", "session_id": "session_<10 random alphanumeric>", "course_id": "${courseId}", "date": "<ISO 8601 now>", "duration_minutes": 0, "topics_covered": [ { "topic_id": "<one of the ids below>", "confidence_reported": <integer 1-5>, "notes": "<short, optional>", "errors": [ { "error_type": "conceptual|procedural|careless|knowledge_gap", "description": "<what went wrong>" } ] } ] }`,
    'Set duration_minutes to 0 — the app records the real time.',
    'confidence_reported is an integer 1-5 (1 = could not recall, 5 = fluent), NOT a percentage. Only include topics actually covered this session.',
    '',
    'Topic ids (id → title):',
    list,
  ].join('\n');
}
