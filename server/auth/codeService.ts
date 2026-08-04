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
