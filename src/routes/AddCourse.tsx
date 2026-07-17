import { useToast } from '@/components/feedback';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { Card } from '@/components/primitives';
import { COMMIT_VERB } from '@/core/pipeline';
import { COURSE_PROMPT } from '@/domain/prompts';
import type { Course, Store } from '@/domain/types';
import { navigate } from '@/router';

/**
 * Study course creation — Document 3 §5.6, the zero-setup core.
 * Pick a tracker type → copy the prompt → paste JSON → validate → preview →
 * confirm. The user never configures a schema.
 */
export function AddCourse({
  store,
  commitValue,
}: {
  store: Store;
  commitValue: (schemaName: 'course', value: unknown) => string | null;
}) {
  const { toast } = useToast();

  return (
    <div className="content">
      <div className="breadcrumb">
        <span>Study</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span className="current">Add course</span>
      </div>
      <div className="page-head">
        <h1>Add a course</h1>
        <p>
          Paste your syllabus into the prompt below, then bring the JSON back here. You never build a
          schema — your AI does it.
        </p>
      </div>

      <div className="section">
        <Card style={{ padding: 'var(--space-12)' }}>
          <PasteValidateInput
            schemaName="course"
            store={store}
            prompt={COURSE_PROMPT}
            confirmLabel="Add course"
            onCommit={(value) => {
              const error = commitValue('course', value);
              if (error) {
                toast(error, 'error');
                return;
              }
              toast(COMMIT_VERB.course);
              navigate(`/course/${(value as Course).course_id}`);
            }}
          />
        </Card>
      </div>
    </div>
  );
}
