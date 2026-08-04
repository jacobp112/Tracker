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
