import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './clipboard';

afterEach(() => vi.restoreAllMocks());

describe('copyText', () => {
  it('uses the async clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const ok = await copyText('hello', { clipboard: { writeText } as unknown as Clipboard });
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(ok).toBe(true);
  });

  it('falls back to execCommand when clipboard is missing', async () => {
    const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const ok = await copyText('hi', {} as Pick<Navigator, 'clipboard'>);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
  });

  it('falls back when the async clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    const exec = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    const ok = await copyText('x', { clipboard: { writeText } as unknown as Clipboard });
    expect(exec).toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it('returns false when both paths fail', async () => {
    vi.spyOn(document, 'execCommand').mockReturnValue(false);
    const ok = await copyText('x', {} as Pick<Navigator, 'clipboard'>);
    expect(ok).toBe(false);
  });
});
