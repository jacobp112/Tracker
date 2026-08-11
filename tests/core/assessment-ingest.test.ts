import { describe, expect, it } from 'vitest';
import { ingestAssessmentDef, commitAssessmentDef, pastPaperIngestPrompt } from '@/core/assessment-ingest';
import { MemoryAssessmentRepo } from '@/core/assessment-store';
import type { AssessmentDefinition, Question, TopicMapping } from '@/domain/assessment';
import type { Course, Store } from '@/domain/types';
import { emptyStore } from '@/domain/types';

function storeWithTopics(ids: string[]): Store {
  const course: Course = {
    schema_version: '4.0.0', course_id: 'course_1', title: 'C', created_at: '2026-08-01T00:00:00.000Z', source: 'manual',
    sections: [{ section_id: 'section_1', title: 'S', order: 0, topics: ids.map((id) => ({
      topic_id: id, title: id, status: 'practising', conf: 3, strength: 1, k_factor: 8.4, cards: 0,
      last_reviewed: null, mastered_at: null, drift_history: [], review_history: [], error_log: [],
    })) }],
  };
  const s = emptyStore();
  s.courses.push(course);
  return s;
}

function q(id: string, label: string, marks: number, mappings: TopicMapping[]): Question {
  return {
    question_id: id, assessment_id: 'assessment_1', label, order: 0, marks_available: marks,
    topic_mappings: mappings, provenance: 'past_paper',
    mark_scheme: { total_marks: marks, criteria: [{ criterion_id: 'criterion_1', marks, kind: 'point', label: 'B1', descriptor: 'correct answer' }] },
  };
}
const map = (topic_id: string, weight: number, role: TopicMapping['role'] = 'primary'): TopicMapping =>
  ({ topic_id, role, weight, proposed_by: 'ai', confirmed: false });

function validDef(): AssessmentDefinition {
  return {
    schema_version: '4.0.0', assessment_id: 'assessment_1', title: 'AQA Paper 1', provenance: 'past_paper',
    created_at: '2026-08-20T00:00:00.000Z', max_marks: 10,
    questions: [
      q('question_1', '1', 6, [map('topic_a', 1)]),
      q('question_2', '2', 4, [map('topic_a', 0.5), map('topic_b', 0.5, 'secondary')]),
    ],
  };
}

describe('ingestAssessmentDef', () => {
  const store = storeWithTopics(['topic_a', 'topic_b']);

  it('accepts a well-formed definition and previews it', () => {
    const res = ingestAssessmentDef(JSON.stringify(validDef()), store);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.preview.summary).toContain('10 marks');
  });

  it('rejects a mapping to a topic that does not exist', () => {
    const def = validDef();
    def.questions[0]!.topic_mappings = [map('topic_zzz', 1)];
    const res = ingestAssessmentDef(JSON.stringify(def), store);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => /topic_zzz/.test(e.message))).toBe(true);
  });

  it('rejects when question marks do not reconcile with max_marks', () => {
    const def = validDef();
    def.max_marks = 99;
    const res = ingestAssessmentDef(JSON.stringify(def), store);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => /marks/i.test(e.message))).toBe(true);
  });

  it('rejects duplicate question ids', () => {
    const def = validDef();
    def.questions[1]!.question_id = 'question_1';
    const res = ingestAssessmentDef(JSON.stringify(def), store);
    expect(res.ok).toBe(false);
  });

  it('rejects a question whose topic-mapping weights do not sum to 1', () => {
    const def = validDef();
    def.questions[1]!.topic_mappings = [map('topic_a', 0.5), map('topic_b', 0.4, 'secondary')];
    const res = ingestAssessmentDef(JSON.stringify(def), store);
    expect(res.ok).toBe(false);
  });

  it('allows an unmapped question (empty topic_mappings — explicit unknown)', () => {
    const def = validDef();
    def.questions[1]!.topic_mappings = [];
    const res = ingestAssessmentDef(JSON.stringify(def), store);
    expect(res.ok).toBe(true);
  });

  it('rejects an invalid provenance at the schema layer', () => {
    const def = { ...validDef(), provenance: 'made_up' } as unknown as AssessmentDefinition;
    const res = ingestAssessmentDef(JSON.stringify(def), store);
    expect(res.ok).toBe(false);
  });
});

describe('commitAssessmentDef', () => {
  it('stores a validated definition into the repo', async () => {
    const repo = new MemoryAssessmentRepo();
    await commitAssessmentDef(validDef(), repo);
    expect((await repo.getDefinition('assessment_1'))?.title).toBe('AQA Paper 1');
  });
});

describe('pastPaperIngestPrompt', () => {
  it('injects the tracked topic ids for mapping', () => {
    const prompt = pastPaperIngestPrompt(storeWithTopics(['topic_a', 'topic_b']));
    expect(prompt).toContain('topic_a');
    expect(prompt).toContain('past_paper');
  });
});
