import { useEffect, useRef } from 'react';

/**
 * Mac uses ⌘K; everywhere else it's Ctrl+K. Detected once rather than per
 * render — this cannot change during a session.
 *
 * The keycap the UI draws must match the key that actually works: the shell
 * previously rendered a hardcoded "⌘K" on every platform, which told a Windows
 * user to press a key their keyboard does not have.
 */
export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

export const SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl K';

/**
 * Binds the palette shortcut globally. Both modifiers are accepted regardless
 * of platform — a Mac user on an external PC keyboard reaching for Ctrl+K
 * should not be told nothing happened.
 */
export function useCommandShortcut(onTrigger: () => void): void {
  const ref = useRef(onTrigger);
  ref.current = onTrigger;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Chrome binds Ctrl+K to the address bar; the app owns it here.
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
