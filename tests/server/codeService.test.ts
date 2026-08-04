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
