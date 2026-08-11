import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sendCode, verifyCode } from '@/auth/verifyCodeClient';

beforeEach(() => vi.restoreAllMocks());

describe('verifyCodeClient', () => {
  it('POSTs to send-code', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await sendCode('a@b.com');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/send-code', expect.objectContaining({ method: 'POST' }));
  });

  it('throws the server error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, json: async () => ({ error: "That code doesn't look right." }),
    }));
    await expect(verifyCode('a@b.com', '000000')).rejects.toThrow("That code doesn't look right.");
  });
});
