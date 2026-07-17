import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

const DEFAULT_DURATION_MS = 900;

/**
 * Counts up to `target` on mount (Document 3 §5.2 — the hero number).
 *
 * Under reduced motion this returns the final value immediately rather than
 * animating: the requirement is that motion stops, not that the number is
 * withheld (Document 3 §2.6).
 */
export function useCountUp(target: number, durationMs = DEFAULT_DURATION_MS): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const frame = useRef<number>();

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }

    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (p < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs, reduced]);

  return value;
}
