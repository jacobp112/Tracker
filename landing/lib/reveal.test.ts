import { describe, it, expect, vi } from 'vitest';
import { revealElement, makeRevealHandler, setupReveals } from './reveal';

function el(): HTMLElement {
  return document.createElement('div');
}

describe('reveal', () => {
  it('revealElement adds is-visible', () => {
    const e = el();
    revealElement(e);
    expect(e.classList.contains('is-visible')).toBe(true);
  });

  it('reduced motion reveals everything immediately, no observer', () => {
    const a = el(), b = el();
    const createObserver = vi.fn();
    setupReveals([a, b], { reducedMotion: true, createObserver });
    expect(a.classList.contains('is-visible')).toBe(true);
    expect(b.classList.contains('is-visible')).toBe(true);
    expect(createObserver).not.toHaveBeenCalled();
  });

  it('observes each element when motion is allowed', () => {
    const a = el(), b = el();
    const observe = vi.fn();
    const unobserve = vi.fn();
    const createObserver = vi.fn(() => ({ observe, unobserve }));
    setupReveals([a, b], { reducedMotion: false, createObserver });
    expect(createObserver).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('handler reveals and unobserves an intersecting target', () => {
    const e = el();
    const observer = { unobserve: vi.fn() } as unknown as IntersectionObserver;
    makeRevealHandler()(
      [{ isIntersecting: true, target: e } as unknown as IntersectionObserverEntry],
      observer,
    );
    expect(e.classList.contains('is-visible')).toBe(true);
    expect(observer.unobserve).toHaveBeenCalledWith(e);
  });

  it('handler ignores non-intersecting targets', () => {
    const e = el();
    const observer = { unobserve: vi.fn() } as unknown as IntersectionObserver;
    makeRevealHandler()(
      [{ isIntersecting: false, target: e } as unknown as IntersectionObserverEntry],
      observer,
    );
    expect(e.classList.contains('is-visible')).toBe(false);
    expect(observer.unobserve).not.toHaveBeenCalled();
  });
});
