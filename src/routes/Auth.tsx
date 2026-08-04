import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { sendCode, verifyCode } from '@/auth/verifyCodeClient';
import { navigate } from '@/router';
import { AuthForm } from '@/routes/auth/AuthForm';
import { BrandPanel } from '@/routes/auth/BrandPanel';
import { DevStateNav, type AuthMode } from '@/routes/auth/DevStateNav';
import { Forgot, GoogleConnecting, MagicLinkSent, Welcome, WelcomeBack } from '@/routes/auth/Outcome';
import { Onboarding } from '@/routes/auth/Onboarding';
import { VerifyCode } from '@/routes/auth/VerifyCode';
import '@/routes/auth/auth.css';

const GENERIC_ERROR = 'Something went wrong. Try again.';

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : GENERIC_ERROR;
}

/** Fallback display name for a returning user when none is known yet. */
function nameFromEmail(email: string): string {
  return email.split('@')[0] || 'friend';
}

/**
 * The Cairn auth page — page shell (MOCKUP `.cairn-noise` wrapper + corner
 * logo lockup, lines 30–38) plus the two-card row, driving the `mode` state
 * machine (MOCKUP §3) that switches the right-hand card between the
 * login/signup form and every outcome screen. Real network calls are owned
 * here; every subcomponent stays presentational.
 */
export function Auth({ signup }: { signup: boolean }): JSX.Element {
  const {
    registerWithEmail,
    signInWithEmail,
    signInWithGoogle,
    sendMagicLink,
    completeMagicLinkSignIn,
    sendPasswordReset,
    saveOnboarding,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(() => (signup ? 'signup' : 'login'));
  const [animating, setAnimating] = useState(false);
  const [pending, setPending] = useState(false);

  const [email, setEmail] = useState('');
  const [serverError, setServerError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [welcomeName, setWelcomeName] = useState('friend');
  const [welcomeBackName, setWelcomeBackName] = useState('friend');

  // Mirrors MOCKUP's `switchMode`: a 160ms fade-out precedes the content
  // swap so the two never overlap mid-transition (MOCKUP lines 310–315,
  // `contentWrapStyle` lines 445–448). Read via a ref so the callback never
  // goes stale without needing `mode` in its dependency array.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const fadeTimeout = useRef<ReturnType<typeof setTimeout>>();

  const switchMode = useCallback((next: AuthMode) => {
    if (next === modeRef.current) return;
    setAnimating(true);
    clearTimeout(fadeTimeout.current);
    fadeTimeout.current = setTimeout(() => {
      setMode(next);
      setAnimating(false);
    }, 160);
  }, []);

  useEffect(() => () => clearTimeout(fadeTimeout.current), []);

  // A magic-link click lands back on #/auth with the sign-in link params in
  // the URL; finish that sign-in on mount rather than showing a login form
  // the user already authenticated past.
  useEffect(() => {
    let cancelled = false;
    completeMagicLinkSignIn()
      .then((done) => {
        if (!cancelled && done) {
          setWelcomeBackName('there');
          switchMode('welcomeBack');
        }
      })
      .catch(() => {
        // No screen to surface this on yet — the user just sees the login form.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAuthSubmit(v: { name: string; email: string; password: string }) {
    if (pending) return;
    setPending(true);
    setServerError('');
    try {
      if (mode === 'signup') {
        await registerWithEmail(v.name, v.email, v.password);
        setEmail(v.email);
        await sendCode(v.email);
        switchMode('verify');
      } else {
        await signInWithEmail(v.email, v.password);
        setEmail(v.email);
        setWelcomeBackName(nameFromEmail(v.email));
        switchMode('welcomeBack');
      }
    } catch (e) {
      setServerError(messageOf(e));
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    if (pending) return;
    const formMode = mode;
    setPending(true);
    setServerError('');
    switchMode('googleConnecting');
    try {
      await signInWithGoogle();
      setWelcomeBackName('there');
      switchMode('welcomeBack');
    } catch (e) {
      setServerError(messageOf(e));
      switchMode(formMode);
    } finally {
      setPending(false);
    }
  }

  async function handleMagicLink(emailInput: string) {
    if (pending) return;
    setPending(true);
    setServerError('');
    try {
      await sendMagicLink(emailInput);
      setEmail(emailInput);
      switchMode('magicLinkSent');
    } catch (e) {
      setServerError(messageOf(e));
    } finally {
      setPending(false);
    }
  }

  function handleForgotOpen() {
    setForgotSent(false);
    setForgotError('');
    switchMode('forgot');
  }

  async function handleForgotSubmit(emailInput: string) {
    if (pending) return;
    setPending(true);
    setForgotError('');
    try {
      await sendPasswordReset(emailInput);
      setForgotEmail(emailInput);
      setForgotSent(true);
    } catch (e) {
      setForgotError(messageOf(e));
    } finally {
      setPending(false);
    }
  }

  function handleForgotBack() {
    setForgotSent(false);
    setForgotError('');
    switchMode('login');
  }

  async function handleVerifySubmit(code: string) {
    if (pending) return;
    setPending(true);
    setVerifyError('');
    try {
      await verifyCode(email, code);
      switchMode('onboarding');
    } catch (e) {
      setVerifyError(messageOf(e));
    } finally {
      setPending(false);
    }
  }

  async function handleResendCode() {
    if (pending) return;
    setPending(true);
    try {
      await sendCode(email);
    } catch (e) {
      setVerifyError(messageOf(e));
    } finally {
      setPending(false);
    }
  }

  async function handleFinishOnboarding(v: { avatarIndex: number; displayName: string }) {
    if (pending) return;
    setPending(true);
    try {
      await saveOnboarding(v.avatarIndex, v.displayName);
      setWelcomeName(v.displayName);
      switchMode('welcome');
    } catch {
      // Onboarding has no error slot to surface this on; the user can retry.
    } finally {
      setPending(false);
    }
  }

  function handleEnter() {
    navigate('#/');
  }

  const screen = (() => {
    switch (mode) {
      case 'login':
      case 'signup':
        return (
          <AuthForm
            mode={mode}
            onModeChange={switchMode}
            onSubmit={handleAuthSubmit}
            onGoogle={handleGoogle}
            onMagicLink={handleMagicLink}
            onForgot={handleForgotOpen}
            pending={pending}
            serverError={serverError}
          />
        );
      case 'verify':
        return (
          <VerifyCode
            email={email}
            onSubmit={handleVerifySubmit}
            onResend={handleResendCode}
            onBack={() => switchMode('signup')}
            pending={pending}
            error={verifyError}
          />
        );
      case 'onboarding':
        return <Onboarding onFinish={handleFinishOnboarding} pending={pending} />;
      case 'welcome':
        return <Welcome name={welcomeName} onEnter={handleEnter} />;
      case 'welcomeBack':
        return <WelcomeBack name={welcomeBackName} onEnter={handleEnter} />;
      case 'forgot':
        return (
          <Forgot
            sent={forgotSent}
            sentEmail={forgotEmail}
            onSubmit={handleForgotSubmit}
            onBack={handleForgotBack}
            pending={pending}
            error={forgotError}
          />
        );
      case 'googleConnecting':
        return <GoogleConnecting />;
      case 'magicLinkSent':
        return <MagicLinkSent email={email} onBack={() => switchMode('login')} />;
    }
  })();

  return (
    <div className="cairn-noise auth-page">
      <div className="auth-corner-logo">
        <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="8" y="66" width="84" height="24" rx="12" fill="none" stroke="#1a1a1a" strokeWidth="5"></rect>
          <rect x="24" y="38" width="58" height="22" rx="11" fill="#034f46" stroke="#1a1a1a" strokeWidth="5"></rect>
          <rect x="28" y="12" width="38" height="20" rx="10" fill="#f0d7ff" stroke="#1a1a1a" strokeWidth="5"></rect>
          <circle cx="82" cy="14" r="8" fill="#ffa946" stroke="#1a1a1a" strokeWidth="5"></circle>
        </svg>
        <span className="auth-corner-logo__text">Cairn</span>
      </div>

      <div className="auth-shell">
        <BrandPanel />
        <div className="auth-card">
          <div className="auth-content-wrap" style={{ opacity: animating ? 0 : 1 }}>
            {screen}
          </div>
        </div>
      </div>

      <DevStateNav onPick={setMode} />
    </div>
  );
}
