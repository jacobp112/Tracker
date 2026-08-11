import { describe, expect, it } from 'vitest';
import { matchPattern, patternStatus, errorUrgency } from '@/engine/errors';
import type {
  Course, ErrorLogEntry, ErrorPattern, ReviewEvent, SessionRecord, Store, Topic,
} from '@/domain/types';
import { emptyStore } from '@/domain/types';

/* ── fixtures ─────────────────────────────────────────────────────── */

function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'practising', conf: 3, strength: 2, k_factor: 8.4,
    cards: 0, last_reviewed: '2026-08-10T00:00:00.000Z', mastered_at: null,
    drift_history: [], review_history: [], error_log: [], ...opts,
  };
}

function occ(id: string, date: string, opts: Partial<ErrorLogEntry> = {}): ErrorLogEntry {
  return {
    error_id: id, date, source: 'session', source_id: 'session_x',
    error_type: 'conceptual', description: 'd', resolved: false, resolved_date: null, ...opts,
  };
}

function pattern(opts: Partial<ErrorPattern> = {}): ErrorPattern {
  return {
    pattern_id: 'pattern_1', signature: 'sign-error-multiplying-negatives', error_type: 'conceptual',
    topic_ids: ['topic_a'], severity: 'medium', occurrence_ids: ['error_1'],
    first_seen: '2026-08-01T00:00:00.000Z', last_seen: '2026-08-01T00:00:00.000Z', ...opts,
  };
}

function testEvent(date: string, opts: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    event_id: `event_${date}`, date, kind: 'test_pass', source: 'exam', source_id: 'exam_x',
    confidence_reported: 4, test: { score: 9, out_of: 10, actual_retention: 0.9 }, ...opts,
  };
}

function remediateSession(date: string, topicId: string): SessionRecord {
  return {
    session_id: `session_${date}`, topic_id: topicId, course_id: 'course_1',
    created_at: date, completed_at: date, duration_minutes: 20,
    intent: 'remediate', scope: 'topic', timer_mode: 'count_up',
  };
}

function storeWith(topics: Topic[], patterns: ErrorPattern[] = [], sessions: SessionRecord[] = []): Store {
  const course: Course = {
    schema_version: '3.3.0', course_id: 'course_1', title: 'C',
    created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  s.error_patterns.push(...patterns);
  s.sessions.push(...sessions);
  return s;
}

/* ── matchPattern (semantic, not string equality) ─────────────────── */

describe('matchPattern', () => {
  const existing = [pattern()];

  it('matches a normalised-equal signature of the same error_type at high confidence', () => {
    const m = matchPattern(existing, { signature: 'Sign error, multiplying negatives', error_type: 'conceptual', topic_id: 'topic_a' });
    expect(m?.pattern.pattern_id).toBe('pattern_1');
    expect(m?.confidence).toBe('high');
  });

  it('surfaces a partially-overlapping signature as ambiguous (for learner confirmation)', () => {
    const m = matchPattern(existing, { signature: 'sign error when adding negatives', error_type: 'conceptual', topic_id: 'topic_a' });
    expect(m?.confidence).toBe('ambiguous');
  });

  it('does not match across a different error_type even with identical words (context matters)', () => {
    const m = matchPattern(existing, { signature: 'sign error multiplying negatives', error_type: 'careless', topic_id: 'topic_a' });
    expect(m).toBeNull();
  });

  it('returns null when nothing is semantically close', () => {
    const m = matchPattern(existing, { signature: 'forgot to convert units', error_type: 'conceptual', topic_id: 'topic_a' });
    expect(m).toBeNull();
  });
});

/* ── patternStatus (derived lifecycle) ────────────────────────────── */

describe('patternStatus', () => {
  it('is active with occurrences and no remediation', () => {
    const t = topic('topic_a', { error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')] });
    const s = storeWith([t], [pattern()]);
    expect(patternStatus(pattern(), s).status).toBe('active');
  });

  it('is verification_pending after a remediate session with no qualifying success yet', () => {
    const t = topic('topic_a', { error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')] });
    const s = storeWith([t], [pattern()], [remediateSession('2026-08-02T00:00:00.000Z', 'topic_a')]);
    expect(patternStatus(pattern(), s).status).toBe('verification_pending');
  });

  it('is verified_resolved after an independent-tier success following remediation', () => {
    const success = testEvent('2026-08-03T00:00:00.000Z', { assessment: { independence: 3 } }); // tier 4
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')],
      review_history: [success],
    });
    const s = storeWith([t], [pattern()], [remediateSession('2026-08-02T00:00:00.000Z', 'topic_a')]);
    expect(patternStatus(pattern(), s).status).toBe('verified_resolved');
  });

  it('a NON-independent success does not verify (independence gate holds)', () => {
    const weak = testEvent('2026-08-03T00:00:00.000Z'); // no independence → tier 2
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')],
      review_history: [weak],
    });
    const s = storeWith([t], [pattern()], [remediateSession('2026-08-02T00:00:00.000Z', 'topic_a')]);
    expect(patternStatus(pattern(), s).status).toBe('verification_pending');
  });

  it('a high-severity pattern needs a COLD independent success (tier 5), not merely independent', () => {
    const indepOnly = testEvent('2026-08-03T00:00:00.000Z', { assessment: { independence: 3 } }); // tier 4
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')],
      review_history: [indepOnly],
    });
    const s = storeWith([t], [pattern({ severity: 'high' })], [remediateSession('2026-08-02T00:00:00.000Z', 'topic_a')]);
    expect(patternStatus(pattern({ severity: 'high' }), s).status).toBe('verification_pending');
  });

  it('regresses when a new occurrence lands after a verified success', () => {
    const success = testEvent('2026-08-03T00:00:00.000Z', { assessment: { independence: 3 } });
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z'), occ('error_2', '2026-08-05T00:00:00.000Z')],
      review_history: [success],
    });
    const s = storeWith([t], [pattern({ occurrence_ids: ['error_1', 'error_2'] })], [remediateSession('2026-08-02T00:00:00.000Z', 'topic_a')]);
    expect(patternStatus(pattern({ occurrence_ids: ['error_1', 'error_2'] }), s).status).toBe('regressed');
  });
});

/* ── errorUrgency (interpretable, not a weighted score) ───────────── */

describe('errorUrgency', () => {
  it('CRITICAL: high severity + recurrence', () => {
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z'), occ('error_2', '2026-08-05T00:00:00.000Z')],
    });
    const s = storeWith([t], []);
    const u = errorUrgency(pattern({ severity: 'high', occurrence_ids: ['error_1', 'error_2'] }), s, new Date('2026-08-06T00:00:00.000Z'));
    expect(u.level).toBe('critical');
    expect(u.when).toBe('today');
    expect(u.reasons.length).toBeGreaterThan(0);
  });

  it('HIGH: recurrence alone (medium severity)', () => {
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z'), occ('error_2', '2026-08-05T00:00:00.000Z')],
    });
    const s = storeWith([t], []);
    const u = errorUrgency(pattern({ occurrence_ids: ['error_1', 'error_2'] }), s, new Date('2026-08-06T00:00:00.000Z'));
    expect(u.level).toBe('high');
  });

  it('LOW: a verified-resolved pattern is not urgent', () => {
    const success = testEvent('2026-08-03T00:00:00.000Z', { assessment: { independence: 3 } });
    const t = topic('topic_a', {
      error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')],
      review_history: [success],
    });
    const s = storeWith([t], [], [remediateSession('2026-08-02T00:00:00.000Z', 'topic_a')]);
    const u = errorUrgency(pattern(), s, new Date('2026-08-04T00:00:00.000Z'));
    expect(u.level).toBe('low');
    expect(u.when).toBe('next_cycle');
  });

  it('CRITICAL: high severity on a foundational topic even with a single occurrence', () => {
    const foundational = topic('topic_a', { error_log: [occ('error_1', '2026-08-01T00:00:00.000Z')] });
    const dependent = topic('topic_b', { prerequisites: ['topic_a'] });
    const s = storeWith([foundational, dependent], []);
    const u = errorUrgency(pattern({ severity: 'high' }), s, new Date('2026-08-02T00:00:00.000Z'));
    expect(u.level).toBe('critical');
  });
});
