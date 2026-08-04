import { useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, type MouseEvent } from 'react';
import './auth.css';

export interface VerifyCodeProps {
  email: string;
  onSubmit(code: string): void;
  onResend(): void;
  onBack(): void;
  pending?: boolean;
  error?: string;
}

const CODE_LENGTH = 6;
const EMPTY_CODE = Array<string>(CODE_LENGTH).fill('');

/**
 * 6-digit verification code entry (MOCKUP lines 196–226).
 * The "Demo code: 123456" hint (MOCKUP line 221) is intentionally omitted.
 */
export function VerifyCode(props: VerifyCodeProps) {
  const { email, onSubmit, onResend, onBack, pending, error } = props;

  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function focusBox(index: number) {
    inputRefs.current[index]?.focus();
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Take the last entered character so typing over an existing digit works.
    const char = raw.slice(-1);

    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });

    if (char && index < CODE_LENGTH - 1) focusBox(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      focusBox(index - 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pasted)) return;

    e.preventDefault();
    setDigits(pasted.split(''));
    focusBox(CODE_LENGTH - 1);
  }

  function handleSubmit() {
    onSubmit(digits.join(''));
  }

  function handleResend(e: MouseEvent) {
    e.preventDefault();
    onResend();
  }

  function handleBack(e: MouseEvent) {
    e.preventDefault();
    onBack();
  }

  return (
    <div>
      <button type="button" className="auth-verify__back" onClick={handleBack}>
        ← Back to sign up
      </button>

      <svg width="64" height="64" viewBox="0 0 100 100" className="auth-verify__icon" aria-hidden="true">
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

      <h2 className="auth-form__headline">Check your email</h2>
      <p className="auth-form__subhead">
        We sent a 6-digit code to <strong style={{ color: '#1a1a1a' }}>{email}</strong>. Enter it below to finish
        setting up your stack.
      </p>

      <div className="auth-verify__boxes">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            value={digit}
            disabled={pending}
            className={index % 2 === 0 ? 'auth-verify__box auth-verify__box--a' : 'auth-verify__box auth-verify__box--b'}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
          />
        ))}
      </div>

      {error && <p className="auth-verify__error">{error}</p>}

      <button type="button" className="auth-btn-cta" disabled={pending} onClick={handleSubmit}>
        Verify email
      </button>

      <p className="auth-verify__resend-row">
        Didn't get it?{' '}
        <a href="#" className="auth-verify__resend" onClick={handleResend}>
          Resend code
        </a>
      </p>
    </div>
  );
}
