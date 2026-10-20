import { describe, expect, it } from 'vitest';

import type { MonthCapabilities, MonthListRow, StageView } from '../types/month-types';
import { activeTab, defaultMonth, headerAction, headerActionLabel, listLine, refusalWords, sendBlockedReason, stageSpoken } from './month-view';

const none: MonthCapabilities = { canReview: false, canSendToAccountant: false, canApprove: false, canPublish: false, canPay: false, canCorrect: false, canExport: false, canRemind: false, canApproveSiteLate: false };
const row = (monthKey: string, state: MonthListRow['state']): MonthListRow => ({ monthKey, label: monthKey, state, stateVersion: 1, netPay: '3168500.00', estimate: null, sitesApproved: { approved: 3, total: 4 }, documentNumber: null, tabs: ['timesheets'] });

describe('which month opens', () => {
  it('is the oldest month that is not paid', () => {
    expect(defaultMonth([row('2026-10', 'OPEN'), row('2026-09', 'WAITING'), row('2026-08', 'PAID')])).toBe('2026-09');
  });
  it('is the newest when everything is paid, and null when there are none', () => {
    expect(defaultMonth([row('2026-09', 'PAID'), row('2026-08', 'PAID')])).toBe('2026-09');
    expect(defaultMonth([])).toBeNull();
  });
});

describe('tabs', () => {
  it('falls back to Timesheets for a tab that is off or unknown', () => {
    expect(activeTab('totals', ['timesheets'])).toBe('timesheets');
    expect(activeTab('nonsense', ['timesheets', 'totals'])).toBe('timesheets');
    expect(activeTab('totals', ['timesheets', 'totals'])).toBe('totals');
  });
});

describe('the one brown button', () => {
  it('follows the server capability and the state together', () => {
    expect(headerAction('IN_REVIEW', { ...none, canSendToAccountant: true })).toBe('SEND');
    expect(headerAction('TO_APPROVE', { ...none, canApprove: true })).toBe('APPROVE');
    expect(headerAction('TO_PUBLISH', { ...none, canPublish: true })).toBe('PUBLISH');
    expect(headerAction('PUBLISHED', { ...none, canPay: true })).toBe('MARK_PAID');
  });
  it('is absent without the capability, and on a paid month', () => {
    expect(headerAction('IN_REVIEW', none)).toBeNull();
    expect(headerAction('PAID', { ...none, canPay: true })).toBeNull();
    expect(headerActionLabel('MARK_PAID', '2026-09')).toBe('Mark September as paid');
  });
  it('says why Send is off', () => {
    expect(sendBlockedReason(2, 0)).toBe('Check the 2 lines still open.');
    expect(sendBlockedReason(0, 1)).toBe('Resolve the 1 line that blocks the month.');
    expect(sendBlockedReason(3, 2)).toBe('Resolve the 2 lines that block the month.');
    expect(sendBlockedReason(0, 0)).toBeNull();
  });
});

describe('words', () => {
  it('reads the list line per state', () => {
    expect(listLine(row('2026-09', 'WAITING'))).toBe('3 of 4 sites approved');
    expect(listLine(row('2026-09', 'IN_REVIEW'))).toBe('Calculated · net 3,168,500');
  });
  it('speaks a stage', () => {
    const stage: StageView = { key: 'REVIEWED', number: 3, name: 'Reviewed', status: 'CURRENT', who: 'HR', at: null, text: '5 lines' };
    expect(stageSpoken(stage)).toBe('Stage 3 of 6, Reviewed, in progress, 5 lines');
  });
  it('uses the server words for a known refusal and its own message otherwise', () => {
    expect(refusalWords('PIN_INVALID', 'x')).toBe('That PIN is not right.');
    expect(refusalWords('SOMETHING', 'Plain server words')).toBe('Plain server words');
  });
});
