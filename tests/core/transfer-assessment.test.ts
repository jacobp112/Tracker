import { describe, expect, it } from 'vitest';
import { exportBundle, exportBundleAsync, importBundleAsync } from '@/core/transfer';
import { MemoryAssessmentRepo } from '@/core/assessment-store';
import { emptyStore } from '@/domain/types';
import type { AssessmentAttempt, AssessmentDefinition } from '@/domain/assessment';

function def(id: string): AssessmentDefinition {
  return { schema_version: '4.0.0', assessment_id: id, title: `Paper ${id}`, provenance: 'past_paper', created_at: '2026-08-20T00:00:00.000Z', max_marks: 75, questions: [] };
}
function attempt(id: string, a: string): AssessmentAttempt {
  return { schema_version: '4.0.0', attempt_id: id, assessment_id: a, sat_at: '2026-08-21T00:00:00.000Z', conditions: { timed: true, closed_book: true, cold: true, assistance_used: false, ai_used: false, mark_scheme_seen: false }, question_results: [], status: 'marked' };
}

describe('backup/restore spanning localStorage + IndexedDB', () => {
  it('exports and re-imports both the study store and the assessment domain', async () => {
    const repoA = new MemoryAssessmentRepo();
    await repoA.putDefinition(def('assessment_1'));
    await repoA.putAttempt(attempt('attempt_1', 'assessment_1'));

    const json = await exportBundleAsync(emptyStore(), repoA);

    const repoB = new MemoryAssessmentRepo();
    const res = await importBundleAsync(json, repoB);

    expect(res.ok).toBe(true);
    expect((await repoB.allDefinitions()).map((d) => d.assessment_id)).toEqual(['assessment_1']);
    expect((await repoB.allAttempts()).map((a) => a.attempt_id)).toEqual(['attempt_1']);
  });

  it('imports a legacy (assessment-less) bundle without error, leaving the repo empty', async () => {
    const legacy = exportBundle(emptyStore()); // sync bundle, no assessment domain
    const repo = new MemoryAssessmentRepo();
    const res = await importBundleAsync(legacy, repo);
    expect(res.ok).toBe(true);
    expect((await repo.allDefinitions()).length).toBe(0);
  });

  it('does not touch the repo when the bundle is invalid (study store validated first)', async () => {
    const repo = new MemoryAssessmentRepo();
    await repo.putDefinition(def('kept'));
    const broken = await importBundleAsync('not json', repo);
    expect(broken.ok).toBe(false);
    // Import validates the study store BEFORE restoring the repo, so a failure
    // leaves the assessment domain untouched — no cross-store partial write.
    expect((await repo.allDefinitions()).map((d) => d.assessment_id)).toEqual(['kept']);
  });

  it('persists the localStorage study store BEFORE IndexedDB; a localStorage failure leaves the repo untouched (Fix 2)', async () => {
    const source = new MemoryAssessmentRepo();
    await source.putDefinition(def('assessment_9'));
    const json = await exportBundleAsync(emptyStore(), source);

    const repo = new MemoryAssessmentRepo();
    await repo.putDefinition(def('kept'));
    const saveThatFails = () => { throw new Error('quota exceeded'); };

    const res = await importBundleAsync(json, repo, saveThatFails);
    expect(res.ok).toBe(false);
    // localStorage was attempted first and failed → the repo was never restored.
    expect((await repo.allDefinitions()).map((d) => d.assessment_id)).toEqual(['kept']);
  });
});
