import { useState, type FormEvent, type MouseEvent } from 'react';
import './auth.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface WelcomeProps {
  name: string;
  onEnter(): void;
}

/** Post-onboarding first-run greeting (MOCKUP lines 145–162). */
export function Welcome(props: WelcomeProps) {
  const { name, onEnter } = props;

  return (
    <div>
      <svg width="120" height="140" viewBox="0 0 100 120" className="auth-outcome__icon" aria-hidden="true">
        <circle cx="18" cy="14" r="3" fill="#ffa946"></circle>
        <circle cx="86" cy="22" r="2.4" fill="#034f46"></circle>
        <circle cx="90" cy="70" r="3" fill="#f0d7ff"></circle>
        <circle cx="8" cy="78" r="2.4" fill="#77776a"></circle>
        <ellipse cx="50" cy="112" rx="30" ry="4" fill="#000000" opacity="0.2"></ellipse>
        <rect
          x="18"
          y="90"
          width="64"
          height="22"
          rx="11"
          fill="#034f46"
          stroke="#1a1a1a"
          strokeWidth="4"
          transform="rotate(-3 50 101)"
        ></rect>
        <rect
          x="26"
          y="66"
          width="48"
          height="20"
          rx="10"
          fill="#f0d7ff"
          stroke="#1a1a1a"
          strokeWidth="4"
          transform="rotate(3 50 76)"
        ></rect>
        <circle cx="50" cy="42" r="20" fill="#ffa946" stroke="#1a1a1a" strokeWidth="4"></circle>
        <path d="M43 38 Q 44.5 35, 46 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"></path>
        <path d="M54 38 Q 55.5 35, 57 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"></path>
        <path
          d="M42 45 Q 50 51, 58 45"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinecap="round"
        ></path>
      </svg>

      <h2 className="auth-outcome__headline--lg">Welcome, {name}.</h2>
      <p className="auth-form__subhead">Your stack is ready. Let's get building.</p>

      <button type="button" className="auth-btn-cta" onClick={onEnter}>
        Enter Cairn
      </button>
    </div>
  );
}

export interface WelcomeBackProps {
  name: string;
  onEnter(): void;
}

/** Returning-user greeting (MOCKUP lines 131–144). */
export function WelcomeBack(props: WelcomeBackProps) {
  const { name, onEnter } = props;

  return (
    <div>
      <svg width="110" height="130" viewBox="0 0 100 120" className="auth-outcome__icon" aria-hidden="true">
        <ellipse cx="50" cy="112" rx="30" ry="4" fill="#000000" opacity="0.2"></ellipse>
        <rect x="18" y="90" width="64" height="22" rx="11" fill="#034f46" stroke="#1a1a1a" strokeWidth="4"></rect>
        <rect x="26" y="66" width="48" height="20" rx="10" fill="#77776a" stroke="#1a1a1a" strokeWidth="4"></rect>
        <circle cx="50" cy="42" r="20" fill="#ffa946" stroke="#1a1a1a" strokeWidth="4"></circle>
        <path d="M43 38 Q 44.5 35, 46 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"></path>
        <path d="M54 38 Q 55.5 35, 57 38" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"></path>
        <path
          d="M42 45 Q 50 51, 58 45"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="2"
          strokeLinecap="round"
        ></path>
      </svg>

      <h2 className="auth-outcome__headline--lg">Welcome back, {name}.</h2>
      <p className="auth-form__subhead">Good to see you — your stack is right where you left it.</p>

      <button type="button" className="auth-btn-cta" onClick={onEnter}>
        Enter Cairn
      </button>
    </div>
  );
}

export interface MagicLinkSentProps {
  email: string;
  onBack(): void;
}

/** Magic-link confirmation (MOCKUP lines 118–130). */
export function MagicLinkSent(props: MagicLinkSentProps) {
  const { email, onBack } = props;

  function handleBack(e: MouseEvent) {
    e.preventDefault();
    onBack();
  }

  function handleResend(e: MouseEvent) {
    e.preventDefault();
  }

  return (
    <div>
      <button type="button" className="auth-verify__back" onClick={handleBack}>
        ← Back to log in
      </button>

      <svg width="64" height="64" viewBox="0 0 100 100" className="auth-outcome__icon" aria-hidden="true">
        <rect x="30" y="38" width="40" height="18" rx="9" fill="#034f46" stroke="#1a1a1a" strokeWidth="4"></rect>
        <circle cx="50" cy="19" r="16" fill="#ffa946" stroke="#1a1a1a" strokeWidth="4"></circle>
        <path d="M45 16 Q 46.5 14, 48 16" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round"></path>
        <path d="M52 16 Q 53.5 14, 55 16" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round"></path>
        <path
          d="M46.5 21 Q 50 23.5, 53.5 21"
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="1.8"
          strokeLinecap="round"
        ></path>
      </svg>

      <h2 className="auth-outcome__headline--md">Check your email</h2>
      <p className="auth-form__subhead">
        We sent a magic link to <strong style={{ color: '#1a1a1a' }}>{email}</strong>. Click it and you're in — no
        password needed.
      </p>
      <p className="auth-outcome__resend-row">
        Didn't get it?{' '}
        <a href="#" className="auth-verify__resend" onClick={handleResend}>
          Resend link
        </a>
      </p>
    </div>
  );
}

/** Google OAuth redirect-in-progress state (MOCKUP lines 111–117). */
export function GoogleConnecting() {
  return (
    <div className="auth-google__wrap">
      <div className="auth-google__spinner" aria-hidden="true"></div>
      <h2 className="auth-google__headline">Connecting to Google…</h2>
      <p className="auth-google__subhead">Just a moment while we link things up.</p>
    </div>
  );
}

export interface ForgotProps {
  sent: boolean;
  sentEmail: string;
  onSubmit(email: string): void;
  onBack(): void;
  pending?: boolean;
  error?: string;
}

/**
 * Forgot-password form + "Trail marked." sent confirmation (MOCKUP lines 78–110).
 * Holds its own email input; the caller owns the `sent`/`sentEmail` transition.
 */
export function Forgot(props: ForgotProps) {
  const { sent, sentEmail, onSubmit, onBack, pending, error } = props;

  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState('');

  function handleBack(e: MouseEvent) {
    e.preventDefault();
    onBack();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      setValidationError('Email is required');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setValidationError('Enter a valid email');
      return;
    }

    setValidationError('');
    onSubmit(trimmed);
  }

  const displayError = validationError || error;

  return (
    <div>
      <button type="button" className="auth-verify__back" onClick={handleBack}>
        ← Back to log in
      </button>

      {sent ? (
        <>
          <svg
            width="140"
            height="110"
            viewBox="0 0 140 110"
            className="auth-outcome__icon"
            aria-hidden="true"
          >
            <path
              d="M8 96 L38 20 L58 60 L78 30 L132 96"
              fill="none"
              stroke="#77776a"
              strokeWidth="3"
              strokeDasharray="6 6"
              strokeLinecap="round"
            ></path>
            <ellipse cx="58" cy="90" rx="22" ry="3" fill="#000000" opacity="0.2"></ellipse>
            <rect x="42" y="72" width="32" height="16" rx="8" fill="#034f46" stroke="#1a1a1a" strokeWidth="4"></rect>
            <rect x="47" y="54" width="22" height="14" rx="7" fill="#f0d7ff" stroke="#1a1a1a" strokeWidth="4"></rect>
            <circle cx="58" cy="38" r="12" fill="#ffa946" stroke="#1a1a1a" strokeWidth="4"></circle>
          </svg>

          <h2 className="auth-outcome__headline--md">Trail marked.</h2>
          <p className="auth-form__subhead">
            Check <strong style={{ color: '#1a1a1a' }}>{sentEmail}</strong> for your way back in — we've left a
            marker right at your inbox.
          </p>

          <button type="button" className="auth-btn-cta" onClick={onBack}>
            Back to log in
          </button>
        </>
      ) : (
        <>
          <svg width="56" height="56" viewBox="0 0 100 100" className="auth-outcome__icon-form" aria-hidden="true">
            <rect x="30" y="64" width="40" height="18" rx="9" fill="#034f46" stroke="#1a1a1a" strokeWidth="4"></rect>
            <rect x="34" y="42" width="32" height="18" rx="9" fill="#77776a" stroke="#1a1a1a" strokeWidth="4"></rect>
            <circle cx="50" cy="22" r="14" fill="#ffa946" stroke="#1a1a1a" strokeWidth="4"></circle>
          </svg>

          <h2 className="auth-outcome__headline--md">Forgetting is a thing of the past.</h2>
          <p className="auth-form__subhead">
            Pop in your email and we'll leave a marker in your inbox to help you find your way back in.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field" style={{ marginBottom: 8 }}>
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                disabled={pending}
                onChange={(e) => setEmail(e.target.value)}
              />
              {displayError && <span className="auth-field__error">{displayError}</span>}
            </div>

            <button type="submit" className="auth-btn-cta" style={{ marginTop: 14 }} disabled={pending}>
              Send reset link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
