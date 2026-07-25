export function revealElement(el: Element): void {
  el.classList.add('is-visible');
}

export function makeRevealHandler(): IntersectionObserverCallback {
  return (entries, observer) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        revealElement(entry.target);
        observer.unobserve(entry.target);
      }
    }
  };
}

export function setupReveals(
  els: Iterable<Element>,
  opts: {
    reducedMotion: boolean;
    createObserver?: (cb: IntersectionObserverCallback) => { observe(el: Element): void };
  },
): void {
  const list = [...els];
  if (opts.reducedMotion) {
    list.forEach(revealElement);
    return;
  }
  // An injected observer factory always wins; otherwise use the native
  // IntersectionObserver when present. With neither (e.g. no-JS-era browsers),
  // fall back to revealing everything so content is never stranded hidden.
  const create =
    opts.createObserver ??
    (typeof IntersectionObserver !== 'undefined'
      ? (cb: IntersectionObserverCallback) =>
          new IntersectionObserver(cb, { rootMargin: '0px 0px -10% 0px' })
      : undefined);
  if (!create) {
    list.forEach(revealElement);
    return;
  }
  const observer = create(makeRevealHandler());
  list.forEach((el) => observer.observe(el));
}
