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
