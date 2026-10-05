/** Far enough to mean it, in CSS pixels. */
const DISTANCE = 64;
/** A swipe is horizontal: anything flatter than this is a scroll. */
const FLATNESS = 2;
/** Longer than this is a drag, not a flick. */
const TIME = 800;
/** The phone's own back gesture lives in this strip; never fight it. */
const EDGE = 24;
/** Controls and anything that scrolls or drags sideways keep their own gestures. */
const KEEPS_GESTURE = "button, a, input, textarea, select, [data-no-swipe]";

/**
 * Horizontal swipes on `el`, which must also be allowed to scroll vertically
 * (`touch-action: pan-y`). `handler` gets -1 for a swipe to the right (back)
 * and 1 for a swipe to the left (forward), reading as "which way the content
 * moves". Pointer events cover touch, pen and mouse in one path.
 */
export function onSwipe(el: HTMLElement, handler: (direction: -1 | 1) => void): void {
  let start: { x: number; y: number; at: number } | null = null;

  el.addEventListener("pointerdown", (event) => {
    start = null;
    if (!event.isPrimary) return;
    if ((event.target as Element | null)?.closest(KEEPS_GESTURE)) return;
    if (event.clientX < EDGE || event.clientX > window.innerWidth - EDGE) return;
    start = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  });

  el.addEventListener("pointercancel", () => {
    start = null;
  });

  el.addEventListener("pointerup", (event) => {
    const from = start;
    start = null;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (event.timeStamp - from.at > TIME) return;
    if (Math.abs(dx) < DISTANCE || Math.abs(dx) <= FLATNESS * Math.abs(dy)) return;
    handler(dx < 0 ? 1 : -1);
  });
}
