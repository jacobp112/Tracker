import { useToast } from '@/components/feedback';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { Card } from '@/components/primitives';
import { COMMIT_VERB } from '@/core/pipeline';
import { LIFTING_PROMPT, RUNNING_PROMPT } from '@/domain/prompts';
import type { Store } from '@/domain/types';
import { navigate } from '@/router';

/**
 * Log a run or a lift — Document 4 E6-S1 / E6-S2.
 * Same E2 paste-and-validate flow as every other ingestion; pace is computed on
 * commit (Document 1 §5.1), so nothing kind-specific happens here.
 */
export function AddFitness({
  kind,
  store,
  commitValue,
  undoLast,
}: {
  kind: 'running' | 'lifting';
  store: Store;
  commitValue: (schemaName: 'running' | 'lifting', value: unknown) => string | null;
  undoLast: () => string | null;
}) {
  const { toast } = useToast();
  const isRun = kind === 'running';

  return (
    <div className="content">
      <div className="breadcrumb">
        <span>Fitness</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="current">{isRun ? 'Log run' : 'Log lift'}</span>
      </div>
      <div className="page-head">
        <h1>{isRun ? 'Log a run' : 'Log a lifting session'}</h1>
        <p>Paste your {isRun ? 'run' : 'workout'} into the prompt, then bring the JSON back here.</p>
      </div>

      <div className="section">
        <Card style={{ padding: 'var(--space-12)' }}>
          <PasteValidateInput
            schemaName={kind}
            store={store}
            prompt={isRun ? RUNNING_PROMPT : LIFTING_PROMPT}
            confirmLabel={isRun ? 'Log run' : 'Log lift'}
            onCommit={(value) => {
              const error = commitValue(kind, value);
              if (error) {
                toast(error, 'error');
                return;
              }
              toast(COMMIT_VERB[kind], 'success', {
                label: 'Undo',
                onClick: () => {
                  const err = undoLast();
                  toast(err ?? 'Undone.', err ? 'error' : 'info');
                },
              });
              navigate('/fitness');
            }}
          />
        </Card>
      </div>
    </div>
  );
}
