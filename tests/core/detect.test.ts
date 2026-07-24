import { describe, expect, it } from 'vitest';
import { detectSchema } from '@/core/detect';

describe('detectSchema — the Quick-add discriminators', () => {
  it('detects each shape by its unique key', () => {
    expect(detectSchema({ sections: [] })).toBe('course');
    expect(detectSchema({ topics_covered: [] })).toBe('session');
    expect(detectSchema({ linked_topic_ids: [] })).toBe('exam');
  });

  it('detects realistic full objects', () => {
    expect(
      detectSchema({
        schema_version: '2.0.0',
        session_id: 'session_abc',
        course_id: 'course_abc',
        date: '2026-07-22T10:00:00Z',
        duration_minutes: 30,
        topics_covered: [{ topic_id: 'topic_a', confidence_reported: 3 }],
      }),
    ).toBe('session');
  });

  it('returns null for unknown shapes and non-objects', () => {
    expect(detectSchema({ foo: 'bar' })).toBeNull();
    expect(detectSchema([])).toBeNull();
    expect(detectSchema('a string')).toBeNull();
    expect(detectSchema(null)).toBeNull();
    expect(detectSchema(42)).toBeNull();
  });
});
