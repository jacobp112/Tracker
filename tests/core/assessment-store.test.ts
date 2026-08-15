import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbAssessmentRepo, MemoryAssessmentRepo, type AssessmentRepo } from '@/core/assessment-store';
import type { AssessmentAttempt, AssessmentDefinition } from '@/domain/assessment';

function def(id: string): AssessmentDefinition {
  return {
    schema_version: '4.0.0', assessment_id: id, title: `Paper ${id}`, provenance: 'past_paper',
    created_at: '2026-08-20T00:00:00.000Z', max_marks: 75, questions: [],
  };
}
function attempt(id: string, assessmentId: string): AssessmentAttempt {
  return {
    schema_version: '4.0.0', attempt_id: id, assessment_id: assessmentId,
    sat_at: '2026-08-21T00:00:00.000Z',
    conditions: { timed: true, closed_book: true, cold: true, assistance_used: false, ai_used: false, mark_scheme_seen: false },
    question_results: [], status: 'marked',
  };
}

// The same contract must hold for both the IndexedDB repo and the in-memory
// fallback, so run one suite against each.
const repos: Array<[string, () => AssessmentRepo]> = [
  ['IndexedDbAssessmentRepo', () => new IndexedDbAssessmentRepo(`test-${Math.random().toString(36).slice(2)}`)],
  ['MemoryAssessmentRepo', () => new MemoryAssessmentRepo()],
];

for (const [name, make] of repos) {
  describe(`${name} — round trip`, () => {
    let repo: AssessmentRepo;
    afterEach(async () => { await repo.clear(); });

    it('stores and retrieves a definition', async () => {
      repo = make();
      await repo.putDefinition(def('assessment_1'));
      expect((await repo.getDefinition('assessment_1'))?.title).toBe('Paper assessment_1');
      expect(await repo.getDefinition('missing')).toBeUndefined();
    });

    it('lists all definitions and deletes one', async () => {
      repo = make();
      await repo.putDefinition(def('assessment_1'));
      await repo.putDefinition(def('assessment_2'));
      expect((await repo.allDefinitions()).map((d) => d.assessment_id).sort()).toEqual(['assessment_1', 'assessment_2']);
      await repo.deleteDefinition('assessment_1');
      expect((await repo.allDefinitions()).map((d) => d.assessment_id)).toEqual(['assessment_2']);
    });

    it('filters attempts by their assessment', async () => {
      repo = make();
      await repo.putAttempt(attempt('attempt_1', 'assessment_1'));
      await repo.putAttempt(attempt('attempt_2', 'assessment_1'));
      await repo.putAttempt(attempt('attempt_3', 'assessment_2'));
      expect((await repo.attemptsFor('assessment_1')).map((a) => a.attempt_id).sort()).toEqual(['attempt_1', 'attempt_2']);
    });

    it('dump then restore reproduces the whole domain', async () => {
      repo = make();
      await repo.putDefinition(def('assessment_1'));
      await repo.putAttempt(attempt('attempt_1', 'assessment_1'));
      const snap = await repo.dump();

      const fresh = make();
      await fresh.restore(snap);
      expect((await fresh.allDefinitions()).length).toBe(1);
      expect((await fresh.allAttempts()).length).toBe(1);
      await fresh.clear();
    });

    it('restore REPLACES prior content atomically (old data gone, new present)', async () => {
      repo = make();
      await repo.putDefinition(def('old'));
      await repo.restore({ assessments: [def('new')], attempts: [] });
      expect((await repo.allDefinitions()).map((d) => d.assessment_id)).toEqual(['new']);
    });
  });
}

describe('IndexedDbAssessmentRepo — partial-write safety', () => {
  it('a bad record aborts the restore transaction, leaving prior data intact (no partial wipe)', async () => {
    const repo = new IndexedDbAssessmentRepo(`test-atomic-${Math.random().toString(36).slice(2)}`);
    await repo.putDefinition(def('kept'));

    // An attempt missing its inline key (attempt_id) makes put() throw → the
    // transaction aborts → the earlier clear() is rolled back with it.
    const bad = { assessment_id: 'assessment_x' } as unknown as AssessmentAttempt;
    await expect(repo.restore({ assessments: [def('new')], attempts: [bad] })).rejects.toBeTruthy();

    // The pre-restore definition must still be there — nothing was half-written.
    expect((await repo.allDefinitions()).map((d) => d.assessment_id)).toEqual(['kept']);
    await repo.clear();
  });
});
