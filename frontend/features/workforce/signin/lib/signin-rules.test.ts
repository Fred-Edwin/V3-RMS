import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';
import { deviceLabel, initialsOf, noticeFor, pausedMessage, pinProblem } from './signin-rules';

describe('noticeFor', () => {
  it('says offline before anything else', () => {
    expect(noticeFor(new ApiError('x', 401, 'AUTHENTICATION_ERROR'), false).kind).toBe('offline');
  });

  it('tells a wrong password in plain words, with no code', () => {
    const notice = noticeFor(new ApiError('Invalid credentials', 401, 'AUTHENTICATION_ERROR'), true);
    expect(notice).toEqual({ kind: 'wrong', message: 'That email or password is not right. Check them and try again.' });
  });

  it('turns the server pause into a wait, never a lock', () => {
    const notice = noticeFor(new ApiError('Too many tries', 429, 'LOGIN_SLOWED', { waitSeconds: 8 }), true);
    expect(notice).toMatchObject({ kind: 'paused', waitSeconds: 8, message: 'Too many tries. Wait 8 seconds, then try again.' });
    expect(notice.message.toLowerCase()).not.toContain('lock');
  });

  it('keeps the server words for an expired temporary password', () => {
    const message = 'This temporary password has expired. Ask HR for a new one.';
    expect(noticeFor(new ApiError(message, 401, 'TEMPORARY_PASSWORD_EXPIRED'), true)).toEqual({ kind: 'other', message });
  });

  it('falls back to one plain sentence for anything else', () => {
    expect(noticeFor(new Error('boom'), true).message).toBe('Something went wrong. Try again.');
  });
});

describe('pausedMessage', () => {
  it('counts one second in the singular and ends at zero', () => {
    expect(pausedMessage(1)).toBe('Too many tries. Wait 1 second, then try again.');
    expect(pausedMessage(0)).toBe('You can try again now.');
  });
});

describe('pinProblem', () => {
  it('refuses 1234, one repeated digit and anything that is not four digits', () => {
    expect(pinProblem('1234')).toMatch(/1234/);
    expect(pinProblem('7777')).toMatch(/same digit/);
    expect(pinProblem('123')).toBe('Use four digits.');
    expect(pinProblem('12a4')).toBe('Use four digits.');
  });

  it('accepts an ordinary PIN', () => {
    expect(pinProblem('4821')).toBeNull();
    expect(pinProblem('0000')).not.toBeNull();
  });
});

describe('deviceLabel', () => {
  it('names the browser and the system, or the phone', () => {
    expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36')).toEqual({ label: 'Chrome on Linux', kind: 'computer' });
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/125.0')).toEqual({ label: 'Firefox on Windows', kind: 'computer' });
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 13; TECNO) Chrome/124.0 Mobile Safari/537.36')).toEqual({ label: 'Android phone', kind: 'phone' });
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1')).toEqual({ label: 'Safari on iPhone', kind: 'phone' });
  });
});

describe('small helpers', () => {
  it('takes initials from first and last name', () => {
    expect(initialsOf('Mercy Wanjiru Achieng')).toBe('MA');
    expect(initialsOf('Fred')).toBe('F');
  });
});
