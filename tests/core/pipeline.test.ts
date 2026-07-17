import { describe, expect, it } from 'vitest';
import { ingest } from '@/core/pipeline';
import { parseJson, validateAgainst } from '@/core/validate';
import { emptyStore, type Course, type Store } from '@/domain/types';

/** A minimal valid course per Document 1 v0.2. */
function course(overrides: Partial<Course> = {}): Course {
  return {
    schema_version: '2.0.0',
    course_id: 'course_01J8ZX3K',
    title: 'Calculus I',
    created_at: '2026-07-01T09:00:00Z',
    source: 'ai_generated',
    sections: [
      {
        section_id: 'section_01J8ZX9P',
        title: 'Limits and Continuity',
        order: 0,
        topics: [
          {
            topic_id: 'topic_01J8ZXA1',
            title: 'Chain rule',
            status: 'not_started',
            conf: 1,
            strength: 0,
            k_factor: 8.4,
            cards: 0,
            last_reviewed: null,
            mastered_at: null,
            drift_history: [],
            review_history: [],
            error_log: [],
          },
        ],
      },
    ],
    ...overrides,
  };
}

function storeWithCourse(): Store {
  return { ...emptyStore(), courses: [course()] };
}

describe('E2-S1 — parse', () => {
  it('rejects empty input with an instruction, not a parser error', () => {
    const r = parseJson('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/paste the json/i);
  });

  it('reports line and column when V8 gives a position (E2-S1)', () => {
    const r = parseJson('{"a":1,}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/isn't valid JSON/i);
      expect(r.error.message).toMatch(/line 1, column 8/);
    }
  });

  it('computes line and column across multiple lines', () => {
    const r = parseJson('{\n  "a": 1,\n  "b" 2\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/line 3, column \d+/);
  });

  /**
   * V8 omits any offset for some failures (e.g. "Unexpected token '}', ..."),
   * embedding a snippet instead. We must still surface its raw text rather than
   * swallowing the only location information available.
   */
  it('still surfaces the raw parser text when V8 gives no position', () => {
    const r = parseJson('{\n  "a": 1,\n  "b":\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/isn't valid JSON/i);
      expect(r.error.message).toMatch(/The parser said:/);
      expect(r.error.message).toMatch(/Unexpected token/);
      // No fabricated location when we genuinely don't have one.
      expect(r.error.message).not.toMatch(/line \d+, column \d+/);
    }
  });

  it('names the markdown-fence mistake specifically', () => {
    const r = parseJson('```json\n{"a":1}\n```');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/code fence/i);
  });
});

describe('E2-S1 — schema validation', () => {
  it('accepts a valid course', () => {
    expect(validateAgainst('course', course()).ok).toBe(true);
  });

  it('enforces additionalProperties: false — hallucinated fields fail (Doc 1 §1.5)', () => {
    const bad = { ...course(), vibe: 'excellent' };
    const r = validateAgainst('course', bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /unexpected field 'vibe'/.test(e.message))).toBe(true);
  });

  it('collects ALL errors, not just the first (Doc 1 §6.1)', () => {
    const c = course();
    c.title = '';
    c.sections[0]!.topics[0]!.conf = 9 as never;
    c.sections[0]!.topics[0]!.strength = -5;
    const r = validateAgainst('course', c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * The v0.1→v0.2 model sync (Document 1 §0.1) means JSON generated against the
   * old prompt is the likeliest bad paste. It must fail, and say why.
   */
  it('rejects JSON built against the withdrawn v0.1 model, naming the stale field', () => {
    const stale = course();
    (stale.sections[0]!.topics[0] as unknown as Record<string, unknown>)['ease_factor'] = 2.5;
    const r = validateAgainst('course', stale);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => /ease_factor/.test(e.message))).toBe(true);
      expect(r.errors.some((e) => /older version/i.test(e.message))).toBe(true);
    }
  });

  it('rejects the withdrawn 0–100 confidence scale with the 1–5 explanation (E2-S3)', () => {
    const c = course();
    c.sections[0]!.topics[0]!.conf = 105 as never;
    const r = validateAgainst('course', c);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Example parity with Document 4 E2-S3, updated for the 1–5 scale.
      expect(r.errors[0]!.message).toBe(
        "Topic 'Chain rule' has a confidence of 105 — confidence is a 1–5 rating, not a percentage.",
      );
    }
  });

  it('rejects a k_factor outside the Document 2 §1 clamps', () => {
    const c = course();
    c.sections[0]!.topics[0]!.k_factor = 20;
    expect(validateAgainst('course', c).ok).toBe(false);
  });

  it('rejects a withdrawn status value', () => {
    const c = course();
    c.sections[0]!.topics[0]!.status = 'review_due' as never;
    const r = validateAgainst('course', c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toMatch(/isn't one of the allowed values/);
  });

  it('requires a test block on a test event, and forbids it otherwise (Doc 1 §2.4)', () => {
    const withoutTest = {
      event_id: 'event_01J8ZXB9',
      date: '2026-07-15T10:00:00Z',
      kind: 'test_fail',
      source: 'exam',
      source_id: 'exam_01J8ZXD5',
      confidence_reported: 4,
    };
    const c1 = course();
    c1.sections[0]!.topics[0]!.review_history = [withoutTest as never];
    expect(validateAgainst('course', c1).ok).toBe(false);

    const studyWithTest = {
      ...withoutTest,
      kind: 'study_review',
      test: { score: 11, out_of: 20, actual_retention: 0.55 },
    };
    const c2 = course();
    c2.sections[0]!.topics[0]!.review_history = [studyWithTest as never];
    expect(validateAgainst('course', c2).ok).toBe(false);
  });

  it('caps drift_history at DRIFT_WINDOW (5)', () => {
    const c = course();
    c.sections[0]!.topics[0]!.drift_history = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    expect(validateAgainst('course', c).ok).toBe(false);
  });
});

describe('E2-S2 — referential integrity', () => {
  it('rejects a session for a course that does not exist', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        session_id: 'session_01J8ZXAA',
        course_id: 'course_NOPE12345',
        date: '2026-07-14T18:00:00Z',
        duration_minutes: 45,
        topics_covered: [{ topic_id: 'topic_01J8ZXA1', confidence_reported: 4 }],
      }),
      'session',
      storeWithCourse(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toMatch(/doesn't exist in your tracker/);
  });

  it('names the offending id and its field path (E2-S2)', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        session_id: 'session_01J8ZXAA',
        course_id: 'course_01J8ZX3K',
        date: '2026-07-14T18:00:00Z',
        duration_minutes: 45,
        topics_covered: [{ topic_id: 'topic_GHOST0001', confidence_reported: 4 }],
      }),
      'session',
      storeWithCourse(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.path).toBe('/topics_covered/0/topic_id');
      expect(r.errors[0]!.message).toContain('topic_GHOST0001');
    }
  });

  it('rejects re-adding an existing course (Doc 1 §6.3 — courses are created once)', () => {
    const r = ingest(JSON.stringify(course()), 'course', storeWithCourse());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toMatch(/already exists/);
  });

  it('rejects an exam breakdown scoring a topic not in linked_topic_ids', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD5',
        title: 'Midterm 1',
        date: '2026-07-15T10:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1'],
        score: 18,
        max_score: 20,
        breakdown: [{ topic_id: 'topic_01J8ZXA9', points_earned: 12, points_possible: 20 }],
      }),
      'exam',
      storeWithCourse(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /isn't in this exam's linked topics/.test(e.message))).toBe(true);
  });

  it('rejects earning more points than were available', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD5',
        title: 'Midterm 1',
        date: '2026-07-15T10:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1'],
        score: 30,
        max_score: 20,
      }),
      'exam',
      storeWithCourse(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => /can't earn more than was available/.test(e.message))).toBe(true);
  });

  it('allows an exam to span courses by design (Doc 1 §4)', () => {
    const store = storeWithCourse();
    const other = course({ course_id: 'course_OTHER0001', title: 'Org Chem' });
    other.sections[0]!.section_id = 'section_OTHER001';
    other.sections[0]!.topics[0]!.topic_id = 'topic_OTHER0001';
    store.courses.push(other);

    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD5',
        title: 'General assessment',
        date: '2026-07-15T10:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1', 'topic_OTHER0001'],
        score: 30,
        max_score: 40,
      }),
      'exam',
      store,
    );
    expect(r.ok).toBe(true);
  });
});

describe('E2-S4 — preview', () => {
  it('summarises a course before commit ("3 sections, 14 topics")', () => {
    const r = ingest(JSON.stringify(course()), 'course', emptyStore());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.preview.summary).toBe('Calculus I — 1 section, 1 topic');
  });

  it('summarises a session', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        session_id: 'session_01J8ZXAA',
        course_id: 'course_01J8ZX3K',
        date: '2026-07-14T18:00:00Z',
        duration_minutes: 45,
        topics_covered: [
          {
            topic_id: 'topic_01J8ZXA1',
            confidence_reported: 4,
            errors: [{ error_type: 'conceptual', description: 'Mixed up the definitions.' }],
          },
        ],
      }),
      'session',
      storeWithCourse(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.preview.summary).toBe('45 minutes across 1 topic, 1 mistake logged');
  });

  it('says so when an exam has no breakdown and the score is applied uniformly', () => {
    const r = ingest(
      JSON.stringify({
        schema_version: '2.0.0',
        exam_id: 'exam_01J8ZXD5',
        title: 'Midterm 1',
        date: '2026-07-15T10:00:00Z',
        linked_topic_ids: ['topic_01J8ZXA1'],
        score: 18,
        max_score: 20,
      }),
      'exam',
      storeWithCourse(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.preview.detail[0]).toMatch(/applied to every linked topic/);
  });
});
