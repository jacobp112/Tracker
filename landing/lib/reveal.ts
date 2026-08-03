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
    /*
     * Must declare unobserve, not just observe: makeRevealHandler calls
     * observer.unobserve() on every element it reveals. The old signature
     * promised only observe(), so a test fake returning { observe } typechecked
     * cleanly and then threw "unobserve is not a function" the moment the
     * callback fired on an intersecting entry — a runtime failure the types
     * were actively concealing.
     */
    createObserver?: (
      cb: IntersectionObserverCallback,
    ) => Pick<IntersectionObserver, 'observe' | 'unobserve'>;
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
