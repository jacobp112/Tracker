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
