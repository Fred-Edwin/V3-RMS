import { describe, expect, it } from 'vitest';
import { ApiError } from '@/types/api';
import { describePrepError } from './prep-errors';
import { formatKes, formatKesCompact } from './prep-format';

describe('describePrepError', () => {
  const fallback = "Couldn't do it. Try again.";
  it('says what RUN_NOT_OPEN and EXPORT_TOO_LARGE mean, never the code', () => {
    expect(describePrepError(new ApiError('x', 409, 'RUN_NOT_OPEN'), fallback)).toMatch(/cancelled or corrected/);
    expect(describePrepError(new ApiError('x', 422, 'EXPORT_TOO_LARGE'), fallback)).toMatch(/10,000/);
  });
  it('maps 401, 403, 404 and 5xx to plain sentences', () => {
    expect(describePrepError(new ApiError('x', 401, 'AUTHENTICATION_ERROR'), fallback)).toMatch(/Sign in again/);
    expect(describePrepError(new ApiError('x', 403, 'AUTHORIZATION_ERROR'), fallback)).toMatch(/Store Manager/);
    expect(describePrepError(new ApiError('x', 404, 'NOT_FOUND'), fallback)).toMatch(/could not be found/);
    expect(describePrepError(new ApiError('x', 503, 'SERVICE_UNAVAILABLE'), fallback)).toContain(fallback);
  });
  it('reads a network failure as offline', () => {
    expect(describePrepError(new TypeError('Failed to fetch'), fallback)).toMatch(/offline/);
  });
  it('falls back to the screen line for anything else, hiding the raw message', () => {
    expect(describePrepError(new ApiError('Request failed', 400, 'VALIDATION_ERROR'), fallback)).toBe(fallback);
    expect(describePrepError(new Error('boom'), fallback)).toBe(fallback);
  });
});

describe('money', () => {
  it('compacts the KPI value', () => {
    expect(formatKesCompact('52340')).toBe('KES 52K');
    expect(formatKesCompact('828')).toBe('KES 828');
    expect(formatKesCompact('1250000')).toBe('KES 1.3M');
    expect(formatKesCompact('0')).toBe('KES 0');
    expect(formatKesCompact('nope')).toBe('KES 0');
  });
  it('writes whole shillings with separators', () => {
    expect(formatKes('3900')).toBe('KES 3,900');
  });
});
