import './memory.css';
import { setupDataAnimations } from '../../lib/animate';

/* ── Memory behaviour ─────────────────────────────────────────────
 * The retention matrix animates once on scroll-into-view: bars fill (composite-
 * only scaleX), then the delta chip and diagnostic badges settle in. Reduced
 * motion snaps to the final state; no-JS shows it via the CSS fallback. */
export function initMemory(reducedMotion: boolean): void {
  const matrix = document.getElementById('mock-matrix');
  if (matrix) setupDataAnimations([matrix], { reducedMotion });
}
