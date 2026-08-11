import './exams.css';
import { animateGroup, setupDataAnimations } from '../../lib/animate';

/* ── Exams behaviour ──────────────────────────────────────────────
 * The decay curve draws itself once when it first scrolls into view. The replay
 * control runs that sequence again on demand, with two guards:
 *  - reduced motion has nothing to replay (the sequence is snapped to its end),
 *    so the button is hidden rather than left a dead control;
 *  - it only replays while the figure is actually on screen — an Intersection
 *    observer gates it, so a click can't fire a draw the user can't see.
 *
 * lib/animate.ts is IMPORTED, never modified: replay now calls the same
 * animateGroup() the observer would have called, instead of re-adding .is-drawn
 * by hand. That is what makes the day-30 gap count up again with the redraw —
 * by hand, the strokes replayed and the number sat there already answered. */
export function initExams(reducedMotion: boolean): void {
  const decayCurve = document.querySelector('.decay-curve');
  if (decayCurve) setupDataAnimations([decayCurve], { reducedMotion });

  const decayReplay = document.getElementById('decay-replay') as HTMLButtonElement | null;
  if (!decayCurve || !decayReplay) return;

  if (reducedMotion) {
    decayReplay.hidden = true;
    return;
  }

  let inView = false;
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver((entries) => {
      for (const e of entries) inView = e.isIntersecting;
    }).observe(decayCurve);
  } else {
    inView = true; // no observer to gate on — don't disable the control
  }

  decayReplay.addEventListener('click', () => {
    if (!inView) return;
    decayCurve.classList.remove('is-drawn');
    // Force a reflow so the class removal commits before it goes back on;
    // otherwise the browser coalesces the two and the transitions never restart.
    void (decayCurve as HTMLElement).offsetWidth;
    animateGroup(decayCurve, { reducedMotion });
  });
}