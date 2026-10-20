import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';

import { MESSAGES, failureKind, lineForError, messageFor, secondLineFor, waitSecondsOf } from './messages';

/** The codes 6b M1 names. Each must be in the table AND still declared by the server (a rename there fails this test). */
const SERVER_CODES = [
  'CODE_WRONG',
  'CODE_SLOWED',
  'PIN_INVALID',
  'PIN_SLOWED',
  'PIN_NOT_SET',
  'CHANGED_UNDERNEATH',
  'PEOPLE_CANNOT_BE_PAID',
  'MONTH_NOT_CALCULABLE',
  'MONTH_LOCKED',
  'BANK_FILE_CHANGED',
  'PERIOD_APPROVED',
  'ALREADY_DECIDED',
  'ALREADY_APPROVED',
  'ALREADY_CLEARED',
  'RATE_LIMITED',
  'SESSION_ENDED',
  'PHONE_REMOVED',
  'PASSWORD_RESET_REQUIRED',
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

describe('the message table', () => {
  it('has every code the spec names', () => {
    for (const code of SERVER_CODES) expect(MESSAGES[code], code).toBeDefined();
  });

  it('only holds codes the server still declares', () => {
    const backend = join(process.cwd(), '..', 'backend', 'src');
    const text = sourceFiles(backend).map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const code of SERVER_CODES) expect(text.includes(`'${code}'`), `${code} is no longer in the back end`).toBe(true);
  });

  it('writes the exact words of the spec', () => {
    expect(messageFor('PIN_INVALID')).toBe('That PIN is not right. Try again.');
    expect(messageFor('PIN_SLOWED', { waitSeconds: 8 })).toBe('Wait 8 seconds, then try again.');
    expect(messageFor('PIN_NOT_SET')).toBe('Set your signing PIN first.');
    expect(messageFor('PERIOD_APPROVED')).toBe('This month is approved. Tell HR.');
    expect(messageFor('MONTH_LOCKED', { date: '30 Oct' })).toBe('This month is locked. It was marked as paid on 30 Oct. Nothing can change.');
    expect(secondLineFor('MONTH_LOCKED')).toBe("Changes to a paid month go through support, or into next month's payroll.");
    expect(messageFor('ALREADY_DECIDED', { role: 'Branch Manager', time: '10:42' })).toBe('Decided by Branch Manager at 10:42. Check it again.');
    expect(messageFor('PEOPLE_CANNOT_BE_PAID', { name: 'Amina Hassan', role: 'Barista', month: 'October' })).toBe('Amina Hassan, Barista has no pay profile and is left out of October.');
    expect(messageFor('NOT_A_CODE')).toBeNull();
  });

  it('never talks about a lock or a lockout', () => {
    const all = Object.keys(MESSAGES).map((c) => messageFor(c, { waitSeconds: 8 }) ?? '').join(' ').toLowerCase();
    expect(all).not.toMatch(/locked out|lockout|account is locked|ten minutes/);
  });

  it('holds no pay figure', () => {
    const all = Object.keys(MESSAGES).map((c) => messageFor(c, { waitSeconds: 8, month: 'October' }) ?? '').join(' ');
    expect(all).not.toMatch(/KES|Ksh|\d,\d{3}/);
  });
});

describe('how a failure is answered', () => {
  it('picks the card or the line from the status and code', () => {
    expect(failureKind(409, 'CHANGED_UNDERNEATH')).toBe('conflict');
    expect(failureKind(404, 'NOT_FOUND')).toBe('not-in-menu');
    expect(failureKind(500, 'INTERNAL_ERROR')).toBe('fault');
    expect(failureKind(401, 'SESSION_ENDED')).toBe('sign-in');
    expect(failureKind(400, 'VALIDATION_ERROR')).toBe('line');
  });

  it('reads the pause from the answer and caps it', () => {
    expect(waitSecondsOf(new ApiError('x', 429, 'PIN_SLOWED', { waitSeconds: 16 }))).toBe(16);
    expect(waitSecondsOf(new ApiError('x', 429, 'PIN_SLOWED', { waitSeconds: 9999 }))).toBe(120);
    expect(waitSecondsOf(new ApiError('x', 403, 'PIN_INVALID'))).toBe(0);
    expect(waitSecondsOf(new Error('x'))).toBe(0);
  });

  it('turns an error into one line: the table, else the server’s own words, else the fallback', () => {
    expect(lineForError(new ApiError('Server words', 429, 'PIN_SLOWED', { waitSeconds: 4 }), 'fb')).toBe('Wait 4 seconds, then try again.');
    expect(lineForError(new ApiError('Slow down', 429, 'WHATEVER'), 'fb')).toBe('Too many tries. Wait a moment, then try again.');
    expect(lineForError(new ApiError('End must be after start.', 400, 'VALIDATION_ERROR'), 'fb')).toBe('End must be after start.');
    expect(lineForError(new Error('boom'), 'fb')).toBe('fb');
  });
});
