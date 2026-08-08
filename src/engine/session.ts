import type { Course, Section, SessionIntent, SessionScope, Topic } from '@/domain/types';
import { retentionPct } from '@/engine/retention';

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
