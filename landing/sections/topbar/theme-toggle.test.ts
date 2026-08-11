import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTheme, currentTheme, setupThemeToggle } from './theme-toggle';

const KEY = 'studyos-theme';

/** jsdom has no matchMedia. Stub one we can drive, and hand back the emitter. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const media = {
    matches,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => void listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) =>
      void listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', () => media);
  return {
    emit: (dark: boolean) =>
      listeners.forEach((fn) => fn({ matches: dark } as MediaQueryListEvent)),
    listenerCount: () => listeners.size,
  };
}

/** The event another tab's write produces. Same-tab writes never fire this. */
function storageEvent(key: string | null, newValue: string | null) {
  return new StorageEvent('storage', { key, newValue });
}

let dispose: (() => void) | null = null;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  dispose?.();
  dispose = null;
  vi.unstubAllGlobals();
});

describe('theme-toggle', () => {
  it('nextTheme flips the value', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('currentTheme reads the painted attribute, defaulting to light', () => {
    expect(currentTheme()).toBe('light');
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(currentTheme()).toBe('dark');
  });

  it('clicking the button flips data-theme and persists it', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.createElement('button');
    dispose = setupThemeToggle(btn);
    btn.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
    btn.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  // The whole reason onChange exists. If this ever regresses, the icon and the
  // accessible name go stale while the page repaints around them.
  it('onChange fires with the new theme, after the attribute is updated', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const seen: Array<[string, string | null]> = [];
    const btn = document.createElement('button');
    dispose = setupThemeToggle(btn, {
      onChange: (theme) =>
        seen.push([theme, document.documentElement.getAttribute('data-theme')]),
    });
    btn.click();
    btn.click();
    expect(seen).toEqual([
      ['dark', 'dark'],
      ['light', 'light'],
    ]);
  });

  it('a theme change in another tab applies here and repaints the button', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const onChange = vi.fn();
    dispose = setupThemeToggle(document.createElement('button'), { onChange });

    window.dispatchEvent(storageEvent(KEY, 'dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('ignores storage writes for other keys and clears', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const onChange = vi.fn();
    dispose = setupThemeToggle(document.createElement('button'), { onChange });

    window.dispatchEvent(storageEvent('unrelated-key', 'dark'));
    window.dispatchEvent(storageEvent(KEY, null));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('follows the OS only while the user has made no explicit choice', () => {
    const media = stubMatchMedia(false);
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.createElement('button');
    dispose = setupThemeToggle(btn);

    media.emit(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // An explicit click writes storage, and from then on the OS is outranked.
    btn.click();
    expect(localStorage.getItem(KEY)).toBe('light');
    media.emit(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('teardown detaches every listener, including the window-level ones', () => {
    const media = stubMatchMedia(false);
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.createElement('button');
    const onChange = vi.fn();

    setupThemeToggle(btn, { onChange })();

    btn.click();
    window.dispatchEvent(storageEvent(KEY, 'dark'));
    media.emit(true);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(onChange).not.toHaveBeenCalled();
    expect(media.listenerCount()).toBe(0);
  });
});