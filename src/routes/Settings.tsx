import { useId, useRef, useState } from 'react';
import { SegmentedControl } from '@/components/controls';
import { useToast } from '@/components/feedback';
import { Card, DangerButton, SecondaryButton } from '@/components/primitives';
import { Sheet } from '@/components/Sheet';
import { exportBundle, importBundle } from '@/core/transfer';
import { usePreferences } from '@/hooks/usePreferences';
import { useTheme } from '@/theme/useTheme';
import type { Store } from '@/domain/types';

/** The word the user must type out to arm the clear. Matches the action's own
 *  vocabulary ("Clear all data") rather than a generic DELETE. */
const CONFIRM_WORD = 'clear';

function quantity(n: number, one: string, many: string): string | null {
  return n === 0 ? null : `${n} ${n === 1 ? one : many}`;
}

/**
 * "2 courses, 1 exam and 3 runs" — names what is about to be destroyed in the
 * user's own units. Zero-count domains are omitted; listing "0 lifts" is noise
 * that dilutes the counts that do matter.
 */
export function inventory(store: Store): string {
  const parts = [
    quantity(store.courses.length, 'course', 'courses'),
    quantity(store.exams.length, 'exam', 'exams'),
    quantity(store.runs.length, 'run', 'runs'),
    quantity(store.lifts.length, 'lift', 'lifts'),
  ].filter((p): p is string => p !== null);

  if (parts.length === 0) return 'nothing';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Destructive confirmation — deliberate friction. Clearing wipes every session
 * the user has ever logged and there is no undo and no server copy, so the
 * cost of a misclick is total. Typing the word is the cheapest control that
 * cannot be satisfied by a reflex click on a button that happens to be under
 * the pointer, and the export escape hatch is offered here rather than left
 * for the user to remember on their own.
 */
function ClearDataDialog({
  store,
  open,
  onClose,
  onExport,
  onConfirm,
}: {
  store: Store;
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const inputId = useId();
  const armed = typed.trim().toLowerCase() === CONFIRM_WORD;

  const close = () => {
    setTyped('');
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="Clear all data"
      onClose={close}
      footer={
        <div className="sheet-foot">
          <SecondaryButton onClick={close}>Keep my data</SecondaryButton>
          <DangerButton
            disabled={!armed}
            onClick={() => {
              setTyped('');
              onConfirm();
            }}
          >
            Clear all data
          </DangerButton>
        </div>
      }
    >
      <div className="confirm-block">
        <p className="confirm-lede">
          This permanently removes <strong>{inventory(store)}</strong> from this device. It cannot be
          undone, and there is no copy on a server.
        </p>

        <div className="confirm-escape">
          <span>Want it back later?</span>
          <SecondaryButton onClick={onExport}>Export data first</SecondaryButton>
        </div>

        <div className="confirm-field">
          <label htmlFor={inputId}>
            Type <code>{CONFIRM_WORD}</code> to confirm
          </label>
          <input
            id={inputId}
            className="confirm-input"
            type="text"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Settings — Document 4 E8-S2 (theme + unit preferences) and E8-S1 (export /
 * import). Changes apply app-wide immediately and persist.
 */
export function Settings({
  store,
  replaceStore,
  clearStore,
}: {
  store: Store;
  replaceStore: (next: Store) => string | null;
  clearStore: () => string | null;
}) {
  const { theme, set: setTheme } = useTheme();
  const { prefs, setWeightUnit } = usePreferences();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Nothing to destroy means nothing to confirm — the control states that
  // rather than opening a dialog about clearing zero things.
  const isEmpty = inventory(store) === 'nothing';

  const doExport = () => {
    const blob = new Blob([exportBundle(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyos-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const result = importBundle(text);
    if (!result.ok) {
      // Surface the first problem; the file is unchanged on disk regardless.
      toast(result.errors[0]?.message ?? "That import didn't work.", 'error');
      return;
    }
    const err = replaceStore(result.store);
    if (err) {
      toast(err, 'error');
      return;
    }
    const { courses, exams, runs, lifts } = result.counts;
    toast(`Imported ${courses} courses, ${exams} exams, ${runs} runs, ${lifts} lifts`);
  };

  return (
    <div className="content">
      <div className="page-head">
        <h1>Settings</h1>
        <p>Preferences and your data. Everything is stored on this device.</p>
      </div>

      <div className="section">
        <div className="section-title">Appearance</div>
        <Card className="panel">
          <div className="settings-row">
            <div>
              <div className="settings-label">Theme</div>
              <div className="settings-hint">Applies immediately and is remembered.</div>
            </div>
            <SegmentedControl
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Weight unit</div>
              <div className="settings-hint">Display only — lifts are always stored in kg.</div>
            </div>
            <SegmentedControl
              label="Weight unit"
              value={prefs.weightUnit}
              onChange={setWeightUnit}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="section">
        <div className="section-title">Your data</div>
        <Card className="panel">
          <div className="settings-row">
            <div>
              <div className="settings-label">Export</div>
              <div className="settings-hint">Download everything as a single JSON file.</div>
            </div>
            <SecondaryButton onClick={doExport}>Export data</SecondaryButton>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Import</div>
              <div className="settings-hint">
                Replace everything with a previously exported file. Validated before it's applied.
              </div>
            </div>
            <SecondaryButton onClick={() => fileRef.current?.click()}>Import data</SecondaryButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void doImport(file);
                e.target.value = ''; // allow re-importing the same file
              }}
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-label">Clear all data</div>
              <div className="settings-hint">
                {isEmpty
                  ? "There's nothing stored on this device yet."
                  : `Permanently removes ${inventory(store)} from this device.`}
              </div>
            </div>
            <SecondaryButton disabled={isEmpty} onClick={() => setConfirmClear(true)}>
              Clear data
            </SecondaryButton>
          </div>
        </Card>
      </div>

      <ClearDataDialog
        store={store}
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onExport={doExport}
        onConfirm={() => {
          const err = clearStore();
          toast(err ?? 'All data cleared', err ? 'error' : 'success');
          setConfirmClear(false);
        }}
      />

      <div className="section">
        <div className="section-title">Developer</div>
        <Card className="list-card">
          <a className="row row-link" href="#/dev/tokens">
            <div className="row-left">
              <span className="topic">Token sheet</span>
            </div>
            <div className="row-right">
              <span className="row-chevron">→</span>
            </div>
          </a>
          <a className="row row-link" href="#/dev/components">
            <div className="row-left">
              <span className="topic">Component showcase</span>
            </div>
            <div className="row-right">
              <span className="row-chevron">→</span>
            </div>
          </a>
        </Card>
      </div>
    </div>
  );
}
