import { describe, expect, it } from 'vitest';
import { clampDrag, cropSquare, dragLimit } from './photo-crop';

const wide = { width: 2000, height: 1000 };

describe('photo crop', () => {
  it('at zoom 1 a wide photo can only slide sideways', () => {
    expect(dragLimit(wide, 300, 1)).toEqual({ x: 150, y: 0 });
  });
  it('never lets the circle show empty space', () => {
    expect(clampDrag(wide, 300, 1, { x: 900, y: 50 })).toEqual({ x: 150, y: 0 });
    expect(clampDrag(wide, 300, 2, { x: 0, y: 900 }).y).toBe(150);
    expect(clampDrag(wide, 300, 2, { x: -900, y: 0 }).x).toBe(-450);
  });
  it('crops the centre square with no drag, and moves it with a drag', () => {
    expect(cropSquare(wide, 300, 1, { x: 0, y: 0 })).toEqual({ x: 500, y: 0, size: 1000 });
    // Dragging the photo right shows more of its left side.
    expect(cropSquare(wide, 300, 1, { x: 300, y: 0 }).x).toBe(0);
  });
  it('shows a smaller square when zoomed in', () => {
    expect(cropSquare(wide, 300, 2, { x: 0, y: 0 }).size).toBe(500);
  });
});
