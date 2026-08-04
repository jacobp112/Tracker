import './auth.css';

const STATES = [
  'login',
  'signup',
  'verify',
  'onboarding',
  'welcome',
  'welcomeBack',
  'forgot',
  'googleConnecting',
  'magicLinkSent',
] as const;

export type AuthMode = (typeof STATES)[number];

/** Dev-only jump bar. Guarded by import.meta.env.DEV so prod tree-shakes it. */
export function DevStateNav({ onPick }: { onPick(m: AuthMode): void }) {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="auth-devnav" aria-label="Dev state navigator">
      {STATES.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
