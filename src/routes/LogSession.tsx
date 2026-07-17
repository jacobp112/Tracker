import { useToast } from '@/components/feedback';
import { PasteValidateInput } from '@/components/PasteValidateInput';
import { Sheet } from '@/components/Sheet';
import { COMMIT_VERB } from '@/core/pipeline';
import { sessionPrompt } from '@/domain/prompts';
import type { Course, Store } from '@/domain/types';

/**
 * Log session flow — Document 4 E4-S6.
 * Uses the E2 pipeline with the §3.1 prompt, with the active course id and its
 * topic list injected. On commit the engine recalculates and the dashboard
 * re-derives on the next render — no manual refresh.
 */
export function LogSession({
  course,
  store,
  open,
  onClose,
  commitValue,
}: {
  course: Course;
  store: Store;
  open: boolean;
  onClose: () => void;
  commitValue: (schemaName: 'session', value: unknown) => string | null;
}) {
  const { toast } = useToast();

  if (!open) return null;

  const topics = course.sections.flatMap((s) =>
    s.topics.map((t) => ({ topic_id: t.topic_id, title: t.title })),
  );

  return (
    <Sheet open title="Log session" onClose={onClose}>
      <PasteValidateInput
        schemaName="session"
        store={store}
        prompt={sessionPrompt(course.course_id, topics)}
        confirmLabel="Log session"
        onCommit={(value) => {
          const error = commitValue('session', value);
          if (error) {
            toast(error, 'error');
            return;
          }
          // The verb matches the action (Document 3 §7).
          toast(COMMIT_VERB.session);
          onClose();
        }}
      />
    </Sheet>
  );
}
