import { useToast } from '@/components/feedback';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { Card } from '@/components/primitives';
import { COMMIT_VERB } from '@/core/pipeline';
import { examPrompt } from '@/domain/prompts';
import type { Store } from '@/domain/types';
import { navigate } from '@/router';

/**
 * Add exam result — Document 4 E5-S1.
 * Uses the E2 pipeline with the §3.2 prompt; the full cross-course topic list
 * is injected (an exam may span courses, Document 1 §4). Supports both
 * breakdown-present and uniform-fallback exams — that branch lives in the merge
 * logic (Document 2 §4.2), so nothing special is needed here.
 */
export function AddExam({
  store,
  commitValue,
  undoLast,
}: {
  store: Store;
  commitValue: (schemaName: 'exam', value: unknown) => string | null;
  undoLast: () => string | null;
}) {
  const { toast } = useToast();

  return (
    <div className="content">
      <div className="breadcrumb">
        <span>Exams</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="current">Add exam result</span>
      </div>
      <div className="page-head">
        <h1>Add an exam result</h1>
        <p>
          Paste your marked paper into the prompt, then bring the JSON back here. The exam can span
          topics from any of your courses.
        </p>
      </div>

      <div className="section">
        <Card style={{ padding: 'var(--space-12)' }}>
          <PasteValidateInput
            schemaName="exam"
            store={store}
            prompt={examPrompt(store)}
            confirmLabel="Add exam result"
            onCommit={(value) => {
              const error = commitValue('exam', value);
              if (error) {
                toast(error, 'error');
                return;
              }
              toast(COMMIT_VERB.exam, 'success', {
                label: 'Undo',
                onClick: () => {
                  const err = undoLast();
                  toast(err ?? 'Undone.', err ? 'error' : 'info');
                },
              });
              navigate('/exams');
            }}
          />
        </Card>
      </div>
    </div>
  );
}
