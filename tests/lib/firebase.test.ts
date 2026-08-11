import { describe, expect, it } from 'vitest';

describe('firebase client', () => {
  it('exports an auth instance and a google provider', async () => {
    const mod = await import('@/lib/firebase');
    expect(mod.auth).toBeDefined();
    expect(mod.googleProvider).toBeDefined();
    expect(mod.googleProvider.providerId).toBe('google.com');
  });
});
