/**
 * The maths of the photo page (frame 8.5): a circle of `circle` pixels on screen, the photo behind it, a zoom from 1 to `MAX_ZOOM`
 * and a drag. At zoom 1 the photo just covers the circle. The circle can never show empty space, so the drag is clamped.
 */
export const MAX_ZOOM = 3;
export const OUTPUT_PIXELS = 512;

export interface PhotoSize {
  width: number;
  height: number;
}

/** Pixels on screen per pixel of the photo, at a zoom. */
export const scaleFor = (photo: PhotoSize, circle: number, zoom: number): number => (circle / Math.min(photo.width, photo.height)) * zoom;

/** How far the photo's centre may be dragged from the circle's centre, on each axis, without showing empty space. */
export function dragLimit(photo: PhotoSize, circle: number, zoom: number): { x: number; y: number } {
  const scale = scaleFor(photo, circle, zoom);
  return { x: Math.max(0, (photo.width * scale - circle) / 2), y: Math.max(0, (photo.height * scale - circle) / 2) };
}

export function clampDrag(photo: PhotoSize, circle: number, zoom: number, drag: { x: number; y: number }): { x: number; y: number } {
  const limit = dragLimit(photo, circle, zoom);
  return { x: Math.min(limit.x, Math.max(-limit.x, drag.x)), y: Math.min(limit.y, Math.max(-limit.y, drag.y)) };
}

/** The square of the original photo that sits inside the circle, in the photo's own pixels. */
export function cropSquare(photo: PhotoSize, circle: number, zoom: number, drag: { x: number; y: number }): { x: number; y: number; size: number } {
  const scale = scaleFor(photo, circle, zoom);
  const at = clampDrag(photo, circle, zoom, drag);
  const size = circle / scale;
  return { x: photo.width / 2 - (circle / 2 + at.x) / scale, y: photo.height / 2 - (circle / 2 + at.y) / scale, size };
}
