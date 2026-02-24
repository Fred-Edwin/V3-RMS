import { describe, expect, it } from 'vitest';
import { haversineDistanceMetres } from './haversine';

describe('haversineDistanceMetres', () => {
  it('returns approximately 1km for known coordinate pair', () => {
    const distance = haversineDistanceMetres(-0.4167, 36.95, -0.4077, 36.95);
    expect(distance).toBeGreaterThan(990);
    expect(distance).toBeLessThan(1_010);
  });

  it('returns 0 for identical points', () => {
    const distance = haversineDistanceMetres(-0.4167, 36.95, -0.4167, 36.95);
    expect(distance).toBe(0);
  });
});
