export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function relativePosition(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
  return {
    x: clamp((clientX - rect.left) / rect.width),
    y: clamp((clientY - rect.top) / rect.height),
  };
}

/**
 * Pointer-tracked highlight on the hero recreation. Writes --x/--y (percentages)
 * that a ::before radial-gradient follows. Desktop-pointer + motion gated by the
 * caller; a no-op when disabled so touch/reduced-motion never wire listeners.
 */
export function setupCursorLight(el: HTMLElement, opts: { enabled: boolean }): void {
  if (!opts.enabled) return;
  el.addEventListener('pointermove', (e) => {
    const p = relativePosition(el.getBoundingClientRect(), e.clientX, e.clientY);
    el.style.setProperty('--x', `${(p.x * 100).toFixed(2)}%`);
    el.style.setProperty('--y', `${(p.y * 100).toFixed(2)}%`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.removeProperty('--x');
    el.style.removeProperty('--y');
  });
}
