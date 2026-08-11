import { describe, expect, it, beforeEach } from 'vitest';
import { loadStore, STORE_KEY } from '@/core/storage';
import { SCHEMA_VERSION } from '@/domain/types';

describe('loadStore — forward migration from v2 (study-only)', () => {
  beforeEach(() => localStorage.clear());

  it('keeps courses and exams, drops runs/lifts/applications, restamps the version', () => {
    const v2 = {
      schema_version: '2.0.0',
      courses: [
        {
          schema_version: '2.0.0',
          course_id: 'course_1',
          title: 'C',
          created_at: '2026-07-01T00:00:00Z',
          source: 'ai_generated',
          sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: [] }],
        },
      ],
      exams: [
        {
          schema_version: '2.0.0',
          exam_id: 'exam_1',
          title: 'Mock',
          date: '2026-07-10T00:00:00Z',
          linked_topic_ids: ['topic_1'],
          score: 8,
          max_score: 10,
        },
      ],
      runs: [{ activity_id: 'activity_1' }],
      lifts: [{ session_id: 'session_1' }],
      applications: [{ application_id: 'application_1' }],
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(v2));

    const store = loadStore();

    expect(store.schema_version).toBe(SCHEMA_VERSION);
    expect(store.courses).toHaveLength(1);
    expect(store.courses[0]!.course_id).toBe('course_1');
    expect(store.exams).toHaveLength(1);
    expect(store.exams[0]!.exam_id).toBe('exam_1');
    // No fitness/job domains survive on the returned object.
    expect((store as unknown as Record<string, unknown>).runs).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).lifts).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).applications).toBeUndefined();
  });

  it('returns an empty study-only store when nothing is saved', () => {
    const store = loadStore();
    expect(store).toEqual({ schema_version: SCHEMA_VERSION, courses: [], exams: [], sessions: [] });
  });
});
