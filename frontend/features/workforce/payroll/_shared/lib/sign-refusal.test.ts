import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';

import type { TabKey } from '../types/month-types';
import { defaultTab, signRefusal } from './month-view';

describe('what a refused signature says (the PIN dialog every signed act uses)', () => {
  it('says a wrong PIN in words and does not call the month stale', () => {
    const refusal = signRefusal(new ApiError('Forbidden', 403, 'PIN_INVALID'));
    expect(refusal).toEqual({ code: 'PIN_INVALID', words: 'That PIN is not right.', stale: false });
  });

  it('asks for a new key and a reload when the month moved underneath', () => {
    for (const code of ['CHANGED_UNDERNEATH', 'MONTH_LOCKED', 'ALREADY_PAID', 'ALREADY_PUBLISHED', 'ALREADY_APPROVED']) {
      expect(signRefusal(new ApiError('x', 409, code)).stale, code).toBe(true);
    }
  });

  it('uses the server words for a code it has no wording for, and a plain line when the connection drops', () => {
    expect(signRefusal(new ApiError('Pick a reason first', 400, 'REASON_REQUIRED')).words).toBe('Pick a reason first');
    const dropped = signRefusal(new TypeError('Failed to fetch'));
    expect(dropped.code).toBe('');
    expect(dropped.stale).toBe(false);
    expect(dropped.words).toMatch(/Nothing was changed/);
  });
});

describe('which tab a month opens on', () => {
  const all: TabKey[] = ['timesheets', 'rules', 'tax', 'casual', 'totals', 'payslips'];
  it('opens on Totals for the person who has lines to check while the month is in review', () => {
    expect(defaultTab('IN_REVIEW', true, all)).toBe('totals');
  });
  it('opens on Timesheets for everyone else, and in every other state', () => {
    expect(defaultTab('IN_REVIEW', false, all)).toBe('timesheets');
    expect(defaultTab('TO_APPROVE', true, all)).toBe('timesheets');
    expect(defaultTab('IN_REVIEW', true, ['timesheets'])).toBe('timesheets');
  });
});
