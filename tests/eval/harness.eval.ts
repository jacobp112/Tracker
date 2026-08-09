import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { scoreStore, engineModel, fsrsModel, constantModel } from './harness';
import type { Store } from '@/domain/types';

const path = process.env.EVAL_STORE;

describe.skipIf(!path)('retention model eval (set EVAL_STORE to an exported bundle)', () => {
  it('prints the model comparison table', () => {
    const raw = JSON.parse(readFileSync(path!, 'utf8'));
    const store: Store = raw.store ?? raw;
    const models = [engineModel, fsrsModel, constantModel(store)];
    // eslint-disable-next-line no-console
    console.log('\nmodel            n     skip  MAE      logLoss  bernoulli');
    for (const m of models) {
      const s = scoreStore(store, m);
      // eslint-disable-next-line no-console
      console.log(
        `${m.name.padEnd(15)} ${String(s.n).padEnd(5)} ${String(s.skipped).padEnd(5)} ${s.mae.toFixed(4)}  ${s.logLoss.toFixed(4)}  ${s.bernoulli.toFixed(4)}`,
      );
    }
  });
});
