import { useState } from 'react';
import type { FriendlyError } from '@/core/errorTranslation';
import { ingest, type Preview } from '@/core/pipeline';
import type { SchemaName } from '@/domain/schemas';
import type { Store } from '@/domain/types';
import { Button, SecondaryButton } from './primitives';

type Phase =
  | { name: 'editing' }
  | { name: 'invalid'; errors: FriendlyError[] }
  | { name: 'previewing'; value: unknown; preview: Preview };

export interface PasteValidateInputProps {
  schemaName: SchemaName;
  store: Store;
  /** The copy-the-prompt block shown above the textarea (Document 3 §5.6). */
  prompt: string;
  confirmLabel: string;
  onCommit: (value: unknown) => void;
}

/**
 * The core ingestion component — Document 3 §3, §5.6; Document 4 E2-S4.
 *
 * Flow: copy prompt → paste JSON → validate → **preview** → confirm.
 * Never commits silently: a successful validation shows a preview and waits for
 * an explicit confirm (Document 3 §5.6 step 5).
 */
export function PasteValidateInput({
  schemaName,
  store,
  prompt,
  confirmLabel,
  onCommit,
}: PasteValidateInputProps) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>({ name: 'editing' });
  const [copied, setCopied] = useState(false);

  const validateText = (raw: string) => {
    const result = ingest(raw, schemaName, store);
    setPhase(
      result.ok
        ? { name: 'previewing', value: result.value, preview: result.preview }
        : { name: 'invalid', errors: result.errors },
    );
  };

  const validate = () => validateText(text);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions. The prompt is visible and
      // selectable regardless, so this is a nicety, not a failure path.
      setCopied(false);
    }
  };

  const invalid = phase.name === 'invalid';

  return (
    <div className="paste-panel">
      <div className="prompt-block">
        <div className="prompt-head">
          <span className="eyebrow">Step 1 — copy this prompt</span>
          <SecondaryButton onClick={copyPrompt}>{copied ? 'Copied' : 'Copy prompt'}</SecondaryButton>
        </div>
        <div className="prompt-text">{prompt}</div>
      </div>

      <div>
        <label className="eyebrow" htmlFor="paste-input" style={{ display: 'block', marginBottom: 'var(--space-5)' }}>
          Step 2 — paste the JSON your AI gave you
        </label>
        <textarea
          id="paste-input"
          className="paste-area"
          value={text}
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'paste-errors' : undefined}
          placeholder="Paste the JSON here, from the opening { to the closing }"
          onChange={(e) => {
            setText(e.target.value);
            // Editing after a verdict invalidates it — never leave a stale
            // preview attached to changed text.
            if (phase.name !== 'editing') setPhase({ name: 'editing' });
          }}
          onPaste={(e) => {
            // Validate immediately on paste — the paste IS the submit gesture
            // in this flow, so don't make the user click Preview to learn what
            // they just did. The DOM value isn't updated until after the paste
            // event, hence the microtask hop.
            const target = e.currentTarget;
            window.setTimeout(() => {
              if (target.value.trim().length > 0) validateText(target.value);
            }, 0);
          }}
        />
      </div>

      {phase.name === 'invalid' && (
        <div className="error-list" id="paste-errors" role="alert">
          <h3>
            {phase.errors.length === 1
              ? "That didn't validate — here's what to fix:"
              : `That didn't validate — here are ${phase.errors.length} things to fix:`}
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
          <div className="preview-summary">{phase.preview.summary}</div>
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
            <Button
              onClick={() => {
                onCommit(phase.value);
                setText('');
                setPhase({ name: 'editing' });
              }}
            >
              {confirmLabel}
            </Button>
            <SecondaryButton onClick={() => setPhase({ name: 'editing' })}>Back</SecondaryButton>
          </>
        ) : (
          <Button onClick={validate} disabled={text.trim().length === 0}>
            Preview
          </Button>
        )}
      </div>
    </div>
  );
}
