import { useState } from 'react';
import { useToast, type ToastAction } from '@/components/feedback';
import { Button, Card, SecondaryButton, Tag } from '@/components/primitives';
import { detectSchema } from '@/core/detect';
import type { FriendlyError } from '@/core/errorTranslation';
import { COMMIT_VERB, ingest, SCHEMA_LABEL, type Preview } from '@/core/pipeline';
import type { SchemaName } from '@/domain/schemas';
import type { Course, Store } from '@/domain/types';
import { navigate } from '@/router';

type Phase =
  | { name: 'editing' }
  | { name: 'undetected' }
  | { name: 'invalid'; schemaName: SchemaName; errors: FriendlyError[] }
  | { name: 'previewing'; schemaName: SchemaName; value: unknown; preview: Preview };

/** Where each committed kind lives, for the post-commit hand-off. */
const DESTINATION: Record<SchemaName, (value: unknown) => string> = {
  course: (v) => `/course/${(v as Course).course_id}`,
  session: () => '/study',
  exam: () => '/exams',
  running: () => '/fitness',
  lifting: () => '/fitness',
  job: () => '/jobs',
};

/**
 * Quick add — the universal paste inbox. Every ingestion shape is structurally
 * self-identifying, so there is one paste target for the whole app: paste
 * anything, the schema is detected, validated, previewed, and committed.
 * The per-domain Add screens remain the home of their copy-prompts; this is
 * the fast lane for the paste-back half of the loop.
 */
export function QuickAdd({
  store,
  commitValue,
  undoLast,
}: {
  store: Store;
  commitValue: (schemaName: SchemaName, value: unknown) => string | null;
  undoLast: () => string | null;
}) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ name: 'editing' });
  const { toast } = useToast();

  const validateText = (raw: string) => {
    if (raw.trim().length === 0) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.trim());
    } catch {
      // Not JSON (or fenced/truncated) — run it through ingest with a best
      // guess so the pipeline's parse errors (which name the exact position)
      // do the explaining. Schema choice is irrelevant on a parse failure.
      const result = ingest(raw, 'course', store);
      if (!result.ok) setPhase({ name: 'invalid', schemaName: 'course', errors: result.errors });
      return;
    }

    const schemaName = detectSchema(parsed);
    if (!schemaName) {
      setPhase({ name: 'undetected' });
      return;
    }

    const result = ingest(raw, schemaName, store);
    setPhase(
      result.ok
        ? { name: 'previewing', schemaName, value: result.value, preview: result.preview }
        : { name: 'invalid', schemaName, errors: result.errors },
    );
  };

  const commit = (schemaName: SchemaName, value: unknown) => {
    const error = commitValue(schemaName, value);
    if (error) {
      toast(error, 'error');
      return;
    }
    const undo: ToastAction = {
      label: 'Undo',
      onClick: () => {
        const err = undoLast();
        toast(err ?? 'Undone.', err ? 'error' : 'info');
      },
    };
    toast(COMMIT_VERB[schemaName], 'success', undo);
    navigate(DESTINATION[schemaName](value));
  };

  return (
    <div className="content">
      <div className="page-head">
        <h1>Quick add</h1>
        <p>
          Paste any JSON your AI gave you — course, session, exam, run, lift, or job application.
          It's recognised automatically.
        </p>
      </div>

      <div className="section">
        <Card style={{ padding: 'var(--space-12)' }}>
          <div className="paste-panel">
            <div>
              <label
                className="eyebrow"
                htmlFor="quick-add-input"
                style={{ display: 'block', marginBottom: 'var(--space-5)' }}
              >
                Paste the JSON here
              </label>
              <textarea
                id="quick-add-input"
                className="paste-area"
                value={text}
                spellCheck={false}
                aria-invalid={phase.name === 'invalid' || phase.name === 'undetected'}
                aria-describedby={
                  phase.name === 'invalid' || phase.name === 'undetected' ? 'quick-add-errors' : undefined
                }
                placeholder="Paste the JSON here, from the opening { to the closing }"
                onChange={(e) => {
                  setText(e.target.value);
                  if (phase.name !== 'editing') setPhase({ name: 'editing' });
                }}
                onPaste={(e) => {
                  const target = e.currentTarget;
                  window.setTimeout(() => {
                    setText(target.value);
                    validateText(target.value);
                  }, 0);
                }}
              />
            </div>

            {phase.name === 'undetected' && (
              <div className="error-list" id="quick-add-errors" role="alert">
                <h3>That's valid JSON, but it isn't a shape this tracker knows.</h3>
                <div className="error-item">
                  <span>
                    Expected a course, study session, exam result, run, lifting session, or job
                    application generated from one of the app's prompts. Re-generate with the prompt
                    from the matching Add screen, then paste the result here.
                  </span>
                </div>
              </div>
            )}

            {phase.name === 'invalid' && (
              <div className="error-list" id="quick-add-errors" role="alert">
                <h3>
                  {`Looks like a ${SCHEMA_LABEL[phase.schemaName]}, but it didn't validate — ${
                    phase.errors.length === 1 ? "here's what to fix:" : `${phase.errors.length} things to fix:`
                  }`}
                </h3>
                {phase.errors.map((e, i) => (
                  <div className="error-item" key={`${e.path}-${i}`}>
                    {e.path && <span className="error-path">{e.path}</span>}
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            )}

            {phase.name === 'previewing' && (
              <div className="preview-card">
                <div className="preview-summary">
                  <Tag tone="accent">{SCHEMA_LABEL[phase.schemaName]}</Tag> {phase.preview.summary}
                </div>
                {phase.preview.detail.length > 0 && (
                  <div className="preview-detail">
                    {phase.preview.detail.map((d, i) => (
                      <span key={i}>{d}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="paste-actions">
              {phase.name === 'previewing' ? (
                <>
                  <Button onClick={() => commit(phase.schemaName, phase.value)}>
                    Add {SCHEMA_LABEL[phase.schemaName]}
                  </Button>
                  <SecondaryButton
                    onClick={() => {
                      setText('');
                      setPhase({ name: 'editing' });
                    }}
                  >
                    Clear
                  </SecondaryButton>
                </>
              ) : (
                <Button onClick={() => validateText(text)} disabled={text.trim().length === 0}>
                  Preview
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
