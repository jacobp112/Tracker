import { describe, expect, it } from 'vitest';
import { mergeInto } from '@/core/merge';
import { commit, ingest } from '@/core/pipeline';
import { exportBundle, importBundle } from '@/core/transfer';
import { currentStage, emptyStore, type JobApplication, type Store } from '@/domain/types';

const JOB = {
  schema_version: '2.0.0',
  application_id: 'application_01J8ZXB1',
  company: 'Acme Corp',
  role: 'Software Engineer',
  location: 'Cardiff',
  url: 'https://example.com/jobs/123',
  salary_range: '£45k-55k',
  source: 'LinkedIn',
  next_action_date: '2026-08-01',
  initial_stage: 'applied',
};

function ingestJob(store: Store, raw: object = JOB): Store {
  const result = ingest(JSON.stringify(raw), 'job', store);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return commit('job', result.value, store, mergeInto);
}

describe('job ingestion', () => {
  it('validates and previews a pasted application', () => {
    const result = ingest(JSON.stringify(JOB), 'job', emptyStore());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.summary).toBe('Acme Corp — Software Engineer (applied)');
    expect(result.preview.detail).toContain('Location · Cardiff');
    expect(result.preview.detail).toContain('Salary · £45k-55k');
  });

  it('synthesizes the engine-managed half on commit', () => {
    const next = ingestJob(emptyStore());
    expect(next.applications).toHaveLength(1);

    const app = next.applications[0]!;
    // First StageEvent synthesized from initial_stage; initial_stage never stored.
    expect(app.stage_history).toHaveLength(1);
    expect(app.stage_history[0]!.stage).toBe('applied');
    expect(app.stage_history[0]!.event_id).toMatch(/^event_/);
    expect(currentStage(app)).toBe('applied');
    expect('initial_stage' in app).toBe(false);
    expect(app.created_at).toBeTruthy();
    expect(app.archived).toBe(false);
  });

  it('defaults to saved when no initial_stage is given', () => {
    const { initial_stage: _drop, ...withoutStage } = JOB;
    const next = ingestJob(emptyStore(), withoutStage);
    expect(currentStage(next.applications[0]!)).toBe('saved');
  });

  it('rejects hallucinated fields', () => {
    const result = ingest(
      JSON.stringify({ ...JOB, status: 'ghosted' }),
      'job',
      emptyStore(),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a duplicate application_id (integrity)', () => {
    const store = ingestJob(emptyStore());
    const result = ingest(JSON.stringify(JOB), 'job', store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]!.path).toBe('/application_id');
    expect(result.errors[0]!.message).toContain('Acme Corp');
  });

  it('leaves the original store untouched (atomic commit)', () => {
    const store = emptyStore();
    ingestJob(store);
    expect(store.applications).toHaveLength(0);
  });
});

describe('job transfer round-trip (E8-S1)', () => {
  it('survives export → import into empty state identically', () => {
    const store = ingestJob(emptyStore());
    const result = importBundle(exportBundle(store));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.counts.applications).toBe(1);
    expect(result.store.applications).toEqual(store.applications);
  });

  it('validates the stored shape — a stage event with a bad stage is rejected', () => {
    const store = ingestJob(emptyStore());
    const broken = structuredClone(store);
    (broken.applications[0]! as JobApplication).stage_history[0]!.stage =
      'ghosted' as JobApplication['stage_history'][number]['stage'];
    const result = importBundle(exportBundle(broken));
    expect(result.ok).toBe(false);
  });
});
