import { useState, type FormEvent } from 'react';
import './auth.css';

export interface AuthFormProps {
  mode: 'login' | 'signup';
  onModeChange(m: 'login' | 'signup'): void;
  onSubmit(v: { name: string; email: string; password: string }): void;
  onGoogle(): void;
  onMagicLink(email: string): void;
  onForgot(): void;
  pending?: boolean;
  serverError?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strength colors/labels verbatim from MOCKUP lines 411–412. */
const PW_COLORS = ['#e4e4d0', '#c9c6ad', '#77776a', '#034f46', '#ffa946'];
const PW_LABELS = ['', 'Pebble', 'Stone', 'Boulder', 'Bedrock'];

/** Scoring mirrors MOCKUP lines 317–326 (`onPasswordInput`). */
function scorePassword(v: string): number {
  let score = 0;
  if (v.length >= 6) score++;
  if (v.length >= 10) score++;
  if (/\d/.test(v)) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;
  return Math.min(score, 4);
}

/**
 * Login/signup form (MOCKUP lines 71–74 tabs, 227–284 form body).
 * Presentational + local validation only — submission and OAuth/magic-link
 * flows are owned by the caller via props.
 */
export function AuthForm(props: AuthFormProps) {
  const { mode, onModeChange, onSubmit, onGoogle, onMagicLink, onForgot, pending, serverError } = props;
  const isSignup = mode === 'signup';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const pwScore = scorePassword(password);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    let nextEmailError = '';
    let nextPasswordError = '';
    let nextNameError = '';

    if (!trimmedEmail) nextEmailError = 'Email is required';
    else if (!EMAIL_RE.test(trimmedEmail)) nextEmailError = 'Enter a valid email';

    if (!password) nextPasswordError = 'Password is required';

    if (isSignup) {
      if (!trimmedName) nextNameError = 'Name is required';
      if (!nextPasswordError && password.length < 6) nextPasswordError = 'Use at least 6 characters';
    }

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setNameError(nextNameError);

    if (nextEmailError || nextPasswordError || nextNameError) return;

    onSubmit({ name: isSignup ? trimmedName : '', email: trimmedEmail, password });
  }

  return (
    <div>
      <div className="auth-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'}
          onClick={() => onModeChange('login')}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={mode === 'signup' ? 'auth-tab auth-tab--active' : 'auth-tab'}
          onClick={() => onModeChange('signup')}
        >
          Sign up
        </button>
      </div>

      <h2 className="auth-form__headline">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
      <p className="auth-form__subhead">
        {isSignup ? 'Start stacking in under a minute.' : 'Pick up right where you left off.'}
      </p>

      <div className="auth-form__oauth">
        <button type="button" className="auth-btn-ghost" onClick={onGoogle}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.88 2.69-6.64z"
            ></path>
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"
            ></path>
            <path
              fill="#FBBC05"
              d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"
            ></path>
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
            ></path>
          </svg>
          {isSignup ? 'Sign up with Google' : 'Continue with Google'}
        </button>
      </div>

      <div className="auth-form__divider">
        <div className="auth-form__divider-line"></div>
        <span>or</span>
        <div className="auth-form__divider-line"></div>
      </div>

      <form className="auth-form__fields" onSubmit={handleSubmit} noValidate>
        {isSignup && (
          <div className="auth-field">
            <label htmlFor="auth-name">Name</label>
            <input
              id="auth-name"
              type="text"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError && <span className="auth-field__error">{nameError}</span>}
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && <span className="auth-field__error">{emailError}</span>}
        </div>

        <div className="auth-field">
          <div className="auth-field__row">
            <label htmlFor="auth-password">Password</label>
            {!isSignup && (
              <a
                href="#"
                className="auth-form__forgot"
                onClick={(e) => {
                  e.preventDefault();
                  onForgot();
                }}
              >
                Forgot?
              </a>
            )}
          </div>
          <input
            id="auth-password"
            type="password"
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {passwordError && <span className="auth-field__error">{passwordError}</span>}
          {isSignup && (
            <div className="auth-pw-meter">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="auth-pw-meter__bar"
                  style={{ background: pwScore >= n ? PW_COLORS[pwScore] : PW_COLORS[0] }}
                ></div>
              ))}
              <span className="auth-pw-meter__label">{PW_LABELS[pwScore]}</span>
            </div>
          )}
        </div>

        {serverError && <p className="auth-form__server-error">{serverError}</p>}

        <button type="submit" className="auth-btn-cta" disabled={pending}>
          {isSignup ? 'Create account' : 'Log in'}
        </button>

        <button type="button" className="auth-btn-text" onClick={() => onMagicLink(email.trim())}>
          {isSignup ? 'Or skip the password with a magic link' : 'Send me a magic link instead'}
        </button>
      </form>
    </div>
  );
}
