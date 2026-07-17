import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getInitialTheme, getStoredTheme, type Theme } from './theme';

/**
 * Owns the live theme. Initialised from what the pre-paint script resolved
 * (Document 3 §2.3) rather than re-deriving it, so there is no flash.
 */
export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const set = useCallback((next: Theme) => {
    setTheme(next);
    applyTheme(next);
  }, []);

  const toggle = useCallback(() => {
    set(theme === 'dark' ? 'light' : 'dark');
  }, [theme, set]);

  // Follow the OS only while the user has no explicit preference of their own.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (getStoredTheme() === null) {
        const next: Theme = e.matches ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return { theme, toggle, set };
}
