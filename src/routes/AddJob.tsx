import { useToast } from '@/components/feedback';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { Card } from '@/components/primitives';
import { COMMIT_VERB } from '@/core/pipeline';
import { JOB_PROMPT } from '@/domain/prompts';
import type { Store } from '@/domain/types';
import { navigate } from '@/router';

/**
 * Add a job application — same E2 paste-and-validate flow as every other
 * ingestion. The first StageEvent, created_at and archived are synthesized on
 * commit (see merge.ts), so nothing stage-specific happens here.
 */
export function AddJob({
  store,
  commitValue,
  undoLast,
}: {
  store: Store;
  commitValue: (schemaName: 'job', value: unknown) => string | null;
  undoLast: () => string | null;
}) {
  const { toast } = useToast();

  return (
    <div className="content">
      <div className="breadcrumb">
        <span>Jobs</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="current">Add application</span>
      </div>
      <div className="page-head">
        <h1>Add a job application</h1>
        <p>Paste the job posting into the prompt, then bring the JSON back here.</p>
      </div>

      <div className="section">
        <Card style={{ padding: 'var(--space-12)' }}>
          <PasteValidateInput
            schemaName="job"
            store={store}
            prompt={JOB_PROMPT}
            confirmLabel="Add application"
            onCommit={(value) => {
              const error = commitValue('job', value);
              if (error) {
                toast(error, 'error');
                return;
              }
              toast(COMMIT_VERB.job, 'success', {
                label: 'Undo',
                onClick: () => {
                  const err = undoLast();
                  toast(err ?? 'Undone.', err ? 'error' : 'info');
                },
              });
              navigate('/jobs');
            }}
          />
        </Card>
      </div>
    </div>
  );
}
