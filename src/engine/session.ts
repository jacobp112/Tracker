import type { SessionIntent, SessionScope } from '@/domain/types';

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
