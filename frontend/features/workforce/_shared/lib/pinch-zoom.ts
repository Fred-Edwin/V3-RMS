/** Zoom limits of the Document view: 1 is "fitted to the width". */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 100) / 100));

/** Distance between two touch points. */
export const distance = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

/** The zoom after a pinch that started at `startZoom` with the fingers `startDistance` apart and now `now` apart. */
export const pinchedZoom = (startZoom: number, startDistance: number, now: number): number => (startDistance > 0 ? clampZoom(startZoom * (now / startDistance)) : startZoom);

/** A second tap within this many milliseconds is a double tap. */
export const DOUBLE_TAP_MS = 300;

/** "1 / 2": which page is in view, from the scroll position and each page's height. */
export function pageInView(scrollTop: number, viewportHeight: number, pageHeight: number, pages: number): number {
  if (pages <= 1 || pageHeight <= 0) return 1;
  const middle = scrollTop + viewportHeight / 2;
  return Math.min(pages, Math.max(1, Math.floor(middle / pageHeight) + 1));
}
