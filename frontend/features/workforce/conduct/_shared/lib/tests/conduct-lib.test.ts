import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';

import { clockTime, monthsBetween, shortDay, shortDayTime } from '../conduct-dates';
import { appealChips, conductError, deskTone, staffTone, waitSecondsOf } from '../conduct-words';

describe('Nairobi dates', () => {
  it('writes an instant in Nairobi time whatever the phone zone is', () => {
    // 13:42 UTC is 16:42 in Nairobi.
    expect(shortDayTime('2026-10-09T13:42:00.000Z')).toBe('Fri 9 Oct, 16:42');
    expect(clockTime('2026-10-09T21:30:00.000Z')).toBe('00:30');
    expect(shortDay('2026-10-09T21:30:00.000Z')).toBe('Sat 10 Oct');
  });
  it('counts whole months between the issue and end days', () => {
    expect(monthsBetween('2026-10-09T13:42:00.000Z', '2027-04-09')).toBe(6);
    expect(monthsBetween('2026-10-12T08:00:00.000Z', '2027-01-12')).toBe(3);
    // 31 Jan + 1 month ends 28 Feb (clamped): still one month.
    expect(monthsBetween('2027-01-31T08:00:00.000Z', '2027-02-28')).toBe(1);
  });
});

describe('appeal chips', () => {
  it('words the first two for lateness', () => {
    expect(appealChips('Lateness').map((c) => c.label)).toEqual(['Some of the dates are wrong', 'I had a good reason for being late', 'The warning is too strong', 'Something else']);
  });
  it('words them for other categories', () => {
    expect(appealChips('Behaviour').map((c) => c.label).slice(0, 2)).toEqual(['Some of the facts are wrong', 'I had a good reason']);
  });
});

describe('status tones', () => {
  it('shows a notice waiting to be signed in warning words', () => {
    expect(staffTone('ISSUED', true)).toBe('warning');
    expect(staffTone('SIGNED', false)).toBe('success');
    expect(staffTone('ENDED', false)).toBe('muted');
  });
  it('shows the desk words', () => {
    expect(deskTone('SIGNED')).toBe('success');
    expect(deskTone('GIVEN_NOT_SIGNED')).toBe('warning');
    expect(deskTone('WITHDRAWN')).toBe('muted');
  });
});

describe('refusals', () => {
  it('uses the spec words for a wrong code and a second appeal', () => {
    expect(conductError(new ApiError('x', 403, 'PIN_INVALID'), 'f')).toBe('That code is not right.');
    expect(conductError(new ApiError('x', 409, 'ALREADY_APPEALED'), 'f')).toBe('You have already appealed this notice.');
  });
  it('says there is no signal when the server never answered', () => {
    expect(conductError(new ApiError('x', 0, 'NETWORK'), 'f')).toContain('No signal');
  });
  it('keeps the server sentence for a code it does not know', () => {
    expect(conductError(new ApiError('Something exact', 400, 'SOMETHING'), 'f')).toBe('Something exact');
  });
  it('reads the wait the server gave', () => {
    expect(waitSecondsOf(new ApiError('x', 403, 'PIN_INVALID', { waitSeconds: 8 }))).toBe(8);
    expect(waitSecondsOf(new ApiError('x', 403, 'PIN_INVALID'))).toBe(0);
  });
});
