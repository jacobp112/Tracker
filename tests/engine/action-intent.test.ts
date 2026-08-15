import { describe, it, expect } from 'vitest';
import { intentForAction, type RecommendationAction } from '@/engine/recommend';
import { intentConfig } from '@/engine/session';
import type { SessionIntent } from '@/domain/types';

/**
 * Phase 3 Task 2 — Part H. Every recommendation action must map to a valid
 * SessionIntent whose config resolves, so a session started from any
 * recommendation still yields a real tutor objective.
 */

const ALL_ACTIONS: RecommendationAction[] = ['remediate', 'prerequisite', 'review', 'retrieve', 'assess', 'learn'];
const ALL_INTENTS: SessionIntent[] = ['remediate', 'retention', 'new_content', 'adaptive'];

describe('intentForAction (Part H)', () => {
  it('maps every action to a valid, config-resolvable SessionIntent', () => {
    for (const a of ALL_ACTIONS) {
      const intent = intentForAction(a);
      expect(ALL_INTENTS).toContain(intent);
      expect(intentConfig[intent]).toBeDefined();
    }
  });

  it('uses the expected dominant-driver mapping', () => {
    expect(intentForAction('remediate')).toBe('remediate');
    expect(intentForAction('prerequisite')).toBe('remediate');
    expect(intentForAction('review')).toBe('retention');
    expect(intentForAction('learn')).toBe('new_content');
    expect(intentForAction('retrieve')).toBe('adaptive');
    expect(intentForAction('assess')).toBe('adaptive');
  });
});
