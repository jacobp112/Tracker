import { useId, useRef, useState, type CSSProperties } from 'react';
import { useToast } from '@/components/feedback';
import { useAuth } from '@/auth/useAuth';
import { exportBundle, importBundle } from '@/core/transfer';
import { useTheme } from '@/theme/useTheme';
import type { Store } from '@/domain/types';
import { getCairnTheme, type CairnTheme } from '@/theme/cairnMock';

const SERIF = "'EB Garamond', var(--font-display)";
const SANS = 'var(--font-sans)';
const CONFIRM_WORD = 'clear';

function quantity(n: number, one: string, many: string): string | null {
  return n === 0 ? null : `${n} ${n === 1 ? one : many}`;
}

/**
 * "2 courses and 1 exam" — names what is about to be destroyed in the user's
 * own units. Zero-count domains are omitted.
 */
export function inventory(store: Store): string {
  const parts = [
    quantity(store.courses.length, 'course', 'courses'),
    quantity(store.exams.length, 'exam', 'exams'),
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return 'nothing';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Settings — rebuilt to the approved mockup: account, appearance segmented,
 * a data-ownership section, and a rotated danger section whose clear-all button
 * arms only once the word "clear" is typed. Real theme + export/import/clear
 * handlers; logic unchanged.
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
  const { theme: mode, set: setTheme } = useTheme();
  const isDark = mode === 'dark';
  const theme = getCairnTheme(isDark);
  const { toast } = useToast();
  const { user, signOutUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const armed = typed.trim().toLowerCase() === CONFIRM_WORD;
  const isEmpty = inventory(store) === 'nothing';

  const doExport = () => {
    const blob = new Blob([exportBundle(store)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cairn-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const result = importBundle(text);
    if (!result.ok) {
      toast(result.errors[0]?.message ?? "That import didn't work.", 'error');
      return;
    }
    const err = replaceStore(result.store);
    if (err) {
      toast(err, 'error');
      return;
    }
    const { courses, exams } = result.counts;
    toast(`Imported ${courses} courses and ${exams} exams`);
  };

  const doClear = () => {
    if (!armed) return;
    const err = clearStore();
    toast(err ?? 'All data cleared', err ? 'error' : 'success');
    setTyped('');
  };

  const doSignOut = async () => {
    try {
      await signOutUser();
      toast('Signed out');
    } catch {
      toast('Could not sign out', 'error');
    }
  };

  return (
    <div style={contentStyle()}>
      <div style={{ maxWidth: '640px' }}>
        {user && (
          <section style={section(theme)}>
            <h2 style={sectionTitle(theme)}>Account</h2>
            <div style={row()}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: theme.ink }}>
                {user.email ?? user.displayName ?? 'Signed in'}
              </span>
              <button type="button" data-press onClick={doSignOut} style={pillBtn(theme)}>
                Sign out
              </button>
            </div>
          </section>
        )}

        <section style={section(theme)}>
          <h2 style={sectionTitle(theme)}>Appearance</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={!isDark}
              style={themeSeg(theme, !isDark)}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={isDark}
              style={themeSeg(theme, isDark)}
            >
              Dark
            </button>
          </div>
        </section>

        <section style={section(theme)}>
          <h2 style={sectionTitle(theme)}>Your data, in a file you own</h2>
          <p style={ownershipText(theme)}>
            Cairn keeps everything local-first. Export a full backup any time, or import a bundle to
            restore or move your stack.
          </p>
          <div style={row()}>
            <button type="button" data-press onClick={doExport} style={pillBtn(theme)}>
              Export data
            </button>
            <button type="button" data-press onClick={() => fileRef.current?.click()} style={pillBtn(theme)}>
              Import a bundle
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void doImport(file);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        <section style={dangerSection(theme)}>
          <h2 style={{ fontFamily: SERIF, fontSize: '19px', color: theme.error, margin: '0 0 8px' }}>Danger zone</h2>
          {isEmpty ? (
            <p style={ownershipText(theme)}>There’s nothing stored on this device yet.</p>
          ) : (
            <>
              <p style={ownershipText(theme)}>
                This permanently clears <strong style={{ color: theme.ink }}>{inventory(store)}</strong> from
                this device — every course, topic, and history. It cannot be undone. Type{' '}
                <code style={{ fontFamily: 'monospace', color: theme.error }}>clear</code> to arm the button.
              </p>
              <div style={row()}>
                <input
                  id={inputId}
                  aria-label="Type clear to confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="type clear"
                  autoComplete="off"
                  spellCheck={false}
                  style={{ border: `2px solid ${theme.border}`, borderRadius: '9999px', padding: '10px 16px', fontFamily: SANS, fontSize: '13px', background: theme.inputBg, color: theme.ink, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={doClear}
                  disabled={!armed}
                  style={{
                    background: armed ? theme.error : theme.surfaceAlt, color: armed ? '#ffffeb' : theme.muted,
                    border: `2px solid ${theme.border}`, borderRadius: '9999px', padding: '10px 18px',
                    fontSize: '13px', fontWeight: 700, cursor: armed ? 'pointer' : 'not-allowed',
                  }}
                >
                  Clear all data
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── style builders ───────────────────────────────────────────────── */
function contentStyle(): CSSProperties {
  return { flex: 1, width: '100%', maxWidth: '1440px', boxSizing: 'border-box', padding: '36px 40px 56px', position: 'relative' };
}
function section(t: CairnTheme): CSSProperties {
  return { background: t.surface, border: `2px solid ${t.border}`, borderRadius: '16px 34px 16px 34px', padding: '24px', marginBottom: '20px', boxShadow: `4px 5px 0 ${t.shadow}` };
}
function dangerSection(t: CairnTheme): CSSProperties {
  return { background: t.surface, border: `2px solid ${t.error}`, borderRadius: '16px 34px 16px 34px', padding: '24px', marginBottom: '20px', boxShadow: `4px 5px 0 ${t.error}`, transform: 'rotate(0.3deg)' };
}
function sectionTitle(t: CairnTheme): CSSProperties {
  return { fontFamily: SERIF, fontSize: '19px', color: t.ink, margin: '0 0 14px' };
}
function row(): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px', flexWrap: 'wrap' };
}
function pillBtn(t: CairnTheme): CSSProperties {
  return { background: t.lavender, border: `2px solid ${t.border}`, borderRadius: '9999px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, color: '#1a1a1a', cursor: 'pointer' };
}
function ownershipText(t: CairnTheme): CSSProperties {
  return { fontSize: '13px', color: t.muted, margin: '0 0 14px', lineHeight: 1.5 };
}
function themeSeg(t: CairnTheme, active: boolean): CSSProperties {
  return { flex: 1, padding: '12px', borderRadius: '9999px', border: `2px solid ${t.border}`, background: active ? t.bg : 'transparent', color: t.ink, fontFamily: SANS, fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
}
