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
 * in setupHowSequence. Everything that is pure — the easings, the pointer path,
 * the chip's flight, and the scene state each p maps to — is exported and unit-
 * tested, so the frame logic is verified without a DOM or a scroll.
 *
 * ── This pass: the choreography, not the plumbing ─────────────────
 * Three ordering bugs were visible on screen and invisible to the tests,
 * because every threshold was a loose literal that no test could relate to any
 * other one:
 *
 *   1. The AI's output bars drew from 0.40 to 0.58, but the panel swapped to
 *      the JSON view at 0.545 — the last one and a half bars never finished.
 *      They now complete at 0.585 and the swap waits until 0.60.
 *   2. The commit checks ticked in from 0.83 to 0.94, but checksDone fired at
 *      0.88 — the marks turned accent while the third row was still fading up.
 *      checksDone is now exactly the end of the tick-in.
 *   3. The rejection appeared at 0.66 while the chip carrying the pasted JSON
 *      did not land until 0.72 — Cairn rejected a paste that had not arrived.
 *      Validation states now start only once the return flight has landed.
 *
 * So the timings moved into one exported TIMELINE table and the story became
 * expressible as invariants a test can hold (see scrub.test.ts): bars finish
 * before their view is swapped away, validation follows delivery, a caption
 * turns with the state it describes. Retiming the sequence is now an edit to
 * one table, and the tests check relationships rather than magic numbers.
 *
 * Also new, all still pure functions of p: per-segment easing on the pointer,
 * so long travels accelerate and only arrivals decelerate (the old path eased
 * out of every hop, which read as a stutter); the pointer dims instead of
 * vanishing while the AI writes; the chip arcs and swells in flight instead of
 * sliding in a straight line; and a ripple leaves the Copy button on the press.
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

/** Cubic ease-in-out. Reads as travel: it leaves as deliberately as it lands. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** A 0→1→0 bell across [a, b]; exactly 0 everywhere outside it.
 * (The guard is not decoration: sin(π) is 1.2e-16, not 0, so without it every
 * frame of the sequence would carry a non-zero ripple.) */
export function bell(p: number, a: number, b: number): number {
  if (p <= a || p >= b) return 0;
  return Math.sin(seg(p, a, b) * Math.PI);
}

export type Easing = 'out' | 'inOut' | 'linear';

const EASINGS: Record<Easing, (t: number) => number> = {
  out: ease,
  inOut: easeInOut,
  linear: (t) => t,
};

export interface Waypoint {
  p: number;
  x: number;
  y: number;
  o: number;
  /** How the pointer ARRIVES here, from the previous waypoint. Default 'out'. */
  e?: Easing;
}

/* ── The single source of timing truth ────────────────────────────
 * Every threshold in the sequence, in scroll-progress units, in order. The
 * whole four-beat story can be retimed here; nothing else holds a number that
 * means "when".
 *
 * Act 1 — copy       0.00 → 0.26   the pointer arrives, presses, the chip leaves
 * Act 2 — generate   0.26 → 0.62   the prompt types, the AI writes, JSON lands
 * Act 3 — paste back 0.62 → 0.86   the chip returns, the paste is rejected
 * Act 4 — commit     0.86 → 1.00   the checks tick, the pointer leaves */
export const TIMELINE = {
  /** Caption boundaries: beat 0 below the first, beat 3 above the last. */
  beats: [0.26, 0.62, 0.86],
  /** The pointer's dip — briefer than the button's own held state. */
  cursorPress: { start: 0.15, end: 0.18 },
  /** The ripple leaving the button. */
  press: { start: 0.15, end: 0.19 },
  /** The button's pressed styling, held a moment past the ripple. */
  copyHit: { start: 0.15, end: 0.2 },
  /** Focus crosses to the AI panel, and back when the chip departs it. */
  handoff: 0.26,
  handback: 0.66,
  /** The prompt typing into the AI input. */
  typing: { start: 0.28, end: 0.42 },
  /** The seven abstract output bars. */
  stream: { start: 0.44, end: 0.585 },
  /** …which must be finished before the panel swaps to the JSON. */
  jsonAt: 0.6,
  /** Validation only once the return flight has landed (see CHIP_FLIGHTS[1]). */
  rejectAt: 0.76,
  commitAt: 0.86,
  /** The three commit checks; checksDone is exactly `end`. */
  checks: { start: 0.88, end: 0.95 },
} as const;

/* Pointer waypoints, in fractions of the stage-body box, each carrying the
 * easing used to ARRIVE at it: 'inOut' for a long travel across the stage,
 * 'out' for an arrival that should settle onto a target, 'linear' for a hold.
 *
 * These are calibrated against the panels' padding and header height. If those
 * change in how.css, the pointer stops landing on the Copy button and the AI
 * input — the two are a pair, and the redesign deliberately left the paddings
 * alone rather than retune coordinates a test cannot see. */
export const POINTER_PATH: Waypoint[] = [
  { p: 0.0, x: 0.3, y: 1.06, o: 0 }, // below the frame
  { p: 0.05, x: 0.34, y: 0.78, o: 1, e: 'out' }, // enters, fades up
  { p: 0.11, x: 0.4, y: 0.46, o: 1, e: 'inOut' }, // rises toward the button
  { p: 0.15, x: 0.42, y: 0.215, o: 1, e: 'out' }, // lands on Copy
  { p: 0.2, x: 0.42, y: 0.215, o: 1, e: 'linear' }, // holds through the press
  { p: 0.27, x: 0.6, y: 0.2, o: 1, e: 'inOut' }, // crosses to the AI input
  { p: 0.42, x: 0.62, y: 0.24, o: 1, e: 'inOut' }, // stays while the prompt types
  { p: 0.5, x: 0.72, y: 0.46, o: 0.35, e: 'inOut' }, // steps back, dims, watches
  { p: 0.6, x: 0.72, y: 0.46, o: 0.35, e: 'linear' }, // waits out the writing
  { p: 0.66, x: 0.7, y: 0.44, o: 1, e: 'out' }, // takes the JSON
  { p: 0.76, x: 0.24, y: 0.34, o: 1, e: 'inOut' }, // carries it home
  { p: 0.88, x: 0.26, y: 0.4, o: 1, e: 'out' }, // over the commit preview
  { p: 0.97, x: 0.22, y: 0.72, o: 0, e: 'inOut' }, // leaves
];

/** Pointer position + opacity at progress p, eased within the active segment. */
export function sample(path: Waypoint[], p: number): { x: number; y: number; o: number } {
  const last = path[path.length - 1];
  if (!last) return { x: 0, y: 0, o: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (a && b && p <= b.p) {
      const t = (EASINGS[b.e ?? 'out'] ?? ease)(seg(p, a.p, b.p));
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), o: lerp(a.o, b.o, t) };
    }
  }
  return { x: last.x, y: last.y, o: last.o };
}

/* ── The clipboard chip's two flights ─────────────────────────────
 * One table, because the visibility window and the travel used to be written
 * out twice — sceneState called the chip airborne until 0.31 while render()
 * animated it to 0.30, so for one hundredth of the sequence a chip that had
 * arrived was still officially in flight. There is now one window: [start,
 * settle], and landing IS the end of it.
 *
 * `lift` bends the path into an arc, and the chip swells slightly at the apex,
 * so it reads as carried rather than dragged. Positions are fractions of the
 * stage-body box, like POINTER_PATH. */
export interface ChipFlight {
  /** Eased progress through the travel, 0..1. */
  t: number;
  /** Fades in and back out across the flight — 0 at both ends, 1 at the apex. */
  opacity: number;
  /** 0.90 at both ends, ~1.04 at the apex. */
  scale: number;
  x: number;
  y: number;
}

export const CHIP_FLIGHTS = [
  // Out: the copied prompt, Cairn → the AI. Leaves as the press lands.
  { start: 0.18, settle: 0.3, x0: 0.4, y0: 0.2, x1: 0.6, y1: 0.15, lift: 0.07 },
  // Back: the returned JSON, the AI → Cairn. Lands exactly on TIMELINE.rejectAt,
  // which is what lets validation follow delivery instead of pre-empting it.
  { start: 0.66, settle: 0.76, x0: 0.7, y0: 0.42, x1: 0.22, y1: 0.34, lift: 0.11 },
] as const;

/** The chip's state at p, or null when it isn't in the air. */
export function chipFlight(p: number): ChipFlight | null {
  for (const f of CHIP_FLIGHTS) {
    if (p > f.start && p < f.settle) {
      const raw = seg(p, f.start, f.settle);
      const t = ease(raw);
      const arc = Math.sin(raw * Math.PI);
      return {
        t,
        opacity: arc,
        scale: 0.9 + arc * 0.14,
        x: lerp(f.x0, f.x1, t),
        y: lerp(f.y0, f.y1, t) - f.lift * arc,
      };
    }
  }
  return null;
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
  /** The ripple leaving the button, 0→1→0 across the press. */
  press: number;
  /** The pointer's own dip on the click — briefer than copyHit. */
  cursorDip: boolean;
  /** How many of the 7 AI output bars have drawn (float, 0..7). */
  streamLines: number;
  /** How many of the 3 commit checks have ticked (float, 0..3). */
  checkLines: number;
  /** All checks ticked — flips their marks to the accent. */
  checksDone: boolean;
  /** Fraction of the prompt typed into the AI input (0..1). Linear: typing has no easing. */
  typedFraction: number;
  /** The caret blinks only while the field is being typed into. */
  typing: boolean;
  /** The travelling chip's label — the prompt on the way out, the file on the way back. */
  chipText: string;
  /** Whether the chip is mid-flight between panels. */
  chipFlying: boolean;
}

/**
 * The complete non-geometric state of the stage at progress p — a thin, total
 * projection of TIMELINE. render() maps it onto the DOM and decides nothing.
 */
export function sceneState(p: number): SceneState {
  const T = TIMELINE;
  const [b0, b1, b2] = T.beats;
  const returnFlight = CHIP_FLIGHTS[1];

  return {
    beat: p < b0 ? 0 : p < b1 ? 1 : p < b2 ? 2 : 3,
    cairnActive: p < T.handoff || p >= T.handback,
    views: {
      // The prompt holds the Cairn panel until the pasted JSON lands on it.
      prompt: p < T.rejectAt,
      reject: p >= T.rejectAt && p < T.commitAt,
      commit: p >= T.commitAt,
      stream: p < T.jsonAt,
      json: p >= T.jsonAt,
    },
    copyHit: p > T.copyHit.start && p < T.copyHit.end,
    press: bell(p, T.press.start, T.press.end),
    cursorDip: p > T.cursorPress.start && p < T.cursorPress.end,
    streamLines: seg(p, T.stream.start, T.stream.end) * 7,
    checkLines: seg(p, T.checks.start, T.checks.end) * 3,
    checksDone: p >= T.checks.end,
    typedFraction: seg(p, T.typing.start, T.typing.end),
    typing: p >= T.typing.start && p < T.typing.end,
    // The label flips as the return flight begins, while the chip is invisible.
    chipText: p < returnFlight.start ? 'prompt copied' : 'syllabus.json',
    chipFlying: chipFlight(p) !== null,
  };
}

/* The short prompt that types into the AI input. The FULL prompt the Copy
 * button hands over lives in the #prompt-full <template> and is copied by the
 * existing clipboard wiring in how.ts — this is only the on-screen typing. */
const AI_INPUT_PROMPT = 'You are converting a course syllabus into a structured JSON object…';

/* Matches the fallback query in how.css, short viewports included. The stage is
 * unpinned by CSS at these sizes, so there is nothing to scrub; if the two ever
 * disagree, one of them is animating a stage the other has already flattened. */
const UNPINNED = '(max-width: 860px), (max-height: 640px)';

/** Write an attribute only when it would actually change. */
function setAttr(el: Element | null | undefined, name: string, value: string): void {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Write text only when it would actually change. */
function setText(el: HTMLElement | null | undefined, value: string): void {
  if (el && el.textContent !== value) el.textContent = value;
}

/**
 * Wire the pinned scrub sequence inside `root` (the .how-track section).
 *
 * Under reduced motion, a narrow viewport or a short one there is nothing to
 * scrub — the stylesheet unpins the stage and stacks every state — so this
 * paints the final frame (all views on, bars full, checks done, prompt typed)
 * and attaches no scroll listener. That mirrors the no-JS fallback exactly: a
 * sequence nobody can scrub is just content, and it should read as content.
 *
 * The breakpoint is re-evaluated on change, not read once: a resize or a phone
 * rotation across it used to leave the stage pinned with no listener driving it
 * (a frozen frame) or a listener running against an unpinned stage.
 *
 * Returns a teardown that removes every listener it added.
 */
export function setupHowSequence(root: HTMLElement, opts: { reducedMotion: boolean }): () => void {
  const q = <T extends HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);
  const stage = q<HTMLElement>('.how-stage');
  const bodyEl = q<HTMLElement>('.stage-body');
  if (!stage || !bodyEl) return () => {};

  const cursor = q<HTMLElement>('.cursor');
  const chip = q<HTMLElement>('.chip-fly');
  const copyBtn = q<HTMLElement>('.copy-btn');
  const railFill = q<HTMLElement>('.rail i');
  const aiInput = q<HTMLElement>('.ai-input');
  const aiText = q<HTMLElement>('.ai-text');
  const stream = q<HTMLElement>('.stream');
  const checks = q<HTMLElement>('.checks');
  const pCairn = q<HTMLElement>('[data-panel="cairn"]');
  const pAi = q<HTMLElement>('[data-panel="ai"]');
  const beats = Array.from(root.querySelectorAll<HTMLElement>('.beat'));

  const view = (name: string): HTMLElement | null => q<HTMLElement>(`[data-view="${name}"]`);
  const setView = (name: string, on: boolean): void => setAttr(view(name), 'data-on', on ? '1' : '0');
  const VIEWS = ['prompt', 'reject', 'commit', 'stream', 'json'] as const;

  /** The unscrubbable frame: everything at its final, legible state. */
  const paintStatic = (): void => {
    VIEWS.forEach((n) => setView(n, true));
    stream?.style.setProperty('--lines', '7');
    checks?.style.setProperty('--lines', '3');
    setAttr(checks, 'data-done', '1');
    setText(aiText, AI_INPUT_PROMPT);
    setAttr(aiInput, 'data-typing', '0');
    copyBtn?.style.setProperty('--press', '0');
    beats.forEach((b) => setAttr(b, 'data-on', '1'));
  };

  /* Cached because only the box's SIZE is used, and reading it inside render()
   * — after the style writes above it — forced a layout on every frame. The
   * sticky stage changes position constantly and size almost never. */
  let boxW = 0;
  let boxH = 0;
  let lastP = -1;

  const measure = (): void => {
    const box = bodyEl.getBoundingClientRect();
    boxW = box.width;
    boxH = box.height;
    lastP = -1; // geometry moved: the next render must not be skipped
  };

  const render = (p: number): void => {
    if (p === lastP) return;
    lastP = p;

    const s = sceneState(p);
    const pStr = p.toFixed(4);
    stage.style.setProperty('--p', pStr);
    railFill?.style.setProperty('--p', pStr);

    const c = sample(POINTER_PATH, p);
    if (cursor) {
      cursor.style.setProperty('--cx', `${c.x * boxW}px`);
      cursor.style.setProperty('--cy', `${c.y * boxH}px`);
      cursor.style.setProperty('--co', c.o.toFixed(3));
      cursor.style.setProperty('--cs', s.cursorDip ? '0.82' : '1');
    }

    setAttr(copyBtn, 'data-hit', s.copyHit ? '1' : '0');
    copyBtn?.style.setProperty('--press', s.press.toFixed(3));

    if (chip) {
      setText(chip, s.chipText);
      const flight = chipFlight(p);
      if (flight) {
        chip.style.setProperty('--fo', flight.opacity.toFixed(3));
        chip.style.setProperty('--fs', flight.scale.toFixed(3));
        chip.style.setProperty('--fx', `${flight.x * boxW}px`);
        chip.style.setProperty('--fy', `${flight.y * boxH}px`);
      } else {
        chip.style.setProperty('--fo', '0');
      }
    }

    setText(aiText, AI_INPUT_PROMPT.slice(0, Math.round(s.typedFraction * AI_INPUT_PROMPT.length)));
    setAttr(aiInput, 'data-typing', s.typing ? '1' : '0');

    stream?.style.setProperty('--lines', s.streamLines.toFixed(3));
    checks?.style.setProperty('--lines', s.checkLines.toFixed(3));
    setAttr(checks, 'data-done', s.checksDone ? '1' : '0');

    setView('prompt', s.views.prompt);
    setView('reject', s.views.reject);
    setView('commit', s.views.commit);
    setView('stream', s.views.stream);
    setView('json', s.views.json);

    setAttr(pCairn, 'data-active', s.cairnActive ? '1' : '0');
    setAttr(pAi, 'data-active', s.cairnActive ? '0' : '1');

    beats.forEach((b) => setAttr(b, 'data-on', Number(b.dataset.b) === s.beat ? '1' : '0'));
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
  const onResize = (): void => {
    measure();
    onScroll();
  };

  const mq = window.matchMedia(UNPINNED);
  let running: AbortController | null = null;

  const stop = (): void => {
    running?.abort();
    running = null;
  };

  const start = (): void => {
    stop();
    if (opts.reducedMotion || mq.matches) {
      paintStatic();
      return;
    }
    running = new AbortController();
    const { signal } = running;
    window.addEventListener('scroll', onScroll, { passive: true, signal });
    window.addEventListener('resize', onResize, { passive: true, signal });
    measure();
    onScroll();
  };

  const outer = new AbortController();
  mq.addEventListener('change', start, { signal: outer.signal });
  start();

  return () => {
    stop();
    outer.abort();
  };
}