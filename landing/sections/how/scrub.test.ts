import { describe, it, expect } from 'vitest';
import { clamp01, seg, lerp, ease, sample, sceneState, POINTER_PATH } from './scrub';

describe('scrub math', () => {
  it('clamp01 bounds to 0..1', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });

  it('seg maps a sub-range to 0..1 and clamps outside it', () => {
    expect(seg(5, 0, 10)).toBe(0.5);
    expect(seg(-3, 0, 10)).toBe(0); // before the range
    expect(seg(50, 0, 10)).toBe(1); // after the range
  });

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('ease is a cubic ease-out: fixed at the ends, ahead in the middle', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.875, 5); // 1 - 0.5^3
    expect(ease(0.5)).toBeGreaterThan(0.5); // ease-out leads linear
  });
});

describe('sample', () => {
  it('returns the first waypoint at p=0', () => {
    const first = POINTER_PATH[0]!;
    expect(sample(POINTER_PATH, 0)).toEqual({ x: first.x, y: first.y, o: first.o });
  });

  it('returns the last waypoint at and beyond p=1', () => {
    const last = POINTER_PATH[POINTER_PATH.length - 1]!;
    expect(sample(POINTER_PATH, 1)).toEqual({ x: last.x, y: last.y, o: last.o });
    expect(sample(POINTER_PATH, 2)).toEqual({ x: last.x, y: last.y, o: last.o });
  });

  it('keeps opacity within 0..1 across the whole track', () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const { o } = sample(POINTER_PATH, p);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
});

describe('sceneState', () => {
  it('opens on beat 0 with the prompt visible on the live Cairn panel', () => {
    const s = sceneState(0.1);
    expect(s.beat).toBe(0);
    expect(s.cairnActive).toBe(true);
    expect(s.views.prompt).toBe(true);
    expect(s.views.stream).toBe(true);
    expect(s.copyHit).toBe(false);
    expect(s.chipText).toBe('prompt copied');
  });

  it('presses Copy as the pointer lands on it', () => {
    expect(sceneState(0.16).copyHit).toBe(true);
  });

  it('hands the stage to the AI panel while it writes (beat 1)', () => {
    const s = sceneState(0.3);
    expect(s.beat).toBe(1);
    expect(s.cairnActive).toBe(false);
    expect(s.views.stream).toBe(true);
    expect(s.views.json).toBe(false);
  });

  it('swaps the AI output from bars to JSON past the midpoint', () => {
    const s = sceneState(0.55);
    expect(s.views.stream).toBe(false);
    expect(s.views.json).toBe(true);
    // Chip label still reads outbound here — it only flips for the return trip
    // once the pointer grabs the JSON (p>=0.62), not when the view swaps.
    expect(s.chipText).toBe('prompt copied');
    expect(sceneState(0.65).chipText).toBe('syllabus.json');
  });

  it('returns to Cairn and shows the rejection (beat 2)', () => {
    const s = sceneState(0.7);
    expect(s.beat).toBe(2);
    expect(s.cairnActive).toBe(true);
    expect(s.views.reject).toBe(true);
    expect(s.views.prompt).toBe(false);
    expect(s.views.commit).toBe(false);
  });

  it('lands on the commit, with checks completing last (beat 3)', () => {
    const mid = sceneState(0.85);
    expect(mid.beat).toBe(3);
    expect(mid.views.commit).toBe(true);
    expect(mid.checkLines).toBeGreaterThan(0);
    expect(mid.checksDone).toBe(false);

    expect(sceneState(0.9).checksDone).toBe(true);
  });

  it('types the prompt in over its window and fills the bars over theirs', () => {
    expect(sceneState(0.28).typedFraction).toBe(0);
    expect(sceneState(0.34).typedFraction).toBeCloseTo(0.5, 5);
    expect(sceneState(0.4).typedFraction).toBe(1);

    expect(sceneState(0.4).streamLines).toBe(0);
    expect(sceneState(0.58).streamLines).toBeCloseTo(7, 5);
  });
});
