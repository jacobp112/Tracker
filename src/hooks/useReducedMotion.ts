import { useEffect, useState } from 'react';

/**
 * Tracks `prefers-reduced-motion`. Document 3 §2.6 makes honouring it a hard
 * requirement, and §6 adds the constraint that it must never leave content
 * hidden — so every caller uses this to jump to the *final* state, not to skip
 * rendering.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
