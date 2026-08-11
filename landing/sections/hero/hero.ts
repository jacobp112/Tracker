import './hero.css';
import { setupDataAnimations } from '../../lib/animate';
import { setupCursorLight } from './cursor-light';

/* ── Hero behaviour ───────────────────────────────────────────────
 * The Overview recreation: the course-health ring draws and counts up once on
 * scroll-into-view (reduced motion snaps it), and a cursor-aware light follows
 * the pointer — desktop fine-pointer only, off under reduced motion, so touch
 * devices never wire pointer listeners. */
export function initHero(reducedMotion: boolean): void {
  const heroMock = document.getElementById('mock-overview');
  if (!heroMock) return;

  setupDataAnimations([heroMock], { reducedMotion });

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  setupCursorLight(heroMock, { enabled: finePointer && !reducedMotion });
}
