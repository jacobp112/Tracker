/**
 * Self-contained spring-physics animation for the Cairn stone-stack mascot.
 *
 * The physics is ported verbatim from the authored `cairn.svg` (an articulated
 * chain of springs — each stone pivots on its own base so motion accumulates up
 * the stack and the head whips like a real cairn — plus a morphing face with
 * blinks, gaze, and poke-triggered reactions). The only changes from the source
 * script are structural, so it can live inside a React component:
 *
 *   - the `<svg>` is passed in (not discovered via `document.currentScript`);
 *   - a cleanup function is returned that cancels the rAF loop, removes every
 *     listener/observer, clears the pending timer, and drops the global — the
 *     source ran for the page's lifetime and never tore any of that down;
 *   - if `requestAnimationFrame` is unavailable (e.g. jsdom in tests) it no-ops,
 *     leaving the SVG in its static authored pose.
 *
 * The SVG must contain the ids this drives: #cairn-seg1..4, #cairn-head,
 * #cairn-head-sq, #cairn-stone1-sq, #cairn-features, #cairn-eyes,
 * #cairn-eye-l/r, #cairn-mouth, #cairn-blush-l/r, #cairn-shadow.
 */

declare global {
  interface Window {
    triggerCairnWobble?: (s?: number) => void;
  }
}

/** Scalar spring: acc = w^2*(target-x) - 2*z*w*v */
class Spring {
  x: number;
  v = 0;
  k: number;
  c: number;
  constructor(x: number, w: number, z: number) {
    this.x = x;
    this.k = w * w;
    this.c = 2 * z * w;
  }
  step(dt: number, target: number, rate?: number) {
    const r = rate || 1;
    const a = this.k * r * r * (target - this.x) - this.c * r * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
  }
}

interface Seg {
  el: SVGElement;
  py: number;
  lever: number;
  a: number;
  v: number;
  k: number;
  c: number;
  iner: number;
}

export function startCairnAnimation(svg: SVGSVGElement | null): () => void {
  if (!svg || typeof requestAnimationFrame !== 'function') return () => {};

  const $ = (id: string) => svg.querySelector<SVGElement>('#' + id)!;
  const DEG = 180 / Math.PI;
  const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
  const n = (v: number) => Math.round(v * 100) / 100;

  const reduced = !!(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const AMP = reduced ? 0.35 : 1; // global sway multiplier — tune the whole feel here

  /* ---------- the stack ---------- */
  const segs: Seg[] = [
    { el: $('cairn-seg1'), py: 128, lever: 109, a: 0, v: 0, k: 150, c: 4.8, iner: 0.0 },
    { el: $('cairn-seg2'), py: 102, lever: 83, a: 0, v: 0, k: 195, c: 4.6, iner: 0.55 },
    { el: $('cairn-seg3'), py: 78, lever: 59, a: 0, v: 0, k: 245, c: 4.4, iner: 0.6 },
    { el: $('cairn-seg4'), py: 56, lever: 37, a: 0, v: 0, k: 300, c: 4.2, iner: 0.65 },
  ];
  const head = { el: $('cairn-head'), a: 0, v: 0, k: 330, c: 5.0, iner: 0.7 };
  const RIGHT = 0.42; // how hard he fights to stay upright
  const DRAG = 0.6; // air drag on world angular velocity

  const hop = new Spring(0, 18, 0.42); // head bob
  const squash = new Spring(0, 22, 0.7); // head squash & stretch
  const baseSq = new Spring(0, 20, 0.7); // base stone compression
  const gazeX = new Spring(0, 30, 0.7);
  const gazeY = new Spring(0, 30, 0.7);

  /* ---------- expression: one face, all values morph ---------- */
  const POSE: Record<string, Record<string, number>> = {
    idle: { eW: 2.35, eU: -1.55, eL: -0.5, eTilt: 0, mW: 3.3, mU: 0.85, mL: 2.0, mY: 22.6, mWv: 0, blush: 1.0 },
    startle: { eW: 2.0, eU: -2.05, eL: 2.05, eTilt: 0, mW: 1.15, mU: -1.1, mL: 1.1, mY: 23.9, mWv: 0, blush: 0.85 },
    worry: { eW: 1.65, eU: -2.0, eL: 2.0, eTilt: 10, mW: 2.4, mU: -0.75, mL: 0.15, mY: 23.7, mWv: 0.55, blush: 0.9 },
    cool: { eW: 2.1, eU: -2.25, eL: 2.2, eTilt: -5, mW: 1.45, mU: -1.25, mL: 1.25, mY: 23.8, mWv: 0, blush: 1.05 },
    happy: { eW: 2.4, eU: -1.6, eL: -0.45, eTilt: 0, mW: 3.45, mU: 0.95, mL: 2.15, mY: 22.5, mWv: 0, blush: 1.15 },
  };
  const KEYS = Object.keys(POSE.idle!);
  const F: Record<string, Spring> = {};
  KEYS.forEach((k) => {
    F[k] = new Spring(POSE.idle![k]!, 20, 0.62);
  });

  let phase = 'idle';
  let phaseT = 0;
  let blend = 1;
  let time = 0;
  let amp = 0;
  let lean = 0;
  let wAcc = 0;
  let blinkT = -1;
  let blinkDur = 0.14;
  let headBias = 0;
  let nextBlink = 2 + Math.random() * 3;
  let nextLook = 1.5 + Math.random() * 2;
  let idleGaze = [0, 0];

  function setPhase(p: string) {
    phase = p;
    phaseT = 0;
    if (p === 'startle') {
      blend = 2.4;
      blinkT = -1;
      hop.v += 9;
    }
    if (p === 'worry') {
      blend = 1.3;
    }
    if (p === 'cool') {
      blend = 1.7;
      blinkT = 0;
      blinkDur = 0.13;
      headBias = 0.055;
    }
    if (p === 'settle') {
      blend = 1.1;
      blinkT = 0;
      blinkDur = 0.3;
      headBias = 0;
      hop.v -= 20;
    }
    if (p === 'idle') {
      blend = 1.0;
      nextBlink = time + 2 + Math.random() * 3;
    }
  }

  function trigger(strength?: number) {
    const s = (typeof strength === 'number' ? strength : 1) * (reduced ? 0.6 : 1);
    segs[0]!.v += 1.35 * s;
    baseSq.v += 8 * s;
    setPhase('startle');
  }

  /* ---------- simulation ---------- */
  function step(dt: number) {
    time += dt;
    phaseT += dt;

    if (phase === 'startle' && phaseT > 0.17) setPhase('worry');
    else if (phase === 'worry' && ((phaseT > 0.7 && amp < 8.5) || phaseT > 1.15)) setPhase('cool');
    else if (phase === 'cool' && phaseT > 0.65) setPhase('settle');
    else if (phase === 'settle' && phaseT > 0.5) setPhase('idle');

    /* Every stone is dragged by the elastic pull of everything below it, so
       motion accumulates up the stack. Coupling uses only the parents' spring
       term — feeding their damping term back in would inject energy and the
       stack would ring forever. DRAG on world velocity guarantees it dies. */
    let wEl = 0;
    let wVel = 0;
    let chain = 0;
    let breeze = 0;
    if (!reduced) {
      breeze =
        Math.sin(time * 0.55) * 0.9 +
        Math.sin(time * 1.13 + 1.7) * 0.55 +
        Math.sin(time * 2.31 + 0.4) * 0.2;
    }
    let disp = 0;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!;
      const elast = -s.k * s.a;
      let acc = elast - s.c * s.v - s.iner * wEl - DRAG * wVel;
      if (i === 0) acc += breeze;
      s.v += acc * dt;
      s.a += s.v * dt;
      wEl += elast;
      wVel += s.v;
      chain += s.a;
      disp += s.lever * s.a;
    }
    const hEl = head.k * (-RIGHT * chain + headBias - head.a);
    const hacc = hEl - head.c * head.v - head.iner * wEl - DRAG * wVel;
    head.v += hacc * dt;
    head.a += head.v * dt;
    wAcc = wEl + hacc;

    lean = (chain + head.a) * DEG * AMP;
    disp = Math.abs(disp) * AMP;
    amp = disp > amp ? disp : amp + (disp - amp) * Math.min(1, dt * 2.2);

    hop.step(dt, 0, 1);
    squash.step(dt, clamp(wAcc * 0.0016, -0.07, 0.07), 1);
    baseSq.step(dt, 0, 1);

    /* gaze */
    let gx = 0;
    let gy = 0;
    if (phase === 'startle') {
      gx = clamp(lean * 0.05, -0.6, 0.6);
      gy = -0.1;
    } else if (phase === 'worry') {
      gx = clamp(lean * 0.085, -1, 1);
      gy = 0.92;
    } else if (phase === 'cool') {
      gx = phaseT < 0.3 ? 0.72 : -0.58;
      gy = phaseT < 0.3 ? -0.3 : -0.46;
    } else if (phase === 'settle') {
      gx = 0;
      gy = 0.06;
    } else {
      if (time > nextLook) {
        idleGaze = [(Math.random() * 2 - 1) * 0.45, (Math.random() * 2 - 1) * 0.3];
        nextLook = time + 1.6 + Math.random() * 2.6;
      }
      gx = idleGaze[0]! + Math.sin(time * 0.7) * 0.05;
      gy = idleGaze[1]! + Math.sin(time * 0.9 + 1) * 0.04;
    }
    gazeX.step(dt, gx, 1);
    gazeY.step(dt, gy, 1);

    /* expression morph */
    const pose = POSE[phase === 'settle' ? 'happy' : phase === 'idle' ? 'happy' : phase] ?? POSE.idle!;
    for (const key of KEYS) F[key]!.step(dt, pose[key]!, blend);
    blend += (1 - blend) * Math.min(1, dt * 4);

    /* blinks */
    if (blinkT >= 0) {
      blinkT += dt;
      if (blinkT > blinkDur) blinkT = -1;
    } else if (phase === 'idle' && time > nextBlink) {
      blinkT = 0;
      blinkDur = 0.13 + Math.random() * 0.05;
      nextBlink = time + 2.4 + Math.random() * 3.6;
    }
  }

  /* ---------- drawing ---------- */
  const el = {
    stone1: $('cairn-stone1-sq'),
    headSq: $('cairn-head-sq'),
    feat: $('cairn-features'),
    eyes: $('cairn-eyes'),
    eyeL: $('cairn-eye-l'),
    eyeR: $('cairn-eye-r'),
    mouth: $('cairn-mouth'),
    blushL: $('cairn-blush-l'),
    blushR: $('cairn-blush-r'),
    shadow: $('cairn-shadow'),
  };
  const scaleAbout = (sx: number, sy: number, cx: number, cy: number) =>
    'translate(' +
    n(cx) +
    ' ' +
    n(cy) +
    ') scale(' +
    n(sx) +
    ' ' +
    n(sy) +
    ') translate(' +
    n(-cx) +
    ' ' +
    n(-cy) +
    ')';

  /* Every mark is the same primitive: a closed shape between two curved edges. */
  function lens(cx: number, cy: number, w: number, u: number, l: number, wv: number) {
    const r = clamp(0.45 + 0.55 * (Math.abs(l - u) / (2 * w)), 0.45, 1);
    const A = u * 1.3333;
    const B = l * 1.3333;
    const xl = n(cx - w);
    const xr = n(cx + w);
    const c1 = n(cx - w * r);
    const c2 = n(cx + w * r);
    return (
      'M' +
      xl +
      ' ' +
      n(cy) +
      ' C' +
      c1 +
      ' ' +
      n(cy + A + wv) +
      ' ' +
      c2 +
      ' ' +
      n(cy + A - wv) +
      ' ' +
      xr +
      ' ' +
      n(cy) +
      ' C' +
      c2 +
      ' ' +
      n(cy + B - wv * 0.6) +
      ' ' +
      c1 +
      ' ' +
      n(cy + B + wv * 0.6) +
      ' ' +
      xl +
      ' ' +
      n(cy) +
      'Z'
    );
  }

  function render() {
    let chain = 0;
    for (let i = 0; i < segs.length; i++) {
      chain += segs[i]!.a;
      segs[i]!.el.setAttribute(
        'transform',
        'rotate(' + n(segs[i]!.a * DEG * AMP) + ' 50 ' + segs[i]!.py + ')',
      );
    }
    head.el.setAttribute(
      'transform',
      'translate(' +
        n(-chain * 2.5 * AMP) +
        ' ' +
        n(hop.x) +
        ') rotate(' +
        n(head.a * DEG * AMP) +
        ' 50 35)',
    );
    el.headSq.setAttribute('transform', scaleAbout(1 + squash.x, 1 - squash.x, 50, 19));
    el.stone1.setAttribute(
      'transform',
      scaleAbout(1 + baseSq.x * 0.12, 1 - baseSq.x * 0.12, 50, 128),
    );

    const gx = gazeX.x;
    const gy = gazeY.x;
    /* the whole face slides across the curve, the eyes travel further */
    el.feat.setAttribute('transform', 'translate(' + n(gx * 0.7) + ' ' + n(gy * 0.55) + ')');
    const lag = clamp(-(head.v + segs[3]!.v) * 0.045, -0.6, 0.6);
    el.eyes.setAttribute('transform', 'translate(' + n(gx * 1.5 + lag) + ' ' + n(gy * 1.45) + ')');

    /* blink: the eye shape flattens to a line about its own midline */
    const blink = blinkT >= 0 ? Math.sin(Math.PI * (blinkT / blinkDur)) : 0;
    let eUp = F.eU!.x;
    let eLo = F.eL!.x;
    const mid = (eUp + eLo) / 2;
    eUp += (mid - 0.26 - eUp) * blink;
    eLo += (mid + 0.26 - eLo) * blink;
    const tilt = F.eTilt!.x;
    const ew = F.eW!.x;
    el.eyeL.setAttribute('d', lens(46.3, 16.2, ew, eUp, eLo, 0));
    el.eyeR.setAttribute('d', lens(53.7, 16.2, ew, eUp, eLo, 0));
    el.eyeL.setAttribute('transform', 'rotate(' + n(-tilt) + ' 46.3 16.2)');
    el.eyeR.setAttribute('transform', 'rotate(' + n(tilt) + ' 53.7 16.2)');

    el.mouth.setAttribute('d', lens(50, F.mY!.x, F.mW!.x, F.mU!.x, F.mL!.x, F.mWv!.x));

    const bl = F.blush!.x;
    el.blushL.setAttribute('transform', scaleAbout(bl, bl, 42.3, 20.4));
    el.blushR.setAttribute('transform', scaleAbout(bl, bl, 57.7, 20.4));

    const sway = clamp(chain * DEG * AMP, -30, 30);
    el.shadow.setAttribute(
      'transform',
      'translate(' +
        n(sway * 0.28) +
        ' 0) ' +
        scaleAbout(1 - Math.abs(sway) * 0.007 + baseSq.x * 0.004, 1, 50, 126),
    );
  }

  /* ---------- loop ---------- */
  const STEP = 1 / 120;
  let acc = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 24) {
      step(STEP);
      acc -= STEP;
    }
    render();
  }
  function start() {
    if (!running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  function stop() {
    if (running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  let cooldown = 0;
  function onPoke() {
    const t = Date.now();
    if (t - cooldown < 260) return;
    cooldown = t;
    trigger(1);
  }
  svg.addEventListener('mouseenter', onPoke);
  svg.addEventListener('click', onPoke);
  svg.addEventListener('touchstart', onPoke, { passive: true });
  svg.addEventListener('focus', onPoke);

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }
  document.addEventListener('visibilitychange', onVisibility);

  let io: IntersectionObserver | null = null;
  if (window.IntersectionObserver) {
    io = new IntersectionObserver(
      (entries) => {
        if (entries[0]!.isIntersecting) start();
        else stop();
      },
      { threshold: 0 },
    );
    io.observe(svg);
  } else {
    start();
  }
  start();

  let firstPoke = 0;
  if (!reduced) firstPoke = window.setTimeout(() => trigger(0.85), 700);
  window.triggerCairnWobble = (s?: number) => trigger(s);

  return function cleanup() {
    stop();
    if (firstPoke) clearTimeout(firstPoke);
    if (io) io.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    svg.removeEventListener('mouseenter', onPoke);
    svg.removeEventListener('click', onPoke);
    svg.removeEventListener('touchstart', onPoke);
    svg.removeEventListener('focus', onPoke);
    delete window.triggerCairnWobble;
  };
}
