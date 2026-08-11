import { describe, expect, it } from 'vitest';
import { unstablePrerequisites } from '@/engine/performance-view';
import { emptyStore, type Store, type Topic } from '@/domain/types';

function topic(id: string, over: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id.toUpperCase(), status: 'practising', conf: 3, strength: 1,
    k_factor: 8.4, cards: 0, last_reviewed: '2026-08-10T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [], ...over,
  };
}
function anError(id: string) {
  return { error_id: id, date: '2026-08-10T00:00:00.000Z', source: 'session' as const,
    source_id: 'session_1', error_type: 'conceptual' as const, description: 'x', resolved: false, resolved_date: null };
}
function storeOf(...topics: Topic[]): Store {
  const s = emptyStore();
  s.courses.push({ schema_version: '3.2.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }] });
  return s;
}
const NOW = new Date('2026-08-10T12:00:00.000Z');

describe('unstablePrerequisites', () => {
  it('surfaces a struggling topic whose upstream is unstable', () => {
    // C is struggling (active error) and depends on A which is not_started (unstable upstream).
    const c = topic('topic_c', { prerequisites: ['topic_a'], error_log: [anError('error_1')] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, strength: 0 });
    const out = unstablePrerequisites(storeOf(c, a), NOW);
    expect(out.map((u) => u.topic_id)).toContain('topic_c');
    expect(out.find((u) => u.topic_id === 'topic_c')!.report.unstableCount).toBeGreaterThanOrEqual(1);
  });

  it('does not surface a struggling topic whose upstream is solid', () => {
    const c = topic('topic_c', { prerequisites: ['topic_a'], error_log: [anError('error_1')] });
    const a = topic('topic_a', { status: 'mastered', conf: 5, strength: 20, cards: 5, mastered_at: '2026-08-05T00:00:00.000Z' });
    expect(unstablePrerequisites(storeOf(c, a), NOW)).toEqual([]);
  });

  it('does not surface a topic that is NOT struggling, even with weak upstream', () => {
    // C has no errors and is freshly reviewed (not due), so it isn't inspected.
    const c = topic('topic_c', { prerequisites: ['topic_a'] });
    const a = topic('topic_a', { status: 'not_started', last_reviewed: null, strength: 0 });
    expect(unstablePrerequisites(storeOf(c, a), NOW)).toEqual([]);
  });

  it('ignores topics with no prerequisites', () => {
    const c = topic('topic_c', { error_log: [anError('error_1')] });
    expect(unstablePrerequisites(storeOf(c), NOW)).toEqual([]);
  });
});
