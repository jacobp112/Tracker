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
