# Cairn Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real, opt-in login/register experience — a landing-page entry point plus a 9-state auth page rebuilt from the `Cairn Login` mockup, wired to Firebase Auth and a small Resend-backed serverless endpoint for 6-digit codes.

**Architecture:** The auth page is a React route (`#/auth`) rendered full-bleed outside the `AppShell`. A `useAuth` hook wraps the Firebase JS SDK for email/password, Google, magic link, password reset and profile updates. The only non-Firebase piece — the 6-digit email code — is a pure, tested `codeService` behind two serverless handlers that send via Resend and store codes in an injectable `CodeStore`. Login is optional; the tracker still works signed-out.

**Tech Stack:** React 18, TypeScript, Vite, Vitest + Testing Library, `firebase` (client), `resend` + `firebase-admin` (server, Vercel-style functions).

## Global Constraints

- **Palette (verbatim):** cream `#ffffeb`, ink `#1a1a1a`, lavender `#f0d7ff`, forest `#034f46`, ember `#ffa946`, fog `#8a8a80`, stone `#e4e4d0`, error red `#b5432f`, muted `#77776a`.
- **Fonts:** display = `'EB Garamond', serif`; UI = `'Figtree', sans-serif`. These are already registered in `src/main.tsx`.
- **Faithful rebuild:** markup, copy, SVGs, rotations, hard offset shadows (`5px 5px 0 #1a1a1a`), mixed corner radii and the 160 ms cross-fade come verbatim from `landing/files to merge/Creative login page mockups-handoff/creative-login-page-mockups/project/Cairn Login.dc.html` (referred to below as **MOCKUP**). Cite its line ranges; do not re-invent visuals.
- **No demo scaffolding:** never ship `demo@cairn.app`, `cairnstack`, or the literal code `123456`. Those are prototype-only.
- **Auth page is light-only** (review flag F1): it does not follow the app dark theme.
- **Secrets never reach the browser:** `RESEND_API_KEY`, `RESEND_FROM`, Firebase service-account creds are server-only. Client Firebase config (`VITE_FIREBASE_*`) is bundled and non-secret.
- **Test runner:** `npx vitest run <path>` for one file; tests live under `tests/**` mirroring `src`/`server` paths, per existing convention (`tests/routes/*.test.tsx`). `tests/setup.ts` already stubs `matchMedia`.
- **Commit style:** end messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Firebase client init + env scaffolding

**Files:**
- Create: `src/lib/firebase.ts`
- Create: `.env.example`
- Modify: `package.json` (add `firebase` dependency)
- Test: `tests/lib/firebase.test.ts`

**Interfaces:**
- Produces: `auth: Auth`, `googleProvider: GoogleAuthProvider`, `firebaseConfig` (from `src/lib/firebase.ts`).

- [ ] **Step 1: Install firebase**

Run: `npm install firebase@^11`
Expected: `firebase` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write `.env.example`**

```dotenv
# Firebase client config (safe to ship in the bundle — not secret).
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=

# Base URL of the deployed auth backend (Task 5). Empty = same origin "/api".
VITE_AUTH_API_BASE=

# --- server only, NEVER prefixed with VITE_ ---
RESEND_API_KEY=
RESEND_FROM=Cairn <noreply@yourdomain.com>
# Firebase Admin service account (JSON string) for the Firestore CodeStore.
FIREBASE_SERVICE_ACCOUNT=
```

- [ ] **Step 3: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

describe('firebase client', () => {
  it('exports an auth instance and a google provider', async () => {
    const mod = await import('@/lib/firebase');
    expect(mod.auth).toBeDefined();
    expect(mod.googleProvider).toBeDefined();
    expect(mod.googleProvider.providerId).toBe('google.com');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/lib/firebase.test.ts`
Expected: FAIL — cannot resolve `@/lib/firebase`.

- [ ] **Step 5: Implement `src/lib/firebase.ts`**

```ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

/**
 * Firebase client init. The config values are public (they ship in every
 * client bundle); env only keeps the project swappable. Guard against
 * re-init so HMR / repeated imports reuse the one app.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/lib/firebase.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/firebase.ts tests/lib/firebase.test.ts
git commit -m "feat(auth): firebase client init + env scaffolding"
```

---

### Task 2: Auth error translation

**Files:**
- Create: `src/auth/errors.ts`
- Test: `tests/auth/errors.test.ts`

**Interfaces:**
- Produces: `authErrorMessage(code: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { authErrorMessage } from '@/auth/errors';

describe('authErrorMessage', () => {
  it('maps known Firebase codes to friendly copy', () => {
    expect(authErrorMessage('auth/wrong-password')).toBe('Incorrect email or password.');
    expect(authErrorMessage('auth/invalid-credential')).toBe('Incorrect email or password.');
    expect(authErrorMessage('auth/email-already-in-use')).toBe(
      'That email already has an account — try logging in.',
    );
    expect(authErrorMessage('auth/invalid-email')).toBe('Enter a valid email.');
    expect(authErrorMessage('auth/too-many-requests')).toBe(
      'Too many attempts. Wait a moment and try again.',
    );
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(authErrorMessage('auth/something-new')).toBe('Something went wrong. Try again.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/errors.test.ts`
Expected: FAIL — cannot resolve `@/auth/errors`.

- [ ] **Step 3: Implement `src/auth/errors.ts`**

```ts
/**
 * Firebase auth error codes → the interface's own voice (mirrors the
 * translation discipline in src/core/errorTranslation.ts): explain and
 * instruct, never leak raw codes.
 */
const MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/email-already-in-use': 'That email already has an account — try logging in.',
  'auth/invalid-email': 'Enter a valid email.',
  'auth/weak-password': 'Use at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/network-request-failed': 'Network problem — check your connection and try again.',
};

export function authErrorMessage(code: string): string {
  return MESSAGES[code] ?? 'Something went wrong. Try again.';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/errors.ts tests/auth/errors.test.ts
git commit -m "feat(auth): friendly Firebase error translation"
```

---

### Task 3: `useAuth` provider + hook

**Files:**
- Create: `src/auth/useAuth.tsx`
- Modify: `src/main.tsx` (wrap `<App/>` in `<AuthProvider>`)
- Test: `tests/auth/useAuth.test.tsx`

**Interfaces:**
- Consumes: `auth`, `googleProvider` (Task 1); `authErrorMessage` (Task 2).
- Produces: `AuthProvider` component and `useAuth(): AuthContextValue` where

```ts
interface AuthContextValue {
  user: import('firebase/auth').User | null;
  loading: boolean;
  registerWithEmail(name: string, email: string, password: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  completeMagicLinkSignIn(): Promise<boolean>;
  sendPasswordReset(email: string): Promise<void>;
  saveOnboarding(avatarIndex: number, displayName: string): Promise<void>;
  signOutUser(): Promise<void>;
}
```

All rejecting methods throw `Error` whose `.message` is already `authErrorMessage(code)`.

- [ ] **Step 1: Write the failing test** (Firebase SDK mocked — no network)

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, cb) => { cb(null); return () => {}; }),
  isSignInWithEmailLink: vi.fn(() => false),
  signInWithEmailLink: vi.fn(),
}));

vi.mock('firebase/auth', () => mocks);
vi.mock('@/lib/firebase', () => ({ auth: {}, googleProvider: {} }));

import { AuthProvider, useAuth } from '@/auth/useAuth';

function Harness() {
  const { registerWithEmail } = useAuth();
  return <button onClick={() => registerWithEmail('Ada', 'a@b.com', 'secret1')}>go</button>;
}

beforeEach(() => vi.clearAllMocks());

describe('useAuth', () => {
  it('register creates the user then sets displayName', async () => {
    mocks.createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1' } });
    mocks.updateProfile.mockResolvedValue(undefined);
    render(<AuthProvider><Harness /></AuthProvider>);
    await userEvent.click(screen.getByText('go'));
    await waitFor(() => expect(mocks.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      {}, 'a@b.com', 'secret1',
    ));
    expect(mocks.updateProfile).toHaveBeenCalledWith({ uid: 'u1' }, { displayName: 'Ada' });
  });

  it('surfaces a friendly message when sign-in fails', async () => {
    mocks.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });
    let captured = '';
    function LoginHarness() {
      const { signInWithEmail } = useAuth();
      return <button onClick={async () => { try { await signInWithEmail('a@b.com', 'x'); } catch (e) { captured = (e as Error).message; } }}>login</button>;
    }
    render(<AuthProvider><LoginHarness /></AuthProvider>);
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(captured).toBe('Incorrect email or password.'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/useAuth.test.tsx`
Expected: FAIL — cannot resolve `@/auth/useAuth`.

- [ ] **Step 3: Implement `src/auth/useAuth.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { authErrorMessage } from '@/auth/errors';

const MAGIC_EMAIL_KEY = 'cairn-magic-email';
function magicLinkSettings() {
  return { url: `${window.location.origin}/#/auth`, handleCodeInApp: true };
}

/** Wrap a Firebase call so callers only ever see friendly Error messages. */
async function friendly<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    throw new Error(authErrorMessage(code));
  }
}

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  registerWithEmail(name: string, email: string, password: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  completeMagicLinkSignIn(): Promise<boolean>;
  sendPasswordReset(email: string): Promise<void>;
  saveOnboarding(avatarIndex: number, displayName: string): Promise<void>;
  signOutUser(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async registerWithEmail(name, email, password) {
      const cred = await friendly(() => createUserWithEmailAndPassword(auth, email, password));
      await friendly(() => updateProfile(cred.user, { displayName: name }));
    },
    async signInWithEmail(email, password) {
      await friendly(() => signInWithEmailAndPassword(auth, email, password));
    },
    async signInWithGoogle() {
      await friendly(() => signInWithPopup(auth, googleProvider));
    },
    async sendMagicLink(email) {
      await friendly(() => sendSignInLinkToEmail(auth, email, magicLinkSettings()));
      window.localStorage.setItem(MAGIC_EMAIL_KEY, email);
    },
    async completeMagicLinkSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) return false;
      const email = window.localStorage.getItem(MAGIC_EMAIL_KEY) ?? '';
      if (!email) return false;
      await friendly(() => signInWithEmailLink(auth, email, window.location.href));
      window.localStorage.removeItem(MAGIC_EMAIL_KEY);
      return true;
    },
    async sendPasswordReset(email) {
      await friendly(() => sendPasswordResetEmail(auth, email));
    },
    async saveOnboarding(avatarIndex, displayName) {
      if (!auth.currentUser) throw new Error('You are not signed in.');
      await friendly(() => updateProfile(auth.currentUser!, {
        displayName,
        photoURL: `cairn-avatar:${avatarIndex}`,
      }));
    },
    async signOutUser() {
      await friendly(() => signOut(auth));
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
```

- [ ] **Step 4: Wrap the app in `src/main.tsx`**

Modify the render call:

```tsx
import { AuthProvider } from './auth/useAuth';

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/auth/useAuth.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/auth/useAuth.tsx src/main.tsx tests/auth/useAuth.test.tsx
git commit -m "feat(auth): useAuth provider wrapping Firebase auth"
```

---

### Task 4: Verify-code service (pure core + stores)

**Files:**
- Create: `server/auth/store.ts`
- Create: `server/auth/codeService.ts`
- Test: `tests/server/codeService.test.ts`

**Interfaces:**
- Produces:
```ts
// store.ts
export interface CodeRecord { hash: string; expiresAt: number; attempts: number; }
export interface CodeStore {
  set(email: string, rec: CodeRecord): Promise<void>;
  get(email: string): Promise<CodeRecord | null>;
  delete(email: string): Promise<void>;
}
export class MemoryCodeStore implements CodeStore { /* ... */ }

// codeService.ts
export function makeCodeService(store: CodeStore, opts?: {
  now?: () => number; ttlMs?: number; maxAttempts?: number; random?: () => string;
}): {
  issue(email: string): Promise<string>;            // returns the plaintext code to email
  check(email: string, code: string): Promise<
    { ok: true } | { ok: false; reason: 'expired' | 'too-many' | 'mismatch' | 'missing' }>;
};
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { MemoryCodeStore } from '@server/auth/store';
import { makeCodeService } from '@server/auth/codeService';

function svc(nowRef: { t: number }) {
  return makeCodeService(new MemoryCodeStore(), {
    now: () => nowRef.t,
    ttlMs: 10 * 60_000,
    maxAttempts: 5,
    random: () => '654321',
  });
}

describe('codeService', () => {
  it('issues a 6-digit code and verifies it once', async () => {
    const now = { t: 0 };
    const s = svc(now);
    const code = await s.issue('a@b.com');
    expect(code).toBe('654321');
    expect(await s.check('a@b.com', '654321')).toEqual({ ok: true });
  });

  it('rejects a wrong code and counts attempts', async () => {
    const now = { t: 0 };
    const s = svc(now);
    await s.issue('a@b.com');
    expect(await s.check('a@b.com', '000000')).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('locks out after maxAttempts', async () => {
    const now = { t: 0 };
    const s = svc(now);
    await s.issue('a@b.com');
    for (let i = 0; i < 5; i++) await s.check('a@b.com', '000000');
    expect(await s.check('a@b.com', '654321')).toEqual({ ok: false, reason: 'too-many' });
  });

  it('expires after ttl', async () => {
    const now = { t: 0 };
    const s = svc(now);
    await s.issue('a@b.com');
    now.t = 10 * 60_000 + 1;
    expect(await s.check('a@b.com', '654321')).toEqual({ ok: false, reason: 'expired' });
  });

  it('is single-use — a verified code cannot be reused', async () => {
    const now = { t: 0 };
    const s = svc(now);
    await s.issue('a@b.com');
    await s.check('a@b.com', '654321');
    expect(await s.check('a@b.com', '654321')).toEqual({ ok: false, reason: 'missing' });
  });
});
```

- [ ] **Step 2: Add the `@server` alias and make TS aware of `server/` + `api/`**

Modify `vite.config.ts` `resolve.alias` to add:

```ts
'@server': fileURLToPath(new URL('./server', import.meta.url)),
```

Then modify `tsconfig.json` in three places (server code uses `process.env` and `node:crypto`, and the Vercel adapters use `@vercel/node`, so Node globals must be available and the dirs must be compiled):
- `compilerOptions.paths`: add `"@server/*": ["server/*"]` alongside the existing `"@/*"`.
- `compilerOptions.types`: change to `["vitest/globals", "@testing-library/jest-dom", "node"]`.
- `include`: add `"server"` and `"api"` → `["src", "tests", "landing", "server", "api", "vite.config.ts", "vitest.config.ts"]`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/server/codeService.test.ts`
Expected: FAIL — cannot resolve `@server/auth/store`.

- [ ] **Step 4: Implement `server/auth/store.ts`**

```ts
export interface CodeRecord {
  hash: string;
  expiresAt: number;
  attempts: number;
}

export interface CodeStore {
  set(email: string, rec: CodeRecord): Promise<void>;
  get(email: string): Promise<CodeRecord | null>;
  delete(email: string): Promise<void>;
}

/** In-memory store for tests and local dev. Not for production (per-instance). */
export class MemoryCodeStore implements CodeStore {
  private map = new Map<string, CodeRecord>();
  async set(email: string, rec: CodeRecord) { this.map.set(email, rec); }
  async get(email: string) { return this.map.get(email) ?? null; }
  async delete(email: string) { this.map.delete(email); }
}
```

- [ ] **Step 5: Implement `server/auth/codeService.ts`**

```ts
import { createHash } from 'node:crypto';
import type { CodeStore } from './store';

const key = (email: string) => email.trim().toLowerCase();
const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

export function makeCodeService(
  store: CodeStore,
  opts: { now?: () => number; ttlMs?: number; maxAttempts?: number; random?: () => string } = {},
) {
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? 10 * 60_000;
  const maxAttempts = opts.maxAttempts ?? 5;
  const random = opts.random ?? (() => String(Math.floor(100000 + Math.random() * 900000)));

  return {
    async issue(email: string): Promise<string> {
      const code = random();
      await store.set(key(email), { hash: hashCode(code), expiresAt: now() + ttlMs, attempts: 0 });
      return code;
    },
    async check(
      email: string,
      code: string,
    ): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'too-many' | 'mismatch' | 'missing' }> {
      const k = key(email);
      const rec = await store.get(k);
      if (!rec) return { ok: false, reason: 'missing' };
      if (rec.attempts >= maxAttempts) return { ok: false, reason: 'too-many' };
      if (now() > rec.expiresAt) { await store.delete(k); return { ok: false, reason: 'expired' }; }
      if (hashCode(code) !== rec.hash) {
        await store.set(k, { ...rec, attempts: rec.attempts + 1 });
        return { ok: false, reason: 'mismatch' };
      }
      await store.delete(k); // single-use
      return { ok: true };
    },
  };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/server/codeService.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 7: Commit**

```bash
git add server/auth/store.ts server/auth/codeService.ts tests/server/codeService.test.ts vite.config.ts tsconfig.json
git commit -m "feat(auth): pure 6-digit code service with expiry + attempt limits"
```

---

### Task 5: Backend email + HTTP handlers + Vercel adapters

**Files:**
- Create: `server/auth/email.ts`
- Create: `server/auth/handlers.ts`
- Create: `server/auth/firestoreStore.ts`
- Create: `api/auth/send-code.ts`
- Create: `api/auth/verify-code.ts`
- Modify: `package.json` (add `resend`, `firebase-admin`; add `@vercel/node` dev dep)
- Test: `tests/server/handlers.test.ts`

**Interfaces:**
- Consumes: `makeCodeService` (Task 4), `CodeStore`/`MemoryCodeStore` (Task 4).
- Produces:
```ts
// handlers.ts
export interface SendEmail { (to: string, code: string): Promise<void>; }
export function makeHandlers(deps: { service: ReturnType<typeof import('@server/auth/codeService').makeCodeService>; sendEmail: SendEmail; }): {
  sendCode(body: { email?: string }): Promise<{ status: number; body: unknown }>;
  verifyCode(body: { email?: string; code?: string }): Promise<{ status: number; body: unknown }>;
};
```

- [ ] **Step 1: Install server deps**

Run: `npm install resend firebase-admin && npm install -D @vercel/node`
Expected: `resend`, `firebase-admin` in `dependencies`; `@vercel/node` in `devDependencies`.

- [ ] **Step 2: Write the failing test** (handlers tested with `MemoryCodeStore` + a stub `sendEmail`)

```ts
import { describe, expect, it, vi } from 'vitest';
import { MemoryCodeStore } from '@server/auth/store';
import { makeCodeService } from '@server/auth/codeService';
import { makeHandlers } from '@server/auth/handlers';

function build() {
  const service = makeCodeService(new MemoryCodeStore(), { random: () => '424242' });
  const sendEmail = vi.fn().mockResolvedValue(undefined);
  return { ...makeHandlers({ service, sendEmail }), sendEmail };
}

describe('auth handlers', () => {
  it('send-code emails a code and 400s on a bad email', async () => {
    const h = build();
    expect((await h.sendCode({ email: 'nope' })).status).toBe(400);
    const ok = await h.sendCode({ email: 'a@b.com' });
    expect(ok.status).toBe(200);
    expect(h.sendEmail).toHaveBeenCalledWith('a@b.com', '424242');
  });

  it('verify-code returns 200 on the right code, 401 otherwise', async () => {
    const h = build();
    await h.sendCode({ email: 'a@b.com' });
    expect((await h.verifyCode({ email: 'a@b.com', code: '000000' })).status).toBe(401);
    expect((await h.verifyCode({ email: 'a@b.com', code: '424242' })).status).toBe(200);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/server/handlers.test.ts`
Expected: FAIL — cannot resolve `@server/auth/handlers`.

- [ ] **Step 4: Implement `server/auth/handlers.ts`**

```ts
import { makeCodeService } from './codeService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SendEmail {
  (to: string, code: string): Promise<void>;
}

export function makeHandlers(deps: {
  service: ReturnType<typeof makeCodeService>;
  sendEmail: SendEmail;
}) {
  return {
    async sendCode(body: { email?: string }) {
      const email = (body.email ?? '').trim();
      if (!EMAIL_RE.test(email)) return { status: 400, body: { error: 'Enter a valid email.' } };
      const code = await deps.service.issue(email);
      await deps.sendEmail(email, code);
      return { status: 200, body: { ok: true } };
    },
    async verifyCode(body: { email?: string; code?: string }) {
      const email = (body.email ?? '').trim();
      const code = (body.code ?? '').trim();
      if (!EMAIL_RE.test(email) || code.length !== 6) {
        return { status: 400, body: { error: 'Enter the 6-digit code.' } };
      }
      const result = await deps.service.check(email, code);
      if (result.ok) return { status: 200, body: { ok: true } };
      const messages: Record<string, string> = {
        expired: 'Code expired — resend a new one.',
        'too-many': 'Too many attempts. Resend a new code.',
        mismatch: "That code doesn't look right.",
        missing: 'No code pending — resend one.',
      };
      return { status: 401, body: { error: messages[result.reason] } };
    },
  };
}
```

- [ ] **Step 5: Implement `server/auth/email.ts`** (real Resend send)

```ts
import { Resend } from 'resend';
import type { SendEmail } from './handlers';

/** Real Resend-backed sender. Requires RESEND_API_KEY + RESEND_FROM. */
export const resendSendEmail: SendEmail = async (to, code) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: 'Your Cairn verification code',
    html: `<div style="font-family:Figtree,Arial,sans-serif;color:#1a1a1a">
      <p>Your Cairn verification code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
      <p style="color:#77776a">It expires in 10 minutes. If you didn't ask for this, ignore this email.</p>
    </div>`,
  });
};
```

- [ ] **Step 6: Implement `server/auth/firestoreStore.ts`** (default production store)

```ts
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { CodeStore, CodeRecord } from './store';

function db() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) });
  }
  return getFirestore();
}

/** Firestore-backed CodeStore. Collection: `authCodes`, doc id = email. */
export class FirestoreCodeStore implements CodeStore {
  async set(email: string, rec: CodeRecord) { await db().collection('authCodes').doc(email).set(rec); }
  async get(email: string) {
    const snap = await db().collection('authCodes').doc(email).get();
    return snap.exists ? (snap.data() as CodeRecord) : null;
  }
  async delete(email: string) { await db().collection('authCodes').doc(email).delete(); }
}
```

- [ ] **Step 7: Implement the Vercel adapters**

`api/auth/send-code.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeCodeService } from '../../server/auth/codeService';
import { FirestoreCodeStore } from '../../server/auth/firestoreStore';
import { makeHandlers } from '../../server/auth/handlers';
import { resendSendEmail } from '../../server/auth/email';

const handlers = makeHandlers({
  service: makeCodeService(new FirestoreCodeStore()),
  sendEmail: resendSendEmail,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { status, body } = await handlers.sendCode(req.body ?? {});
  res.status(status).json(body);
}
```

`api/auth/verify-code.ts` (identical shape, calls `handlers.verifyCode`):

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeCodeService } from '../../server/auth/codeService';
import { FirestoreCodeStore } from '../../server/auth/firestoreStore';
import { makeHandlers } from '../../server/auth/handlers';
import { resendSendEmail } from '../../server/auth/email';

const handlers = makeHandlers({
  service: makeCodeService(new FirestoreCodeStore()),
  sendEmail: resendSendEmail,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { status, body } = await handlers.verifyCode(req.body ?? {});
  res.status(status).json(body);
}
```

- [ ] **Step 8: Exclude `api/` and `server/` from the Vite client build**

Confirm `vite.config.ts` `build.rollupOptions.input` still lists only `app` and `landing` (it does) — the `api/` functions are built by the host, not Vite. No change needed unless a glob was added; verify by running the build in Step 9.

- [ ] **Step 9: Run tests + typecheck + build**

Run: `npx vitest run tests/server/handlers.test.ts && npm run typecheck && npm run build`
Expected: tests PASS; typecheck clean; client build succeeds and does not bundle `api/`.

- [ ] **Step 10: Commit**

```bash
git add server/auth api/auth package.json package-lock.json tests/server/handlers.test.ts
git commit -m "feat(auth): Resend send + verify handlers, Firestore store, Vercel adapters"
```

---

### Task 6: Verify-code client

**Files:**
- Create: `src/auth/verifyCodeClient.ts`
- Test: `tests/auth/verifyCodeClient.test.ts`

**Interfaces:**
- Produces: `sendCode(email: string): Promise<void>` and `verifyCode(email: string, code: string): Promise<void>` — both reject with an `Error` carrying the server's message on non-2xx.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendCode, verifyCode } from '@/auth/verifyCodeClient';

beforeEach(() => vi.restoreAllMocks());

describe('verifyCodeClient', () => {
  it('POSTs to send-code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await sendCode('a@b.com');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/send-code', expect.objectContaining({ method: 'POST' }));
  });

  it('throws the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, json: async () => ({ error: "That code doesn't look right." }),
    }));
    await expect(verifyCode('a@b.com', '000000')).rejects.toThrow("That code doesn't look right.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth/verifyCodeClient.test.ts`
Expected: FAIL — cannot resolve `@/auth/verifyCodeClient`.

- [ ] **Step 3: Implement `src/auth/verifyCodeClient.ts`**

```ts
const BASE = import.meta.env.VITE_AUTH_API_BASE ?? '';

async function post(path: string, payload: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong. Try again.');
}

export function sendCode(email: string): Promise<void> {
  return post('/api/auth/send-code', { email });
}

export function verifyCode(email: string, code: string): Promise<void> {
  return post('/api/auth/verify-code', { email, code });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth/verifyCodeClient.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/verifyCodeClient.ts tests/auth/verifyCodeClient.test.ts
git commit -m "feat(auth): client for send-code / verify-code endpoints"
```

---

### Task 7: Router `auth` route

**Files:**
- Modify: `src/router.ts`
- Test: `tests/routes/router.test.ts` (create if absent)

**Interfaces:**
- Produces: `Route` gains `| { name: 'auth'; signup: boolean }`; `parseHash('#/auth')` → `{ name: 'auth', signup: false }`; `parseHash('#/auth/signup')` → `{ name: 'auth', signup: true }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { parseHash } from '@/router';

describe('parseHash auth', () => {
  it('routes #/auth', () => expect(parseHash('#/auth')).toEqual({ name: 'auth', signup: false }));
  it('routes #/auth/signup', () => expect(parseHash('#/auth/signup')).toEqual({ name: 'auth', signup: true }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/router.test.ts`
Expected: FAIL — `auth` not handled (returns overview).

- [ ] **Step 3: Implement in `src/router.ts`**

Add to the `Route` union:

```ts
  | { name: 'auth'; signup: boolean }
```

Add a case in the `switch (head)` of `parseHash`, before `default`:

```ts
    case 'auth':
      return { name: 'auth', signup: tail === 'signup' };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/routes/router.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/router.ts tests/routes/router.test.ts
git commit -m "feat(auth): add #/auth route"
```

---

### Task 8: Avatars + brand panel (static presentational pieces)

**Files:**
- Create: `src/routes/auth/avatars.tsx`
- Create: `src/routes/auth/BrandPanel.tsx`
- Create: `src/routes/auth/auth.css`
- Test: `tests/routes/auth-avatars.test.tsx`

**Interfaces:**
- Produces: `AVATARS: React.ReactElement[]` (6 entries, indexes 0–5); `<BrandPanel/>` (no props).

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATARS } from '@/routes/auth/avatars';

describe('avatars', () => {
  it('exposes exactly 6 avatar elements', () => {
    expect(AVATARS).toHaveLength(6);
    const { container } = render(<>{AVATARS}</>);
    expect(container.querySelectorAll('svg')).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/auth-avatars.test.tsx`
Expected: FAIL — cannot resolve `@/routes/auth/avatars`.

- [ ] **Step 3: Implement `src/routes/auth/avatars.tsx`**

Translate the six avatar `<svg>` blocks from **MOCKUP lines 170–186** (the `selectAvatar0..5` buttons' inner SVGs) into an array. Copy each SVG's inner markup verbatim; only convert attributes to JSX camelCase (`stroke-width` → `strokeWidth`, `clip-path` → `clipPath`, `stroke-linecap` → `strokeLinecap`) and give the `clipPath` id in avatar 5 a unique React-safe id.

```tsx
export const AVATARS: React.ReactElement[] = [
  // Avatar 0 — forest disc (MOCKUP line 170 inner <svg>)
  (<svg width="40" height="40" viewBox="0 0 100 100" key="a0">{/* …verbatim paths… */}</svg>),
  // Avatars 1–5 — MOCKUP lines 173, 176, 179, 182, 185 respectively.
];
```

(Fill in all six with the verbatim path data from MOCKUP; do not summarise.)

- [ ] **Step 4: Implement `src/routes/auth/BrandPanel.tsx`**

Translate the left dark panel — **MOCKUP lines 42–64** (beta badge, "Set your stack in stone" headline with the lavender squiggle, the stacked-stones illustration `<svg>`, the tagline, the © line) — into a `<BrandPanel/>` component. Move inline styles to classes in `auth.css` where practical; keep SVG markup verbatim (JSX-cased).

- [ ] **Step 5: Seed `src/routes/auth/auth.css`**

Create the file with the page shell classes used by BrandPanel and (later) the card — `.cairn-noise` background (MOCKUP line 17), `.auth-page`, `.auth-brand`, `.auth-card`, the `@keyframes cairn-spin` (MOCKUP line 18). Use the palette from Global Constraints.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/routes/auth-avatars.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/auth/avatars.tsx src/routes/auth/BrandPanel.tsx src/routes/auth/auth.css tests/routes/auth-avatars.test.tsx
git commit -m "feat(auth): avatar set + brand panel + page styles"
```

---

### Task 9: AuthForm (login/signup) subcomponent

**Files:**
- Create: `src/routes/auth/AuthForm.tsx`
- Test: `tests/routes/auth-form.test.tsx`

**Interfaces:**
- Consumes: nothing external (pure presentational + local validation).
- Produces:
```tsx
interface AuthFormProps {
  mode: 'login' | 'signup';
  onModeChange(m: 'login' | 'signup'): void;
  onSubmit(v: { name: string; email: string; password: string }): void;
  onGoogle(): void;
  onMagicLink(email: string): void;
  onForgot(): void;
  pending?: boolean;
  serverError?: string;   // rendered under the password field
}
export function AuthForm(props: AuthFormProps): JSX.Element;
```

Validation and the Pebble→Stone→Boulder→Bedrock strength meter replicate **MOCKUP lines 317–347 (`onPasswordInput`, `submitAuth` validation)** and the meter markup at **MOCKUP lines 266–274**; strength colors/labels from **MOCKUP lines 411–412** verbatim. The OAuth column has **only the Google button** (MOCKUP lines 232–235) — no Apple. Copy for headline/subhead/labels from **MOCKUP lines 506–511**.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/routes/auth/AuthForm';

function setup(mode: 'login' | 'signup' = 'login') {
  const props = {
    mode, onModeChange: vi.fn(), onSubmit: vi.fn(), onGoogle: vi.fn(),
    onMagicLink: vi.fn(), onForgot: vi.fn(),
  };
  render(<AuthForm {...props} />);
  return props;
}

describe('AuthForm', () => {
  it('shows the login headline and hides the Name field', () => {
    setup('login');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('reveals the Name field and strength meter in signup', () => {
    setup('signup');
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('blocks submit with an invalid email', async () => {
    const p = setup('login');
    await userEvent.type(screen.getByLabelText('Email'), 'nope');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(p.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  it('submits valid credentials', async () => {
    const p = setup('login');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(p.onSubmit).toHaveBeenCalledWith({ name: '', email: 'a@b.com', password: 'secret1' });
  });

  it('renders only Google (no Apple) in the OAuth row', () => {
    setup('login');
    expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/auth-form.test.tsx`
Expected: FAIL — cannot resolve `@/routes/auth/AuthForm`.

- [ ] **Step 3: Implement `src/routes/auth/AuthForm.tsx`**

Build the tabs row (MOCKUP 71–74), Google button (232–235), the "or" divider (238–242), the form fields with `<label htmlFor>` wiring so `getByLabelText` works, inline validation (email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, password required, signup name required + password ≥ 6), the strength meter (signup only), the primary CTA (label from 508), and the magic-link text button (283). "Forgot?" link (login only, 260–262) calls `onForgot`. The magic-link button calls `onMagicLink(email)` using the current email value. No demo hint line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/routes/auth-form.test.tsx`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth/AuthForm.tsx tests/routes/auth-form.test.tsx
git commit -m "feat(auth): login/signup form with validation + strength meter"
```

---

### Task 10: VerifyCode subcomponent

**Files:**
- Create: `src/routes/auth/VerifyCode.tsx`
- Test: `tests/routes/auth-verify.test.tsx`

**Interfaces:**
- Produces:
```tsx
interface VerifyCodeProps {
  email: string;
  onSubmit(code: string): void;   // called with the 6-char joined code
  onResend(): void;
  onBack(): void;
  pending?: boolean;
  error?: string;
}
export function VerifyCode(props: VerifyCodeProps): JSX.Element;
```

Markup from **MOCKUP lines 196–226** (stone icon, "Check your email", the six inputs with alternating radii, error line, Verify button, resend link) — **minus** the "Demo code: 123456" line (MOCKUP 221), which must not ship. The six boxes auto-advance on input and accept a 6-digit paste into the first box.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VerifyCode } from '@/routes/auth/VerifyCode';

describe('VerifyCode', () => {
  it('shows the target email and no demo hint', () => {
    render(<VerifyCode email="a@b.com" onSubmit={vi.fn()} onResend={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument();
  });

  it('submits the joined 6-digit code', async () => {
    const onSubmit = vi.fn();
    render(<VerifyCode email="a@b.com" onSubmit={onSubmit} onResend={vi.fn()} onBack={vi.fn()} />);
    const boxes = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) await userEvent.type(boxes[i], String(i + 1));
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/auth-verify.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/routes/auth/VerifyCode.tsx`**

Six controlled single-char inputs (state `string[6]`), auto-focus next on entry, backspace to previous, paste splits across boxes; "Verify email" joins and calls `onSubmit`; "Resend code" calls `onResend`; back link calls `onBack`. Render `error` when present (style from MOCKUP 218–220).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/routes/auth-verify.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth/VerifyCode.tsx tests/routes/auth-verify.test.tsx
git commit -m "feat(auth): 6-digit verify-code entry"
```

---

### Task 11: Onboarding subcomponent

**Files:**
- Create: `src/routes/auth/Onboarding.tsx`
- Test: `tests/routes/auth-onboarding.test.tsx`

**Interfaces:**
- Consumes: `AVATARS` (Task 8).
- Produces:
```tsx
interface OnboardingProps { onFinish(v: { avatarIndex: number; displayName: string }): void; pending?: boolean; }
export function Onboarding(props: OnboardingProps): JSX.Element;
```

Markup from **MOCKUP lines 163–195** (heading "Make it yours", 3-col avatar grid with selection ring `4px 4px 0 #1a1a1a` + `translate(-2px,-2px)` from MOCKUP 423–427, display-name input, "Finish setup").

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from '@/routes/auth/Onboarding';

describe('Onboarding', () => {
  it('finishes with the chosen avatar and name', async () => {
    const onFinish = vi.fn();
    render(<Onboarding onFinish={onFinish} />);
    const avatarButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg'));
    await userEvent.click(avatarButtons[2]);
    await userEvent.type(screen.getByLabelText('Display name'), 'Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(onFinish).toHaveBeenCalledWith({ avatarIndex: 2, displayName: 'Ada' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/auth-onboarding.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/routes/auth/Onboarding.tsx`**

Local state `avatar` (default 0) and the display-name input; the 6 avatar buttons render `AVATARS[i]` and show the selection ring when active; "Finish setup" calls `onFinish({ avatarIndex, displayName })` (default name `'friend'` if blank, matching MOCKUP 373).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/routes/auth-onboarding.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth/Onboarding.tsx tests/routes/auth-onboarding.test.tsx
git commit -m "feat(auth): avatar + display-name onboarding"
```

---

### Task 12: Outcome screens (welcome / welcomeBack / magicLinkSent / forgot / googleConnecting)

**Files:**
- Create: `src/routes/auth/Outcome.tsx`
- Test: `tests/routes/auth-outcome.test.tsx`

**Interfaces:**
- Produces separate small components sharing `auth.css`:
```tsx
export function Welcome(p: { name: string; onEnter(): void }): JSX.Element;       // MOCKUP 145–162
export function WelcomeBack(p: { name: string; onEnter(): void }): JSX.Element;   // MOCKUP 131–144
export function MagicLinkSent(p: { email: string; onBack(): void }): JSX.Element; // MOCKUP 118–130
export function GoogleConnecting(): JSX.Element;                                  // MOCKUP 111–117
export function Forgot(p: {                                                       // MOCKUP 78–110
  sent: boolean; sentEmail: string; onSubmit(email: string): void; onBack(): void; pending?: boolean; error?: string;
}): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Welcome, WelcomeBack, MagicLinkSent, GoogleConnecting, Forgot } from '@/routes/auth/Outcome';

describe('Outcome screens', () => {
  it('Welcome greets by name and enters', async () => {
    const onEnter = vi.fn();
    render(<Welcome name="Ada" onEnter={onEnter} />);
    expect(screen.getByText(/Welcome, Ada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enter Cairn' }));
    expect(onEnter).toHaveBeenCalled();
  });

  it('WelcomeBack greets returning users', () => {
    render(<WelcomeBack name="Ada" onEnter={vi.fn()} />);
    expect(screen.getByText(/Welcome back, Ada/)).toBeInTheDocument();
  });

  it('MagicLinkSent shows the target email', () => {
    render(<MagicLinkSent email="a@b.com" onBack={vi.fn()} />);
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('GoogleConnecting shows the connecting copy', () => {
    render(<GoogleConnecting />);
    expect(screen.getByText(/Connecting to Google/)).toBeInTheDocument();
  });

  it('Forgot validates then submits, and shows the sent state', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Forgot sent={false} sentEmail="" onSubmit={onSubmit} onBack={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(onSubmit).toHaveBeenCalledWith('a@b.com');
    rerender(<Forgot sent sentEmail="a@b.com" onSubmit={onSubmit} onBack={vi.fn()} />);
    expect(screen.getByText(/Trail marked/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/auth-outcome.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/routes/auth/Outcome.tsx`**

Translate each screen's markup from the cited MOCKUP line ranges. `Forgot` holds a local email input, validates with the shared email regex, and calls `onSubmit(email)`; when `sent` is true it renders the "Trail marked." confirmation (MOCKUP 81–92). `GoogleConnecting` uses the `cairn-spin` keyframe from `auth.css`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/routes/auth-outcome.test.tsx`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth/Outcome.tsx tests/routes/auth-outcome.test.tsx
git commit -m "feat(auth): welcome / magic-link / google / forgot outcome screens"
```

---

### Task 13: Auth page state machine + dev nav + wiring

**Files:**
- Create: `src/routes/Auth.tsx`
- Create: `src/routes/auth/DevStateNav.tsx`
- Modify: `src/App.tsx` (render `<Auth/>` full-bleed for `route.name === 'auth'`)
- Test: `tests/routes/Auth.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 3), `sendCode`/`verifyCode` (Task 6), `AuthForm` (9), `VerifyCode` (10), `Onboarding` (11), `Outcome` screens (12), `BrandPanel` (8), `navigate` from `@/router`.
- Produces: `export function Auth({ signup }: { signup: boolean }): JSX.Element;`

**State machine** (mirrors MOCKUP `mode`): `login | signup | verify | onboarding | welcome | welcomeBack | forgot | googleConnecting | magicLinkSent`. Transitions per the §3 diagram. `signup` prop preselects the `signup` tab. "Enter Cairn" calls `navigate('#/')`. Real wiring:
- `AuthForm.onSubmit` (login) → `signInWithEmail` → on success `welcomeBack`; on throw set `serverError`.
- `AuthForm.onSubmit` (signup) → `registerWithEmail` → on success `sendCode(email)` then `verify`.
- `AuthForm.onGoogle` → `googleConnecting` → `signInWithGoogle()` → `welcomeBack` (or back to form with error).
- `AuthForm.onMagicLink` → `sendMagicLink(email)` → `magicLinkSent`.
- `AuthForm.onForgot` → `forgot`.
- `VerifyCode.onSubmit(code)` → `verifyCode(email, code)` → `onboarding`; on throw set code error. `onResend` → `sendCode(email)`.
- `Onboarding.onFinish` → `saveOnboarding(avatarIndex, name)` → `welcome`.
- `Forgot.onSubmit(email)` → `sendPasswordReset(email)` → sent state.

- [ ] **Step 1: Write the failing test** (Firebase + code client mocked)

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const authApi = vi.hoisted(() => ({
  signInWithEmail: vi.fn(), registerWithEmail: vi.fn(), signInWithGoogle: vi.fn(),
  sendMagicLink: vi.fn(), sendPasswordReset: vi.fn(), saveOnboarding: vi.fn(),
  completeMagicLinkSignIn: vi.fn().mockResolvedValue(false), signOutUser: vi.fn(),
  user: null, loading: false,
}));
vi.mock('@/auth/useAuth', () => ({ useAuth: () => authApi, AuthProvider: ({ children }: any) => children }));
const codeApi = vi.hoisted(() => ({ sendCode: vi.fn().mockResolvedValue(undefined), verifyCode: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/auth/verifyCodeClient', () => codeApi);

import { Auth } from '@/routes/Auth';

beforeEach(() => vi.clearAllMocks());

describe('Auth page', () => {
  it('signup → verify: registers then sends a code', async () => {
    authApi.registerWithEmail.mockResolvedValue(undefined);
    render(<Auth signup />);
    await userEvent.type(screen.getByLabelText('Name'), 'Ada');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(authApi.registerWithEmail).toHaveBeenCalledWith('Ada', 'a@b.com', 'secret1'));
    await waitFor(() => expect(codeApi.sendCode).toHaveBeenCalledWith('a@b.com'));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  });

  it('login failure keeps the form and shows the message', async () => {
    authApi.signInWithEmail.mockRejectedValue(new Error('Incorrect email or password.'));
    render(<Auth signup={false} />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope12');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });

  it('dev nav jumps directly to onboarding', async () => {
    render(<Auth signup={false} />);
    // DevStateNav renders in test (import.meta.env.DEV is true under vitest).
    await userEvent.click(screen.getByRole('button', { name: 'onboarding' }));
    expect(screen.getByRole('heading', { name: 'Make it yours' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/Auth.test.tsx`
Expected: FAIL — cannot resolve `@/routes/Auth`.

- [ ] **Step 3: Implement `src/routes/auth/DevStateNav.tsx`**

```tsx
const STATES = ['login','signup','verify','onboarding','welcome','welcomeBack','forgot','googleConnecting','magicLinkSent'] as const;
export type AuthMode = typeof STATES[number];

/** Dev-only jump bar. Guarded by import.meta.env.DEV so prod tree-shakes it. */
export function DevStateNav({ onPick }: { onPick(m: AuthMode): void }) {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="auth-devnav" aria-label="Dev state navigator">
      {STATES.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)}>{s}</button>
      ))}
    </div>
  );
}
```

Add `.auth-devnav` styling to `auth.css` (fixed bottom-left pill, small text).

- [ ] **Step 4: Implement `src/routes/Auth.tsx`**

Build the page shell (`.cairn-noise` wrapper, corner logo lockup from MOCKUP 30–38, the two-card row), hold `mode` state (seed from the `signup` prop), the 160 ms cross-fade wrapper, the email/name kept in page state so verify/magic-link/welcome can display them, and wire every callback to the mocked-in-real APIs per the interface list above. Render `<DevStateNav onPick={setMode}/>`. On mount, call `completeMagicLinkSignIn()`; if it resolves `true`, go to `welcomeBack`. Guard async handlers with a `pending` flag.

- [ ] **Step 5: Wire the route in `src/App.tsx`**

At the top of `AppInner`'s render (before the `AppShell` return, e.g. right after `const route = useRoute();`), add:

```tsx
  if (route.name === 'auth') return <Auth signup={route.signup} />;
```

Add `import { Auth } from '@/routes/Auth';` to the imports. The auth page renders full-bleed, outside `AppShell`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/routes/Auth.test.tsx`
Expected: PASS (all 3).

- [ ] **Step 7: Typecheck + full test run**

Run: `npm run typecheck && npx vitest run`
Expected: clean typecheck; whole suite green.

- [ ] **Step 8: Commit**

```bash
git add src/routes/Auth.tsx src/routes/auth/DevStateNav.tsx src/routes/auth/auth.css src/App.tsx tests/routes/Auth.test.tsx
git commit -m "feat(auth): auth page state machine, dev nav, app route wiring"
```

---

### Task 14: Landing topbar entry point

**Files:**
- Modify: `landing/sections/topbar/topbar.html`
- Modify: `landing/sections/topbar/topbar.css` (button spacing if needed)
- Test: `tests/integration/landing-topbar.test.ts` (create)

**Interfaces:**
- Produces: topbar contains a "Log in" link to `/#/auth` and a "Sign up" CTA to `/#/auth/signup`.

- [ ] **Step 1: Write the failing test**

The landing HTML is a static fragment; assert against its text with a DOM parse.

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('landing/sections/topbar/topbar.html', 'utf8');

describe('landing topbar auth entry', () => {
  it('links Log in to the auth route', () => {
    expect(html).toMatch(/href="\/#\/auth"/);
    expect(html).toMatch(/Log in/);
  });
  it('links Sign up to the signup route', () => {
    expect(html).toMatch(/href="\/#\/auth\/signup"/);
    expect(html).toMatch(/Sign up/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/landing-topbar.test.ts`
Expected: FAIL — current topbar has only "Open the app".

- [ ] **Step 3: Edit `landing/sections/topbar/topbar.html`**

Replace the single CTA line (`<a class="btn-primary topbar-cta" href="/">Open…</a>`) with a Log in link + a Sign up CTA:

```html
        <a class="topnav-link" href="/#/auth">Log in</a>
        <a class="btn-primary topbar-cta" href="/#/auth/signup">Sign up</a>
```

Keep the theme-toggle button and the `topnav-rule` as they are.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/landing-topbar.test.ts`
Expected: PASS.

- [ ] **Step 5: Adjust `topbar.css` if the two controls need spacing**

If the Log in link and Sign up CTA crowd, add a small gap rule; otherwise leave unchanged. Verify visually in Task 15.

- [ ] **Step 6: Commit**

```bash
git add landing/sections/topbar/topbar.html landing/sections/topbar/topbar.css tests/integration/landing-topbar.test.ts
git commit -m "feat(landing): topbar Log in + Sign up entry points"
```

---

### Task 15: Integration pass — build, manual smoke, "continue without an account"

**Files:**
- Modify: `src/routes/Auth.tsx` (add the "Continue without an account →" link — review flag F2)
- Test: `tests/routes/Auth.test.tsx` (add one case)

- [ ] **Step 1: Add the failing test case**

```tsx
  it('offers an escape hatch to the app without an account', async () => {
    const nav = await import('@/router');
    const spy = vi.spyOn(nav, 'navigate').mockImplementation(() => {});
    render(<Auth signup={false} />);
    await userEvent.click(screen.getByRole('link', { name: /Continue without an account/ }));
    expect(spy).toHaveBeenCalledWith('#/');
  });
```

(If `navigate` is used via named import, expose the escape hatch as a real `<a href="/#/">` and instead assert its `href`; adjust the test to `expect(link).toHaveAttribute('href', '/#/')`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/routes/Auth.test.tsx`
Expected: FAIL — no such link yet.

- [ ] **Step 3: Add the link to `src/routes/Auth.tsx`**

Under the auth card's Terms/Privacy line, add a small `<a class="auth-skip" href="/#/">Continue without an account →</a>`. Style `.auth-skip` in `auth.css` (fog color, 13px, underline on hover).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/routes/Auth.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck clean; full suite green; both `app` and `landing` build.

- [ ] **Step 6: Manual smoke (dev server)**

Run: `npm run dev`, then in the browser:
1. `/#/auth` renders the login card; the dev nav pill is visible; click through all 9 states.
2. `/landing/` topbar shows "Log in" + "Sign up"; both navigate to `/#/auth` and `/#/auth/signup`.
3. Confirm no console references to `demo@cairn.app` / `123456`.

(Firebase/Resend calls will error until keys are wired — expected. The dev nav still lets every screen be inspected.)

- [ ] **Step 7: Commit**

```bash
git add src/routes/Auth.tsx src/routes/auth/auth.css tests/routes/Auth.test.tsx
git commit -m "feat(auth): continue-without-account escape hatch + integration pass"
```

---

## Post-plan wiring (owner: user, tracked in spec §7)

Not implementation tasks — done together after the build:
1. Create the Firebase project; enable Email/Password, Google, Email-link; set authorized domains; paste `VITE_FIREBASE_*` into `.env`.
2. Resend: `RESEND_API_KEY` + verified `RESEND_FROM`.
3. Deploy `api/auth/*` to the chosen host (default Vercel) with `FIREBASE_SERVICE_ACCOUNT` for the Firestore store; set `VITE_AUTH_API_BASE` if the backend is a different origin.
4. Confirm review flags F1 (light-only) and F2 (escape hatch) in the running app.

## Self-review notes

- **Spec coverage:** landing entry (T14), 9-state page (T8–T13), Firebase methods (T3), Resend 6-digit backend (T4–T6), dev nav (T13), errors (T2), tests each task, escape hatch/theme flags (T13/T15). All spec §3–§8 items map to a task.
- **Type consistency:** `CodeStore`/`CodeRecord` (T4) reused verbatim in T5; `makeHandlers` deps type references T4's `makeCodeService`; `AuthMode` (T13) is the single source for the mode union; `sendCode`/`verifyCode` signatures identical across T6 and T13.
- **No demo scaffolding** asserted negatively in T10 and T15 tests.
