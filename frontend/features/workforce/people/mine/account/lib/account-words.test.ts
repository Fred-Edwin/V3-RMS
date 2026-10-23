import { describe, expect, it } from 'vitest';

import { checkPasswordChange, notificationsLine } from './account-words';

describe('notificationsLine', () => {
  it('names the device', () => {
    expect(notificationsLine('default', false, 'computer')).toBe('Off on this computer');
    expect(notificationsLine('default', false, 'phone')).toBe('Off on this phone');
    expect(notificationsLine('granted', false, 'phone')).toBe('On, on this phone');
  });
  it('says when it is blocked, unsupported or busy', () => {
    expect(notificationsLine('denied', false, 'computer')).toMatch(/^Blocked/);
    expect(notificationsLine('unsupported', false, 'computer')).toBe('Not available on this computer');
    expect(notificationsLine('default', true, 'computer')).toBe('Turning on…');
  });
});

describe('checkPasswordChange', () => {
  it('passes a good change', () => {
    expect(checkPasswordChange({ current: 'old-pass', next: 'new-pass-1', again: 'new-pass-1' })).toEqual({});
  });
  it('asks for every field', () => {
    expect(Object.keys(checkPasswordChange({ current: '', next: '', again: 'x' })).sort()).toEqual(['again', 'current', 'next']);
  });
  it('refuses the same password and a mismatch', () => {
    expect(checkPasswordChange({ current: 'abcdefgh', next: 'abcdefgh', again: 'abcdefgh' }).next).toBeDefined();
    expect(checkPasswordChange({ current: 'a', next: 'abcdefgh', again: 'abcdefgx' }).again).toBe('The two passwords are different.');
  });
});
