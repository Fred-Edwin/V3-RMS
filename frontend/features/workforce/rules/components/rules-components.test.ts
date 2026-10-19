import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { numberError, parseTyped } from '../change/number-editor';
import { TABS } from '../lib/tab-defs';
import { ATTENDANCE_ROWS } from '../tabs/attendance-tab';
import { CASUAL_ROWS } from '../tabs/casual-tab';
import { CONDUCT_LIMIT_ROWS } from '../tabs/conduct-tab';
import { LATENESS_ROWS } from '../tabs/lateness-tab';
import { OVERTIME_ROWS } from '../tabs/overtime-tab';
import { PROBATION_ROWS } from '../tabs/probation-tab';
import { WEEK_ROWS } from '../tabs/week-tab';
import { ChangeLink, lockedSentence } from './change-link';

describe('the trailing slot of a row', () => {
  it('writes the padlock sentence from the server list, never a person', () => {
    expect(lockedSentence([{ role: 'ACCOUNTANT' }], 'the holiday pay rate')).toBe('Only the Accountant can change the holiday pay rate. Ask the Accountant.');
    expect(lockedSentence([{ role: 'MANAGER', organizationName: 'Nyeri Town' }, { role: 'DIRECTOR' }, { role: 'SYSTEM_ADMIN' }], 'minimum cover')).toBe(
      'Only the Branch Manager of Nyeri Town, the Director or the System Admin can change minimum cover. Ask one of them.'
    );
  });
  it('is a real button that names its row; a locked one says so; Fixed is plain text', () => {
    const change = renderToStaticMarkup(createElement(ChangeLink, { thing: 'the grace period', state: { kind: 'change' } }));
    expect(change).toContain('aria-label="Change the grace period"');
    const locked = renderToStaticMarkup(createElement(ChangeLink, { thing: 'the grace period', state: { kind: 'locked', whoCan: [{ role: 'DIRECTOR' }] } }));
    expect(locked).toContain('aria-haspopup="dialog"');
    expect(locked).toContain('locked. Only the Director can change the grace period. Ask the Director.');
    expect(locked).not.toContain('disabled');
    const fixed = renderToStaticMarkup(createElement(ChangeLink, { thing: 'x', state: { kind: 'fixed' } }));
    expect(fixed).toContain('aria-label="Fixed, set by the system"');
    expect(fixed).not.toContain('<button');
  });
});

describe('typed numbers', () => {
  it('accepts whole numbers in range and refuses the rest in words', () => {
    const grace = { min: 0, max: 60, name: 'grace' };
    expect(parseTyped('10', grace)).toBe(10);
    expect(parseTyped('61', grace)).toBeNull();
    expect(parseTyped('1.5', grace)).toBeNull();
    expect(numberError(grace)).toBe('Use a whole number from 0 to 60');
  });
  it('keeps half-hour steps and decimals', () => {
    const cap = { min: 0, max: 168, decimals: 1, step: 0.5, name: 'cap' };
    expect(parseTyped('12.5', cap)).toBe(12.5);
    expect(parseTyped('12.3', cap)).toBeNull();
    expect(parseTyped('1.5', { min: 1, max: 5, decimals: 4, name: 'm' })).toBe(1.5);
  });
});

describe('every row a tab shows has an id the server knows', () => {
  const ids = (defs: readonly { id: string }[]): string[] => defs.map((d) => d.id);
  it('matches the catalogue in the back end', () => {
    expect(ids(LATENESS_ROWS)).toEqual(['graceMinutes', 'afterGrace', 'deductionCap', 'excuseWindow', 'makeUpSameDay']);
    expect(ids(OVERTIME_ROWS)).toEqual(['serviceTail', 'weeklyCap', 'branchBudget', 'approvalWindow', 'multiplier']);
    expect(ids(ATTENDANCE_ROWS)).toEqual(['clockInOpens', 'locationRadius', 'undoWindow', 'shiftEndPrompt', 'autoClose', 'clockSkew', 'rounding']);
    expect(ids(PROBATION_ROWS)).toEqual(['defaultMonths', 'extension', 'reminder', 'signedContract', 'reportDays']);
    expect(ids(CASUAL_ROWS)).toEqual(['whoRecords', 'whoApproves', 'cashHolder']);
    expect(ids(CONDUCT_LIMIT_ROWS)).toEqual(['acknowledgeWithin', 'appealWithin']);
    expect(ids(WEEK_ROWS)).toEqual(['weekStartsOn', 'unpaidBreak']);
    expect(TABS.map((t) => t.group)).toHaveLength(10);
  });
  it('a row the system sets has no editor', () => {
    expect(ATTENDANCE_ROWS.find((r) => r.id === 'rounding')?.Editor).toBeUndefined();
    expect(PROBATION_ROWS.find((r) => r.id === 'signedContract')?.Editor).toBeUndefined();
    expect(WEEK_ROWS.find((r) => r.id === 'unpaidBreak')?.Editor).toBeUndefined();
  });
});
