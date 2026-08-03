/*
 * Pointer response for the hero recreation: a trailing highlight AND a
 * parallax tilt, both driven by ONE rAF loop.
 *
 * Two things this fixes from the previous version:
 *
 *   1. `lerp` was exported and never called. The smoothing was clearly
 *      intended and never wired up, so the highlight snapped to the pointer
 *      instead of trailing it. It is now the core of the loop.
 *
 *   2. pointermove fired two style writes per event, unthrottled. A 1000Hz
 *      mouse meant ~1000 style invalidations a second against a ~60Hz paint.
 *      Events now only update a target; the loop commits once per frame.
 *
 * The tilt uses scaffolding that was already in recreations.css and pointing
 * at nothing: `.hero-visual { perspective: 1000px }`, plus `transform-style`
 * and `will-change: transform` on `.mock-hero`. A tilt was planned, removed,
 * and its setup left behind. This is that tilt.
 *
 * The exported signature is unchanged, so main.ts needs no edit.
 */

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

/* Degrees of rotation at full deflection (pointer at a card edge). 4.5 is
 * deliberately small — the card should read as responding, not as a toy. Past
 * ~7deg the text edges visibly soften and it starts to look like a template. */
const MAX_TILT_DEG = 4.5;

/* Per-frame easing factors. The tilt is TIGHTER than the light on purpose:
 * the card is an object answering the pointer, the light is atmosphere
 * trailing behind it. Equal values make both feel like lag. */
const TILT_EASE = 0.14;
const LIGHT_EASE = 0.09;

/* Below this the loop snaps to target and stops rather than chasing a
 * difference nobody can see. */
const EPSILON = 0.0004;

type Vec = { x: number; y: number };

const REST_LIGHT: Vec = { x: 0.5, y: 0.5 };
const REST_TILT: Vec = { x: 0, y: 0 };

/**
 * Pointer-tracked highlight + parallax tilt on the hero recreation.
 *
 * Writes four custom properties that CSS consumes:
 *   --x, --y            highlight centre, as percentages
 *   --tilt-x, --tilt-y  rotateX / rotateY, in degrees
 *
 * Desktop-pointer + motion gated by the caller; a no-op when disabled, so
 * touch and reduced-motion never wire listeners or promote a layer.
 */
export function setupCursorLight(el: HTMLElement, opts: { enabled: boolean }): void {
  if (!opts.enabled) return;

  const light: Vec = { ...REST_LIGHT };
  const lightTo: Vec = { ...REST_LIGHT };
  const tilt: Vec = { ...REST_TILT };
  const tiltTo: Vec = { ...REST_TILT };

  let frame = 0;
  let hovering = false;

  const commit = (): void => {
    el.style.setProperty('--x', `${(light.x * 100).toFixed(2)}%`);
    el.style.setProperty('--y', `${(light.y * 100).toFixed(2)}%`);
    /* Horizontal pointer travel rotates around Y; vertical around X, and
     * inverted, so the edge nearest the pointer is the edge that comes
     * forward. Get this sign wrong and the card feels like it is dodging. */
    el.style.setProperty('--tilt-y', `${(tilt.x * 2 * MAX_TILT_DEG).toFixed(3)}deg`);
    el.style.setProperty('--tilt-x', `${(-tilt.y * 2 * MAX_TILT_DEG).toFixed(3)}deg`);
  };

  const settle = (): void => {
    /* At full rest with the pointer gone, hand the properties back to their
     * CSS defaults and drop the compositor layer. Leaving will-change on
     * permanently — which the old stylesheet did — keeps a layer alive for
     * the life of the page for an effect that runs for two seconds. */
    el.style.removeProperty('--x');
    el.style.removeProperty('--y');
    el.style.removeProperty('--tilt-x');
    el.style.removeProperty('--tilt-y');
    el.classList.remove('is-live');
  };

  const tick = (): void => {
    light.x = lerp(light.x, lightTo.x, LIGHT_EASE);
    light.y = lerp(light.y, lightTo.y, LIGHT_EASE);
    tilt.x = lerp(tilt.x, tiltTo.x, TILT_EASE);
    tilt.y = lerp(tilt.y, tiltTo.y, TILT_EASE);

    const done =
      Math.abs(light.x - lightTo.x) < EPSILON &&
      Math.abs(light.y - lightTo.y) < EPSILON &&
      Math.abs(tilt.x - tiltTo.x) < EPSILON &&
      Math.abs(tilt.y - tiltTo.y) < EPSILON;

    if (!done) {
      commit();
      frame = requestAnimationFrame(tick);
      return;
    }

    light.x = lightTo.x;
    light.y = lightTo.y;
    tilt.x = tiltTo.x;
    tilt.y = tiltTo.y;
    frame = 0;

    if (hovering) commit();
    else settle();
  };

  const start = (): void => {
    if (frame === 0) frame = requestAnimationFrame(tick);
  };

  el.addEventListener(
    'pointerenter',
    () => {
      hovering = true;
      el.classList.add('is-live');
      start();
    },
    { passive: true },
  );

  el.addEventListener(
    'pointermove',
    (e) => {
      /* Target only. No style writes here — see the note at the top. */
      const p = relativePosition(el.getBoundingClientRect(), e.clientX, e.clientY);
      lightTo.x = p.x;
      lightTo.y = p.y;
      tiltTo.x = p.x - 0.5;
      tiltTo.y = p.y - 0.5;
      start();
    },
    { passive: true },
  );

  el.addEventListener(
    'pointerleave',
    () => {
      hovering = false;
      lightTo.x = REST_LIGHT.x;
      lightTo.y = REST_LIGHT.y;
      tiltTo.x = REST_TILT.x;
      tiltTo.y = REST_TILT.y;
      /* Ease back to flat rather than dropping — the return is half the
       * effect. settle() runs from the loop once it actually arrives. */
      start();
    },
    { passive: true },
  );
}
