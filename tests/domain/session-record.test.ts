import { describe, expect, it } from 'vitest';
import { emptyStore } from '@/domain/types';
import { STORE_KEY } from '@/core/storage';

describe('Store.sessions migration', () => {
  it('emptyStore starts with an empty sessions array', () => {
    expect(emptyStore().sessions).toEqual([]);
  });

  it('a persisted store missing `sessions` loads as []', async () => {
    localStorage.clear();
    // A legacy store shape without `sessions`.
    localStorage.setItem(STORE_KEY, JSON.stringify({ schema_version: '3.0.0', courses: [], exams: [] }));
    const { loadStore } = await import('@/core/storage');
    expect(loadStore().sessions).toEqual([]);
    localStorage.clear();
  });
});
