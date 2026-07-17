import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

/**
 * jsdom does not implement matchMedia, but the app queries it for theme
 * (Doc 3 §2.3) and reduced motion (§2.6). Stub it as "no preference" — tests
 * that care about a specific preference override this per-case via setMedia().
 */
const listeners = new Set<(e: MediaQueryListEvent) => void>();

export function setMedia(matches: Record<string, boolean>) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/**
 * jsdom does not implement scrollIntoView. The command palette calls it to keep
 * the active row in view while arrowing. Nothing reads a result from it, so a
 * no-op is a faithful stand-in rather than a behaviour change.
 */
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  listeners.clear();
  setMedia({});
  // The pre-paint script in index.html normally sets this; tests mount React
  // directly, so stand it in here.
  document.documentElement.setAttribute('data-theme', 'light');
});
