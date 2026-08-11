import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';

/**
 * Stub Firebase environment variables at setup time (before any test module imports).
 * The four VITE_FIREBASE_* values are non-secret and needed for Firebase client init
 * to succeed during module import. Without these stubs, getAuth(app) throws
 * FirebaseError: auth/invalid-api-key on import when .env is absent (e.g., on CI).
 */
vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app-id');

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

/**
 * jsdom does not implement document.execCommand. The landing page's clipboard
 * fallback (landing/clipboard.ts) calls it when the async Clipboard API is
 * unavailable. Provide a spy-able no-op that returns false by default — the
 * truthful jsdom behaviour — so tests can spy and drive either outcome.
 */
document.execCommand = vi.fn(() => false);

/**
 * jsdom does not implement SVGGeometryElement.getTotalLength. Sparkline's draw
 * animation reads it to seed stroke-dasharray/dashoffset; nothing renders in
 * jsdom, so a constant finite length is a faithful stand-in.
 */
(SVGElement.prototype as unknown as { getTotalLength: () => number }).getTotalLength = () => 100;

beforeEach(() => {
  listeners.clear();
  setMedia({});
  // The pre-paint script in index.html normally sets this; tests mount React
  // directly, so stand it in here.
  document.documentElement.setAttribute('data-theme', 'light');
});
