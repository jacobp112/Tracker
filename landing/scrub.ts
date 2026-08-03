/*
 * How-it-works pinned scrub sequence.
 *
 * A tall track (.how-track) pins a stage (.how-stage) inside it. As the track
 * passes through the viewport, scroll position becomes a single progress value
 * p (0→1); EVERY moving part of the stage is a pure function of p. Nothing
 * hijacks the scroll — the page moves at its normal speed, the stage just holds
 * still while it passes, and scrolling back up plays the sequence in reverse.
 *
 * The geometry (cursor/chip pixel positions) needs the live box size and lives
 * in setupHowSequence. Everything that is pure — the easing, the pointer path,
 * and the scene state each p maps to — is exported and unit-tested, so the
 * frame logic is verified without a DOM or a scroll.
 */

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Progress of p across the sub-range [a, b], clamped to 0..1. */
export function seg(p: number, a: number, b: number): number {
  return clamp01((p - a) / (b - a));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cubic ease-out. Fast to start, settles at the end — reads as arrival. */
export function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface Waypoint {
  p: number;
  x: number;
  y: number;
  o: number;
}

/* Pointer waypoints, in fractions of the stage-body box. Interpolated on p so
 * the cursor travels continuously instead of teleporting between beats. */
export const POINTER_PATH: Waypoint[] = [
  { p: 0.0, x: 0.3, y: 0.95, o: 0 },
  { p: 0.06, x: 0.3, y: 0.72, o: 1 },
  { p: 0.13, x: 0.385, y: 0.185, o: 1 }, // the Copy button
  { p: 0.19, x: 0.385, y: 0.185, o: 1 },
  { p: 0.3, x: 0.6, y: 0.13, o: 1 }, // the AI input
  { p: 0.38, x: 0.66, y: 0.3, o: 0 }, // steps back while it writes
  { p: 0.52, x: 0.66, y: 0.55, o: 0 },
  { p: 0.58, x: 0.7, y: 0.42, o: 1 }, // grabs the JSON
  { p: 0.68, x: 0.24, y: 0.34, o: 1 }, // carries it to Cairn
  { p: 0.8, x: 0.24, y: 0.34, o: 1 },
  { p: 0.92, x: 0.2, y: 0.62, o: 0 },
];

/** Pointer position + opacity at progress p, eased within the active segment. */
export function sample(path: Waypoint[], p: number): { x: number; y: number; o: number } {
  const last = path[path.length - 1];
  if (!last) return { x: 0, y: 0, o: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (a && b && p <= b.p) {
      const t = ease(seg(p, a.p, b.p));
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), o: lerp(a.o, b.o, t) };
    }
  }
  return { x: last.x, y: last.y, o: last.o };
}

export type Beat = 0 | 1 | 2 | 3;

export interface SceneState {
  /** Which caption is active (0-based). */
  beat: Beat;
  /** True while the Cairn panel is the one being acted on; false hands focus to the AI panel. */
  cairnActive: boolean;
  /** Which of the swappable views are showing. */
  views: { prompt: boolean; reject: boolean; commit: boolean; stream: boolean; json: boolean };
  /** The Copy button's pressed state as the pointer "clicks" it. */
  copyHit: boolean;
  /** How many of the 7 AI output bars have drawn (float, 0..7). */
  streamLines: number;
  /** How many of the 3 commit checks have ticked (float, 0..3). */
  checkLines: number;
  /** All checks ticked — flips their marks to success. */
  checksDone: boolean;
  /** Fraction of the prompt typed into the AI input (0..1). */
  typedFraction: number;
  /** The travelling chip's label — the prompt on the way out, the file on the way back. */
  chipText: string;
  /** Whether the chip is mid-flight between panels. */
  chipFlying: boolean;
}

/**
 * The complete non-geometric state of the stage at progress p. Every threshold
 * lives here so the whole sequence can be retimed — and reasoned about — in one
 * place, and render() stays a thin projection of this onto the DOM.
 */
export function sceneState(p: number): SceneState {
  const cairnActive = p < 0.24 || p > 0.64;
  return {
    beat: p < 0.24 ? 0 : p < 0.62 ? 1 : p < 0.8 ? 2 : 3,
    cairnActive,
    views: {
      prompt: p < 0.66,
      reject: p >= 0.66 && p < 0.8,
      commit: p >= 0.8,
      stream: p < 0.545,
      json: p >= 0.545,
    },
    copyHit: p > 0.145 && p < 0.2,
    streamLines: seg(p, 0.4, 0.58) * 7,
    checkLines: seg(p, 0.83, 0.94) * 3,
    checksDone: p > 0.88,
    typedFraction: seg(p, 0.28, 0.4),
    chipText: p < 0.62 ? 'prompt copied' : 'syllabus.json',
    chipFlying: (p > 0.17 && p < 0.31) || (p > 0.6 && p < 0.72),
  };
}

/* The short prompt that types into the AI input. The FULL prompt the Copy
 * button hands over lives in the #prompt-full <template> and is copied by the
 * existing clipboard wiring in main.ts — this is only the on-screen typing. */
const AI_INPUT_PROMPT = 'You are converting a course syllabus into a structured JSON object…';

/**
 * Wire the pinned scrub sequence inside `root` (the .how-track section).
 *
 * Under reduced motion or a narrow viewport there is nothing to scrub — the
 * stylesheet unpins the stage and stacks every state — so this paints the final
 * frame (all views on, bars full, checks done, prompt typed) and never attaches
 * a scroll listener. That mirrors the no-JS fallback exactly: a sequence nobody
 * can scrub is just content, and it should read as content.
 */
export function setupHowSequence(root: HTMLElement, opts: { reducedMotion: boolean }): void {
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  const scrub = !opts.reducedMotion && !narrow;

  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);
  const stage = q<HTMLElement>('.how-stage');
  const bodyEl = q<HTMLElement>('.stage-body');
  if (!stage || !bodyEl) return;

  const cursor = q<HTMLElement>('.cursor');
  const chip = q<HTMLElement>('.chip-fly');
  const copyBtn = q<HTMLElement>('.copy-btn');
  const railFill = q<HTMLElement>('.rail i');
  const aiText = q<HTMLElement>('.ai-text');
  const stream = q<HTMLElement>('.stream');
  const checks = q<HTMLElement>('.checks');
  const pCairn = q<HTMLElement>('[data-panel="cairn"]');
  const pAi = q<HTMLElement>('[data-panel="ai"]');
  const beats = Array.from(root.querySelectorAll<HTMLElement>('.beat'));

  const view = (name: string): HTMLElement | null => q<HTMLElement>(`[data-view="${name}"]`);
  const setView = (name: string, on: boolean): void =>
    view(name)?.setAttribute('data-on', on ? '1' : '0');

  if (!scrub) {
    (['prompt', 'reject', 'commit', 'stream', 'json'] as const).forEach((n) => setView(n, true));
    stream?.style.setProperty('--lines', '7');
    checks?.style.setProperty('--lines', '3');
    checks?.setAttribute('data-done', '1');
    if (aiText) aiText.textContent = AI_INPUT_PROMPT;
    beats.forEach((b) => b.setAttribute('data-on', '1'));
    return;
  }

  const render = (p: number): void => {
    const s = sceneState(p);
    stage.style.setProperty('--p', p.toFixed(4));
    railFill?.style.setProperty('--p', p.toFixed(4));

    const box = bodyEl.getBoundingClientRect();
    const c = sample(POINTER_PATH, p);
    if (cursor) {
      cursor.style.setProperty('--cx', `${c.x * box.width}px`);
      cursor.style.setProperty('--cy', `${c.y * box.height}px`);
      cursor.style.setProperty('--co', c.o.toFixed(3));
      /* Brief dip on the click itself. */
      cursor.style.setProperty('--cs', p > 0.145 && p < 0.185 ? '0.82' : '1');
    }

    copyBtn?.setAttribute('data-hit', s.copyHit ? '1' : '0');

    if (chip) {
      chip.textContent = s.chipText;
      if (p > 0.17 && p < 0.31) {
        const f = seg(p, 0.17, 0.3);
        chip.style.setProperty('--fo', String(Math.sin(f * Math.PI)));
        chip.style.setProperty('--fx', `${lerp(0.36, 0.58, ease(f)) * box.width}px`);
        chip.style.setProperty('--fy', `${lerp(0.19, 0.11, ease(f)) * box.height}px`);
      } else if (p > 0.6 && p < 0.72) {
        const f = seg(p, 0.6, 0.72);
        chip.style.setProperty('--fo', String(Math.sin(f * Math.PI)));
        chip.style.setProperty('--fx', `${lerp(0.68, 0.22, ease(f)) * box.width}px`);
        chip.style.setProperty('--fy', `${lerp(0.42, 0.34, ease(f)) * box.height}px`);
      } else {
        chip.style.setProperty('--fo', '0');
      }
    }

    if (aiText) {
      aiText.textContent = AI_INPUT_PROMPT.slice(0, Math.round(s.typedFraction * AI_INPUT_PROMPT.length));
    }
    stream?.style.setProperty('--lines', s.streamLines.toFixed(3));
    setView('stream', s.views.stream);
    setView('json', s.views.json);

    setView('prompt', s.views.prompt);
    setView('reject', s.views.reject);
    setView('commit', s.views.commit);
    checks?.style.setProperty('--lines', s.checkLines.toFixed(3));
    checks?.setAttribute('data-done', s.checksDone ? '1' : '0');

    pCairn?.setAttribute('data-active', s.cairnActive ? '1' : '0');
    pAi?.setAttribute('data-active', s.cairnActive ? '0' : '1');

    beats.forEach((b) => b.setAttribute('data-on', Number(b.dataset.b) === s.beat ? '1' : '0'));
  };

  let queued = false;
  const onScroll = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const r = root.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      render(total <= 0 ? 0 : clamp01(-r.top / total));
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
}
