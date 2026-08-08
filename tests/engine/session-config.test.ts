import { describe, expect, it } from 'vitest';
import { scopeConfig, intentConfig } from '@/engine/session';

const SCOPES = ['clean_slate', 'topic', 'section', 'course'] as const;
const INTENTS = ['remediate', 'retention', 'new_content', 'adaptive'] as const;

describe('session config', () => {
  it('every scope maps to a block list that starts with the topic title', () => {
    for (const s of SCOPES) {
      expect(scopeConfig[s].length).toBeGreaterThan(0);
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
