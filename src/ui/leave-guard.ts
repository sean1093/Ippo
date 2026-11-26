/**
 * Lets the page on screen hold the learner back from leaving it — the
 * browser's back gesture included, which never passes through the page's own
 * close button. At most one guard; the router drops it on every page change.
 */
let guard: (() => boolean) | null = null;

/** While `mayLeave` is set, leaving asks it first; it returns whether to go. Returns a release. */
export function guardLeave(mayLeave: () => boolean): () => void {
  guard = mayLeave;
  return () => {
    if (guard === mayLeave) guard = null;
  };
}

/** For the router: whether the page on screen lets the learner go. */
export function mayLeave(): boolean {
  return guard?.() ?? true;
}

/** For the router, once a new page is drawn: the old page's guard no longer applies. */
export function clearGuard(): void {
  guard = null;
}
