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
