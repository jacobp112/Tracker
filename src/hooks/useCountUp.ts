import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export interface UseCountUpOptions {
  /** Duration of animation in milliseconds. Default: 2000 (aligned with Sparkline DRAW_MS) */
  durationMs?: number;
  /** Initial value to count up from. Defaults to 0 on mount, or current value on target changes */
  startVal?: number;
  /** Number of decimal places to preserve (default: 0 for integers) */
  decimals?: number;
  /** Easing function mapping progress (0-1) to eased value (0-1) */
  easing?: (t: number) => number;
}

const DEFAULT_DURATION_MS = 2000;

// Ease-Out Quart: Responsively moves in the first half, then gently coasts 
// into the final figure right as the sparkline stroke lands.
const heroEasing = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Counts up to `target` on mount or target change.
 * Respects `prefers-reduced-motion` settings by returning `target` immediately.
 */
export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
): number {
  const {
    durationMs = DEFAULT_DURATION_MS,
    startVal,
    decimals = 0,
    easing = heroEasing,
  } = options;

  const reduced = useReducedMotion();

  // Lazy state init handles reduced motion and initial start values safely
  const [value, setValue] = useState(() => (reduced ? target : (startVal ?? 0)));

  // Track rendered value in a ref so target changes pick up smoothly from current state
  const valueRef = useRef(value);
  valueRef.current = value;

  // Stash easing in a ref to protect against inline function re-render loops
  const easingRef = useRef(easing);
  easingRef.current = easing;

  useEffect(() => {
    if (reduced || durationMs <= 0) {
      setValue(target);
      return;
    }

    const start = startVal ?? valueRef.current;
    const change = target - start;

    if (change === 0) {
      setValue(target);
      return;
    }

    let frameId: number;
    let startTimestamp: number | null = null;
    const factor = Math.pow(10, decimals);

    const step = (timestamp: number) => {
      if (startTimestamp === null) startTimestamp = timestamp;

      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      const easedProgress = easingRef.current(progress);

      const rawNext = start + change * easedProgress;
      const nextValue = Math.round(rawNext * factor) / factor;

      setValue(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [target, durationMs, reduced, startVal, decimals]);

  return value;
}