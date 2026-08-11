import { describe, expect, it } from 'vitest';
import {
  bell,
  chipFlight,
  CHIP_FLIGHTS,
  clamp01,
  ease,
  easeInOut,
  lerp,
  POINTER_PATH,
  sample,
  sceneState,
  seg,
  TIMELINE,
  type Waypoint,
} from './scrub';

/*
 * The sequence is a pure function of scroll progress p, so it can be verified
 * without a DOM, a scroll, or a browser.
 *
 * This file replaces the previous one. It has to: the timings moved into
 * TIMELINE, so assertions written against loose literals (0.545, 0.83, 0.66)
 * no longer describe anything. The replacement is deliberately written the
 * other way round — most tests assert RELATIONSHIPS between the parts of the
 * story ("bars finish before their view is swapped away", "validation follows
 * delivery") and read their boundaries from TIMELINE. Retiming the sequence is
 * then an edit to one table, and these tests keep holding; but breaking the
 * story fails them, which is what the old literals could not do.
 *
 * The three `regression:` tests below are the bugs that motivated the retime.
 */

/** Every p at 0.001 resolution — fine enough to catch a boundary off by one frame. */
const SWEEP = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe('primitives', () => {
  it('clamp01 clamps to the unit interval', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(9)).toBe(1);
  });

  it('seg maps a sub-range onto 0..1 and clamps outside it', () => {
    expect(seg(0.5, 0.5, 1)).toBe(0);
    expect(seg(0.75, 0.5, 1)).toBe(0.5);
    expect(seg(1, 0.5, 1)).toBe(1);
    expect(seg(0.1, 0.5, 1)).toBe(0);
    expect(seg(2, 0.5, 1)).toBe(1);
  });

  it('lerp interpolates', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('ease is a cubic ease-out: pinned at both ends, front-loaded', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInOut is pinned at both ends and symmetrical about the midpoint', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
    expect(easeInOut(0.25) + easeInOut(0.75)).toBeCloseTo(1, 10);
    expect(easeInOut(0.25)).toBeLessThan(0.25); // eases IN, unlike ease()
  });

  it('bell peaks mid-window and is exactly zero outside it', () => {
    const { start, end } = TIMELINE.press;
    expect(bell((start + end) / 2, start, end)).toBeCloseTo(1, 10);
    // Exactly 0, not sin(π)'s 1.2e-16 — otherwise every frame carries a ripple.
    expect(bell(start, start, end)).toBe(0);
    expect(bell(end, start, end)).toBe(0);
    expect(bell(0.5, start, end)).toBe(0);
  });
});

describe('sample (the pointer path)', () => {
  it('returns the origin for an empty path rather than throwing', () => {
    expect(sample([], 0.5)).toEqual({ x: 0, y: 0, o: 0 });
  });

  it('hits each waypoint exactly at its own p', () => {
    for (const w of POINTER_PATH) {
      const at = sample(POINTER_PATH, w.p);
      expect(at.x).toBeCloseTo(w.x, 6);
      expect(at.y).toBeCloseTo(w.y, 6);
      expect(at.o).toBeCloseTo(w.o, 6);
    }
  });

  it('holds the last waypoint past the end of the path', () => {
    const last = POINTER_PATH[POINTER_PATH.length - 1]!;
    expect(sample(POINTER_PATH, 1)).toEqual({ x: last.x, y: last.y, o: last.o });
  });

  it('applies the easing declared on the waypoint being arrived at', () => {
    const path: Waypoint[] = [
      { p: 0, x: 0, y: 0, o: 1 },
      { p: 1, x: 10, y: 0, o: 1, e: 'linear' },
    ];
    expect(sample(path, 0.5).x).toBeCloseTo(5, 10);

    const eased: Waypoint[] = [
      { p: 0, x: 0, y: 0, o: 1 },
      { p: 1, x: 10, y: 0, o: 1, e: 'inOut' },
    ];
    expect(sample(eased, 0.25).x).toBeLessThan(2.5);

    const dflt: Waypoint[] = [
      { p: 0, x: 0, y: 0, o: 1 },
      { p: 1, x: 10, y: 0, o: 1 },
    ];
    expect(sample(dflt, 0.25).x).toBeCloseTo(ease(0.25) * 10, 10); // 'out' by default
  });

  it('stays finite and in-range across the whole sweep', () => {
    for (const p of SWEEP) {
      const c = sample(POINTER_PATH, p);
      expect(Number.isFinite(c.x + c.y + c.o)).toBe(true);
      expect(c.o).toBeGreaterThanOrEqual(0);
      expect(c.o).toBeLessThanOrEqual(1);
    }
  });
});

describe('chipFlight', () => {
  it('is null whenever the chip is not in the air', () => {
    expect(chipFlight(0)).toBeNull();
    expect(chipFlight(0.5)).toBeNull();
    expect(chipFlight(1)).toBeNull();
    for (const f of CHIP_FLIGHTS) {
      expect(chipFlight(f.start)).toBeNull();
      expect(chipFlight(f.settle)).toBeNull();
    }
  });

  it('fades in and back out, and swells, across each flight', () => {
    for (const f of CHIP_FLIGHTS) {
      const mid = chipFlight((f.start + f.settle) / 2)!;
      expect(mid.opacity).toBeCloseTo(1, 6);
      expect(mid.scale).toBeGreaterThan(1);
      const early = chipFlight(f.start + (f.settle - f.start) * 0.02)!;
      expect(early.opacity).toBeLessThan(0.2);
      expect(early.scale).toBeLessThan(1);
    }
  });

  it('arcs above the straight line between its two ends', () => {
    for (const f of CHIP_FLIGHTS) {
      const mid = chipFlight((f.start + f.settle) / 2)!;
      const straight = lerp(f.y0, f.y1, mid.t);
      expect(mid.y).toBeLessThan(straight); // smaller y is higher on screen
    }
  });

  it('arrives where it was sent', () => {
    for (const f of CHIP_FLIGHTS) {
      const late = chipFlight(f.settle - 1e-6)!;
      expect(late.x).toBeCloseTo(f.x1, 3);
      expect(late.y).toBeCloseTo(f.y1, 3);
    }
  });
});

describe('sceneState', () => {
  it('shows exactly one Cairn view and exactly one AI view at every p', () => {
    for (const p of SWEEP) {
      const { views } = sceneState(p);
      expect([views.prompt, views.reject, views.commit].filter(Boolean)).toHaveLength(1);
      expect(views.stream).toBe(!views.json);
    }
  });

  it('advances the captions monotonically through all four beats', () => {
    let beat = 0;
    const seen = new Set<number>();
    for (const p of SWEEP) {
      const b = sceneState(p).beat;
      expect(b).toBeGreaterThanOrEqual(beat);
      beat = b;
      seen.add(b);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('never runs a progress value backwards', () => {
    let stream = -1;
    let checks = -1;
    for (const p of SWEEP) {
      const s = sceneState(p);
      expect(s.streamLines).toBeGreaterThanOrEqual(stream);
      expect(s.checkLines).toBeGreaterThanOrEqual(checks);
      stream = s.streamLines;
      checks = s.checkLines;
    }
  });

  it('hands focus to the AI panel only for the middle of the sequence', () => {
    expect(sceneState(0).cairnActive).toBe(true);
    expect(sceneState(TIMELINE.handoff).cairnActive).toBe(false);
    expect(sceneState(0.5).cairnActive).toBe(false);
    expect(sceneState(TIMELINE.handback).cairnActive).toBe(true);
    expect(sceneState(1).cairnActive).toBe(true);
  });

  it('blinks the caret only while the prompt is being typed', () => {
    for (const p of SWEEP) {
      const s = sceneState(p);
      if (s.typing) {
        expect(s.typedFraction).toBeGreaterThanOrEqual(0);
        expect(s.typedFraction).toBeLessThan(1);
      }
    }
    expect(sceneState(TIMELINE.typing.start).typing).toBe(true);
    expect(sceneState(TIMELINE.typing.end).typing).toBe(false);
    expect(sceneState(TIMELINE.typing.end).typedFraction).toBe(1);
  });

  it('agrees with chipFlight about whether the chip is airborne', () => {
    for (const p of SWEEP) {
      expect(sceneState(p).chipFlying).toBe(chipFlight(p) !== null);
    }
  });

  it('relabels the chip while it is out of sight, never mid-flight', () => {
    for (const p of SWEEP) {
      const s = sceneState(p);
      if (s.chipFlying) {
        const outbound = p < TIMELINE.jsonAt;
        expect(s.chipText).toBe(outbound ? 'prompt copied' : 'syllabus.json');
      }
    }
  });

  it('keeps the press states nested: ripple inside the hold, dip inside the ripple', () => {
    for (const p of SWEEP) {
      const s = sceneState(p);
      if (s.cursorDip) expect(s.press).toBeGreaterThan(0);
      if (s.press > 0) expect(s.copyHit).toBe(true);
    }
    expect(sceneState(0.17).copyHit).toBe(true);
    expect(sceneState(0.5).copyHit).toBe(false);
  });
});

describe('regression: the choreography bugs the retime fixed', () => {
  it('never swaps away the output bars before they have finished drawing', () => {
    // Was: bars ran to 0.58 but the JSON view took over at 0.545, so the last
    // one and a half bars drew off-screen.
    for (const p of SWEEP) {
      const s = sceneState(p);
      if (s.views.json) expect(s.streamLines).toBeGreaterThanOrEqual(7);
    }
    expect(TIMELINE.stream.end).toBeLessThan(TIMELINE.jsonAt);
  });

  it('marks the checks done exactly when the last one has ticked in', () => {
    // Was: checksDone at 0.88 while the tick-in ran to 0.94 — the marks turned
    // accent under a row that was still fading up.
    for (const p of SWEEP) {
      const s = sceneState(p);
      expect(s.checksDone).toBe(s.checkLines >= 3);
    }
  });

  it('never shows a validation result while the paste is still in the air', () => {
    // Was: the rejection appeared at 0.66 but the chip carrying the JSON did
    // not land until 0.72 — Cairn rejected a paste that had not arrived.
    for (const p of SWEEP) {
      const s = sceneState(p);
      if (chipFlight(p)) {
        expect(s.views.reject).toBe(false);
        expect(s.views.commit).toBe(false);
      }
    }
    expect(CHIP_FLIGHTS[1]!.settle).toBeLessThanOrEqual(TIMELINE.rejectAt);
  });

  it('turns each caption with the state it describes', () => {
    expect(sceneState(CHIP_FLIGHTS[0]!.start).beat).toBe(0); // 01 copy the prompt
    expect(sceneState(TIMELINE.typing.start).beat).toBe(1); //  02 paste it into your AI
    expect(sceneState(TIMELINE.rejectAt).beat).toBe(2); //      03 paste the result back
    expect(sceneState(TIMELINE.commitAt).beat).toBe(3); //      04 preview, then commit
  });
});