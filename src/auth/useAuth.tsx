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
