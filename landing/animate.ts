export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - Math.pow(1 - c, 3);
}

export function countUpValue(to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return to;
  return Math.round(to * easeOutCubic(elapsedMs / durationMs));
}

export function ringOffset(pct: number): number {
  const c = pct < 0 ? 0 : pct > 100 ? 100 : pct;
  return 100 - c;
}

export type AnimateDeps = {
  reducedMotion: boolean;
  now?: () => number;
  raf?: (cb: FrameRequestCallback) => number;
  createObserver?: (cb: IntersectionObserverCallback) => { observe(el: Element): void };
};

function driveCountUp(el: HTMLElement, deps: AnimateDeps): void {
  const to = Number(el.dataset.countup ?? el.textContent ?? '0');
  const suffix = el.dataset.countupSuffix ?? '';
  const dur = Number(el.dataset.countupDur ?? 900);
  const render = (n: number) => {
    el.textContent = `${n}${suffix}`;
  };
  if (deps.reducedMotion || dur <= 0) {
    render(to);
    return;
  }
  const now = deps.now ?? (() => performance.now());
  const raf = deps.raf ?? ((cb) => requestAnimationFrame(cb));
  const start = now();
  const tick = () => {
    const elapsed = now() - start;
    render(countUpValue(to, elapsed, dur));
    if (elapsed < dur) raf(tick);
    else render(to);
  };
  raf(tick);
}

function driveRing(ring: HTMLElement): void {
  const raw =
    getComputedStyle(ring).getPropertyValue('--arc') || ring.style.getPropertyValue('--arc') || '0';
  ring.style.setProperty('--offset', String(ringOffset(Number(raw))));
  ring.classList.add('is-drawn'); // CSS transitions stroke-dashoffset to var(--offset)
}

export function animateGroup(group: Element, deps: AnimateDeps): void {
  group.querySelectorAll<HTMLElement>('[data-countup]').forEach((el) => driveCountUp(el, deps));
  group.querySelectorAll<HTMLElement>('.ring').forEach(driveRing);
  group.querySelectorAll('.bars').forEach((b) => b.classList.add('is-filled'));
}

export function setupDataAnimations(groups: Iterable<Element>, deps: AnimateDeps): void {
  const list = [...groups];
  if (deps.reducedMotion) {
    list.forEach((g) => animateGroup(g, deps));
    return;
  }
  const create =
    deps.createObserver ??
    (typeof IntersectionObserver !== 'undefined'
      ? (cb: IntersectionObserverCallback) =>
          new IntersectionObserver(cb, { rootMargin: '0px 0px -15% 0px' })
      : undefined);
  if (!create) {
    list.forEach((g) => animateGroup(g, deps));
    return;
  }
  const observer = create((entries, obs) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        animateGroup(entry.target, deps);
        obs.unobserve(entry.target);
      }
    }
  });
  list.forEach((g) => observer.observe(g));
}
