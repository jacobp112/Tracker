import { describe, it, expect, vi } from 'vitest';
import { lerp, relativePosition, setupCursorLight } from './cursor-light';

describe('cursor-light math', () => {
  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it('relativePosition returns clamped 0..1 fractions', () => {
    const r = { left: 100, top: 100, width: 200, height: 200 };
    expect(relativePosition(r, 200, 200)).toEqual({ x: 0.5, y: 0.5 });
    expect(relativePosition(r, 0, 0)).toEqual({ x: 0, y: 0 });      // clamped
    expect(relativePosition(r, 999, 999)).toEqual({ x: 1, y: 1 });  // clamped
  });
});

describe('setupCursorLight', () => {
  it('does nothing when disabled', () => {
    const el = document.createElement('div');
    const add = vi.spyOn(el, 'addEventListener');
    setupCursorLight(el, { enabled: false });
    expect(add).not.toHaveBeenCalled();
  });
  it('listens for pointermove when enabled', () => {
    const el = document.createElement('div');
    const add = vi.spyOn(el, 'addEventListener');
    setupCursorLight(el, { enabled: true });
    // cursor-light now registers its listeners passively, so a third options
    // arg rides along with the handler.
    expect(add).toHaveBeenCalledWith('pointermove', expect.any(Function), expect.anything());
  });
});
