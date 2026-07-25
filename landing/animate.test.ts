import { describe, it, expect, vi } from 'vitest';
import {
  clamp01, easeOutCubic, countUpValue, ringOffset, animateGroup, setupDataAnimations,
} from './animate';

describe('pure helpers', () => {
  it('clamp01 clamps to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });
  it('easeOutCubic hits endpoints and eases', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // ease-out is above the diagonal
  });
  it('countUpValue starts at 0, ends at target, rounds', () => {
    expect(countUpValue(82, 0, 900)).toBe(0);
    expect(countUpValue(82, 900, 900)).toBe(82);
    expect(countUpValue(82, 2000, 900)).toBe(82); // clamps past duration
    expect(countUpValue(82, 450, 0)).toBe(82);     // zero duration -> final
  });
  it('ringOffset maps percent to dashoffset for pathLength=100', () => {
    expect(ringOffset(0)).toBe(100);
    expect(ringOffset(82)).toBe(18);
    expect(ringOffset(100)).toBe(0);
    expect(ringOffset(120)).toBe(0); // clamps
  });
});

function group(html: string): HTMLElement {
  const g = document.createElement('div');
  g.setAttribute('data-animate', '');
  g.innerHTML = html;
  return g;
}

describe('animateGroup — reduced motion snaps to final', () => {
  it('count-up shows final value, ring is drawn, bars filled — no clock used', () => {
    const g = group(`
      <span class="ring"><svg><circle class="ring-arc"/></svg></span>
      <span data-countup="82" data-countup-suffix="">0</span>
      <div class="bars"><span class="bar-fill"></span></div>
    `);
    (g.querySelector('.ring') as HTMLElement).style.setProperty('--arc', '82');
    const raf = vi.fn();
    animateGroup(g, { reducedMotion: true, raf });
    expect(g.querySelector('[data-countup]')!.textContent).toBe('82');
    expect(g.querySelector('.ring')!.classList.contains('is-drawn')).toBe(true);
    expect(g.querySelector('.ring')!.getAttribute('style')).toContain('--offset: 18');
    expect(g.querySelector('.bars')!.classList.contains('is-filled')).toBe(true);
    expect(raf).not.toHaveBeenCalled();
  });
});

describe('setupDataAnimations', () => {
  it('reduced motion animates every group immediately, no observer', () => {
    const a = group('<span data-countup="10">0</span>');
    const b = group('<span data-countup="20">0</span>');
    const createObserver = vi.fn();
    setupDataAnimations([a, b], { reducedMotion: true, createObserver });
    expect(a.querySelector('[data-countup]')!.textContent).toBe('10');
    expect(b.querySelector('[data-countup]')!.textContent).toBe('20');
    expect(createObserver).not.toHaveBeenCalled();
  });
  it('with motion, observes each group', () => {
    const a = group('<span data-countup="10">0</span>');
    const observe = vi.fn();
    const createObserver = vi.fn(() => ({ observe }));
    setupDataAnimations([a], { reducedMotion: false, createObserver });
    expect(createObserver).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(a);
  });
});
