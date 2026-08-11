import { describe, expect, it } from 'vitest';
import { recommend } from '@/engine/recommend';
import { readinessForAssessment } from '@/engine/readiness';
import { toAssessmentRef } from '@/core/assessment-ingest';
import type { AssessmentDefinition } from '@/domain/assessment';
import type { AssessmentRef, Course, ReviewEvent, Store, Topic } from '@/domain/types';
import { emptyStore } from '@/domain/types';

const NOW = new Date('2026-08-20T00:00:00.000Z');

function coldPass(i: number, assessmentId?: string): ReviewEvent {
  return {
    event_id: `event_${i}`, date: `2026-08-1${i}T00:00:00.000Z`, kind: 'test_pass', source: 'exam',
    source_id: assessmentId ?? 'exam_1', confidence_reported: 4,
    test: { score: 9, out_of: 10, actual_retention: 0.9 }, assessment: { independence: 3, cold: true },
    ...(assessmentId ? { assessment_ref: { assessment_id: assessmentId } } : {}),
  };
}
function topic(id: string, opts: Partial<Topic> = {}): Topic {
  return {
    topic_id: id, title: id, status: 'mastered', conf: 4, strength: 5, k_factor: 8.4, cards: 0,
    last_reviewed: '2026-08-19T00:00:00.000Z', mastered_at: '2026-08-10T00:00:00.000Z',
    drift_history: [], review_history: [1, 2, 3, 4, 5].map((i) => coldPass(i)), error_log: [], ...opts,
  };
}
function storeWith(topics: Topic[], refs: AssessmentRef[] = []): Store {
  const course: Course = {
    schema_version: '4.0.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics }],
  };
  const s = emptyStore();
  s.courses.push(course);
  s.assessment_refs.push(...refs);
  return s;
}
const ref = (topic_ids: string[]): AssessmentRef =>
  ({ assessment_id: 'assessment_1', title: 'AQA Paper 1', provenance: 'past_paper', topic_ids, max_marks: 75, created_at: '2026-08-15T00:00:00.000Z' });

describe('toAssessmentRef', () => {
  it('derives a compact ref from the confirmed-mapping topics only', () => {
    const def: AssessmentDefinition = {
      schema_version: '4.0.0', assessment_id: 'assessment_1', title: 'Paper', provenance: 'past_paper',
      created_at: '2026-08-15T00:00:00.000Z', max_marks: 10,
      questions: [{
        question_id: 'question_1', assessment_id: 'assessment_1', label: '1', order: 0, marks_available: 10, provenance: 'past_paper',
        mark_scheme: { total_marks: 10, criteria: [] },
        topic_mappings: [
          { topic_id: 'topic_a', role: 'primary', weight: 1, proposed_by: 'ai', confirmed: true },
          { topic_id: 'topic_b', role: 'secondary', weight: 0, proposed_by: 'ai', confirmed: false },
        ],
      }],
    };
    const r = toAssessmentRef(def);
    expect(r.topic_ids).toEqual(['topic_a']); // unconfirmed topic_b excluded
    expect(r.provenance).toBe('past_paper');
  });
});

describe('readinessForAssessment', () => {
  it('uses benchmark rigor for a past paper', () => {
    const report = readinessForAssessment(ref(['topic_a']), storeWith([topic('topic_a')]), NOW);
    expect(report.verdict).toBe('ready');
    expect(report.criteria.find((c) => c.id === 'cold_performance')!.blocking).toBe(true);
  });
});

describe('recommend — assessment branch', () => {
  it('recommends SITTING a ready, not-yet-attempted assessment', () => {
    const recs = recommend(storeWith([topic('topic_a')], [ref(['topic_a'])]), NOW);
    const assess = recs.find((r) => r.action === 'assess');
    expect(assess).toBeDefined();
    expect(assess!.target).toMatchObject({ kind: 'assessment', id: 'assessment_1' });
  });

  it('does NOT recommend sitting an assessment whose topics are not ready', () => {
    const notReady = topic('topic_a', { status: 'learning', review_history: [] });
    const recs = recommend(storeWith([notReady], [ref(['topic_a'])]), NOW);
    expect(recs.some((r) => r.action === 'assess')).toBe(false);
  });

  it('does NOT re-recommend an assessment already attempted', () => {
    const attempted = topic('topic_a', { review_history: [1, 2, 3, 4, 5].map((i) => coldPass(i)).concat(coldPass(9, 'assessment_1')) });
    const recs = recommend(storeWith([attempted], [ref(['topic_a'])]), NOW);
    expect(recs.some((r) => r.action === 'assess')).toBe(false);
  });
});
