# Cairn Auth — login / register flow

**Date:** 2026-08-04
**Status:** Design — awaiting review
**Branch:** redesign/wispr-flow-landing

## 1. Summary

Add a real authentication experience to Cairn: a login/register entry point on
the static landing page, and a full multi-state auth page (rebuilt faithfully
from the `Cairn Login.dc.html` handoff mockup) wired to **Firebase Auth** for
everything except the 6-digit email verification code, which is powered by
**Resend** through a small serverless backend.

Login is an **opt-in layer** — the tracker still works fully signed-out. Nothing
consumes the account yet (no cloud data sync); that is a deliberate future
project. This spec covers the button, the page, and wiring every action to a
real backend seam.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Auth provider | **Firebase Auth** (client SDK) |
| Sign-in methods | Email+password, **Google** OAuth, magic link, password reset |
| Apple OAuth | **Dropped** (mockup no longer renders it) |
| Account required? | **No** — optional, opt-in. App works signed-out. |
| 6-digit verify code | **Real**, via **Resend** + serverless backend |
| Demo scaffolding | Removed (`demo@cairn.app`, code `123456` are prototype-only) |
| Where login page lives | **React route** in the app (`#/auth`), not a static page |
| Dev page navigator | Yes — dev-only switcher to jump between all auth states |
| Credential wiring | User supplies keys/host **after** build; code built real against seams |

## 3. The auth state machine (from the mockup)

The auth page is a single card that swaps between **9 states**, driven by an
internal `mode`. Faithful to the mockup, including the 160 ms cross-fade, the
scrapbook styling (card rotations, hard offset shadows `5px 5px 0 #1a1a1a`,
mixed corner radii, noise texture), and all copy.

```
                         ┌─────────── forgot ──────────┐
                         │  (form → "Trail marked.")   │
login ──Forgot?─────────▶└─────────────────────────────┘
  │  ▲                         (Send reset link = real)
  │  └───────────────────────────────────────────────┐
  ├─ Log in (email/pw) ─────────────▶ welcomeBack ────┤ "Enter Cairn" → app
  ├─ Continue with Google ─▶ googleConnecting ─▶ welcomeBack
  └─ Send magic link ──────▶ magicLinkSent  (link completes sign-in on return)

signup ─ Create account ─▶ verify (6-digit) ─▶ onboarding ─▶ welcome ─"Enter Cairn"→ app
                              (Resend code)     (avatar+name)
```

**State inventory**

| `mode` | Screen | Real action wired |
|---|---|---|
| `login` | Auth form (login variant) | `signInWithEmailAndPassword` |
| `signup` | Auth form (signup variant: Name field, pw-strength meter) | `createUserWithEmailAndPassword` + `updateProfile(displayName)` |
| `verify` | 6 code boxes, "Check your email" | POST `verify-code` (Resend-issued) |
| `onboarding` | Avatar picker (6) + display name | `updateProfile({ displayName, photoURL })` |
| `welcome` | "Welcome, {name}" → Enter Cairn | navigate to app |
| `welcomeBack` | "Welcome back, {name}" → Enter Cairn | navigate to app |
| `forgot` | Email form → "Trail marked." | `sendPasswordResetEmail` |
| `googleConnecting` | Spinner | transient during `signInWithPopup` |
| `magicLinkSent` | "Check your email" (magic link) | `sendSignInLinkToEmail` |

Client-side field validation (email format, password ≥ 6, required name),
inline errors, and the Pebble→Stone→Boulder→Bedrock password-strength meter are
kept exactly as the mockup computes them.

## 4. Architecture

Only the 6-digit code needs a backend. Everything else is client-only Firebase.

```
┌─────────────────────────── browser (static Vite SPA) ───────────────────────┐
│  Landing (/landing/)  ──"Log in"/"Sign up"──▶  App (/)  #/auth               │
│                                                   │                          │
│                                    src/routes/Auth.tsx (9-state machine)     │
│                                                   │                          │
│                                    src/auth/useAuth  ── Firebase JS SDK ─────┼──▶ Firebase Auth
│                                       (email/pw, Google, magic link, reset,  │      (Google's servers)
│                                        updateProfile, signOut)               │
│                                                   │                          │
│                                    src/auth/verifyCodeClient ── fetch ───────┼──▶ /api/auth/*
└──────────────────────────────────────────────────────────────────────────────┘      │
                                                                                        ▼
                                            ┌──────────── serverless backend ───────────┐
                                            │ send-code  → Resend (email the code)       │
                                            │ verify-code → check code + attempts/expiry │
                                            │ CodeStore (Firestore default, injectable)  │
                                            └────────────────────────────────────────────┘
```

### 4.1 Frontend files

- `src/lib/firebase.ts` — init `app`/`auth` from `import.meta.env.VITE_FIREBASE_*`;
  export `auth`, `googleProvider`. Firebase client config is not secret (it ships
  in the bundle), but env keeps it swappable.
- `src/auth/useAuth.tsx` — `AuthProvider` + `useAuth()` hook. Owns Firebase auth
  state (`onAuthStateChanged` → `user`, `loading`) and exposes:
  `registerWithEmail`, `signInWithEmail`, `signInWithGoogle`, `sendMagicLink`,
  `completeMagicLinkSignIn` (run on app load if `isSignInWithEmailLink`),
  `sendPasswordReset`, `saveOnboarding(avatarIndex, displayName)`, `signOut`.
- `src/auth/errors.ts` — maps Firebase `auth/*` error codes to friendly copy
  (mirrors the existing `src/core/errorTranslation.ts` pattern).
- `src/auth/verifyCodeClient.ts` — `sendCode(email)` / `verifyCode(email, code)`
  thin `fetch` wrappers over the backend endpoints.
- `src/routes/Auth.tsx` — the page + state machine + cross-fade + navigation on
  "Enter Cairn". Composes presentational subcomponents:
  - `src/routes/auth/BrandPanel.tsx` — left dark marketing panel (static).
  - `src/routes/auth/AuthForm.tsx` — login/signup form (tabs, OAuth, validation,
    pw meter).
  - `src/routes/auth/VerifyCode.tsx` — 6-box code entry (auto-advance/paste).
  - `src/routes/auth/Onboarding.tsx` — avatar grid + display name.
  - `src/routes/auth/Outcome.tsx` — `welcome` / `welcomeBack` / `magicLinkSent` /
    `forgot` / `googleConnecting` result screens (data-driven, one component).
  - `src/routes/auth/avatars.tsx` — the 6 inline SVG avatars, indexable.
  - `src/routes/auth/DevStateNav.tsx` — **dev-only** state switcher (§4.4).
- `src/routes/auth/auth.css` — scoped scrapbook styles translated from the
  mockup's inline styles.

Router: add `{ name: 'auth' }` to `Route` and `parseHash` (`#/auth`, optional
`#/auth/signup` to preselect signup). `AuthProvider` wraps the app in
`src/main.tsx`.

**Note on styling divergence:** the auth page intentionally uses hard offset
shadows and card rotations — the *opposite* of the landing's shadowless
editorial rule. This is a deliberate, self-contained page treatment from the
chosen mockup, not a violation of the landing system.

**Theme:** the mockup is light-only (cream). The auth page ships light-only to
stay faithful; it does not react to the app's dark theme. Flagged for review.

### 4.2 Backend (6-digit code via Resend)

Kept minimal and isolated. Core logic is a pure, unit-tested module; HTTP
adapters and the store are thin and swappable.

- `server/auth/codeService.ts` — **pure logic, host-agnostic:**
  `issueCode(email)` → generates a 6-digit code, stores `{hash, expiresAt,
  attempts}` (code hashed, never stored plaintext), returns the code to email;
  `checkCode(email, code)` → validates against store with **expiry (10 min)** and
  **attempt limit (5)**, single-use. Takes a `CodeStore` + `clock` by injection.
- `server/auth/store.ts` — `CodeStore` interface + `FirestoreCodeStore`
  (via `firebase-admin`, default) + `MemoryCodeStore` (tests/local dev).
- `server/auth/email.ts` — Resend send of the code email (branded template).
- `server/auth/handlers.ts` — `sendCodeHandler` / `verifyCodeHandler` as
  web-standard `(Request) => Response` functions, plus a default Node/Vercel
  adapter in `api/auth/send-code.ts` and `api/auth/verify-code.ts`.
- Rate limiting: per-email cooldown on `send-code` (e.g. 30 s) to prevent abuse.

The 6-digit step is **our** email-reachability check layered on top of Firebase
sign-up; it does not attempt to flip Firebase's own `emailVerified` flag (that
would need the Admin SDK on the account and is out of scope). On success we
proceed to onboarding.

**Server-only secrets:** `RESEND_API_KEY`, `RESEND_FROM`, Firebase **service
account** creds. Never shipped to the browser.

### 4.3 Landing integration

`landing/sections/topbar/topbar.html`: the single "Open the app" CTA becomes:

- **"Log in"** — ghost/text link → `/#/auth`
- **"Sign up"** — primary lavender CTA → `/#/auth/signup`

Because login is optional, the auth card gets one small addition beyond the
mockup: a subtle **"Continue without an account →"** link (opens the app
directly), so the local-first path is never lost. Flagged for review.

### 4.4 Dev-mode page navigator

`DevStateNav.tsx` renders **only when `import.meta.env.DEV`** (guarded so it is
tree-shaken from production builds). A small fixed-position pill lists every
`mode`; clicking sets the Auth page's state directly, so all 9 screens are
reviewable without walking the real flow or hitting the backend.

## 5. Error handling

- Firebase errors → friendly copy via `src/auth/errors.ts` (wrong password,
  email-in-use, invalid-email, too-many-requests, popup-closed, network).
- Backend `verify-code` → inline code errors ("That code doesn't look right",
  "Code expired — resend", "Too many attempts").
- All async actions show pending state on their button and are re-entrancy safe.
- Network failure to the code backend surfaces a working "Resend" affordance.

## 6. Testing

Vitest + Testing Library. **No network in tests.**

- `codeService` — issue/verify happy path, expiry, attempt-limit, single-use,
  wrong code (pure, `MemoryCodeStore` + fake clock). *Highest-value tests.*
- `useAuth` — Firebase SDK **mocked**: each method calls the right SDK fn;
  state transitions on `onAuthStateChanged`; magic-link completion path.
- `errors.ts` — code→message mapping table.
- `Auth` route — tab switch changes headline/labels; Name field reveals on
  signup; pw-strength meter buckets; dev nav jumps states; validation blocks
  submit; "Enter Cairn" navigates.
- `parseHash` — `#/auth` and `#/auth/signup`.

## 7. What you wire after build (the "real" seams)

1. **Firebase project** → paste `VITE_FIREBASE_*` into `.env` (I ship
   `.env.example`). Enable Email/Password, Google, and Email-link providers in
   the Firebase console; add authorized domains.
2. **Resend** → `RESEND_API_KEY` + a verified `RESEND_FROM` sender.
3. **Backend host** for `/api/auth/*` (default written for Vercel functions;
   swappable) + a **Firestore** (or other) `CodeStore` with service-account creds.
4. Confirm the two review flags (light-only theme; "continue without an account"
   link).

### 7.1 Pre-deploy hardening gates (REQUIRED before public deploy)

Surfaced by the final whole-branch review. These gate go-live, not the code
merge (the endpoints are inert until a host + keys are wired):

1. **Rate-limit `POST /api/auth/send-code`.** It is unauthenticated and triggers
   a paid Resend email on every valid-format address, and each `issue()`
   overwrites the prior record (resetting the attempt counter). Add a
   per-email + per-IP cooldown/throttle at the edge or in the handler before
   exposing it publicly, or it is an email-bomb / cost-abuse vector.
2. **Set a Firestore TTL policy on `authCodes.expiresAt`.** `codeService.check`
   deletes on the success and expiry paths, but abandoned/never-checked codes
   (and the expired-and-locked-out case) are never swept, so the `authCodes`
   collection grows unbounded without a TTL.

### 7.2 Design decision recorded (not a gap)

**The 6-digit code does not gate authentication.** On signup,
`registerWithEmail` creates and signs in the Firebase account *before*
`sendCode`; `verifyCode` only gates the UI transition to onboarding. Abandoning
the tab leaves a valid signed-in account. This is intentional and consistent
with the optional-login, local-first threat model (§2) — the code confirms email
reachability for the flow, it is **not** enforced email verification. If real
verification becomes required later, gate on Firebase `emailVerified` (needs the
Admin SDK) or a server-set custom claim.

## 8. Out of scope (explicit)

- Cloud sync of tracker data to the account (the next project).
- Gating the app behind login (stays optional).
- Flipping Firebase `emailVerified`; account-recovery beyond password reset.
- Rewriting landing content (separate track).
- Apple OAuth.

## 9. Open review flags

- **F1** — Auth page light-only vs theme-aware. Default: light-only (faithful).
- **F2** — "Continue without an account →" addition to the card. Default: include.
- **F3** — Backend host/store default (Vercel + Firestore). Confirm at wiring.
- **F4** — Mockup's "Terms and Privacy Policy" footer line: **omitted, won't-fix.**
  The mockup's links are dead `#` placeholders and no real legal pages exist;
  shipping dead legal links is worse than omitting. Add the line if/when real
  Terms + Privacy pages exist.
