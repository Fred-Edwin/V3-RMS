import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';
import { navFor, type NavContext } from '@/components/app/shell/nav-table';
import {
  headErrorMessage,
  headTracker,
  HEAD_ERROR_COPY,
  homeHeadline,
  managerChangedBanner,
  OFFLINE_MESSAGE,
  statusBanner,
} from '../_shared/lib/phone-words';
import { REQUISITION_ERROR_CODES } from '../_shared/types/requisitions-contract';
import { groupByCategory, isChanged } from '../hooks/use-section-draft';
import { cleanTyped, formatQty, isValidQty, stepQty } from './qty';

describe('quantities', () => {
  it('shows decimals as a person writes them', () => {
    expect(formatQty('27.000')).toBe('27');
    expect(formatQty('2.50')).toBe('2.5');
  });
  it('keeps digits and one decimal point while typing', () => {
    expect(cleanTyped('2a.5.1')).toBe('2.51');
    expect(cleanTyped('')).toBe('');
  });
  it('accepts only a quantity above zero, and steps by whole units but never below 1', () => {
    expect(isValidQty('')).toBe(false);
    expect(isValidQty('0')).toBe(false);
    expect(isValidQty('0.5')).toBe(true);
    expect(stepQty('1', -1)).toBe('1');
    expect(stepQty('4', 1)).toBe('5');
  });
});

describe('the draft rules', () => {
  const line = (suggestedQty: string | null, qty: string) => ({ itemId: 'i', itemName: 'Milk', unit: 'L', categoryPath: ['Dairy'], qty, suggestedQty });
  it('counts a line as changed when its quantity differs or the head added it', () => {
    expect(isChanged(line('27', '27'))).toBe(false);
    expect(isChanged(line('27', '30'))).toBe(true);
    expect(isChanged(line(null, '3'))).toBe(true);
  });
  it('groups by category in first-seen order and joins a two-level path', () => {
    const groups = groupByCategory([{ categoryPath: ['Prep kitchen', 'chicken and beef'] }, { categoryPath: ['Dry items'] }, { categoryPath: ['Prep kitchen', 'chicken and beef'] }]);
    expect(groups.map((g) => [g.heading, g.lines.length])).toEqual([
      ['Prep kitchen · chicken and beef', 2],
      ['Dry items', 1],
    ]);
  });
});

describe('the wording', () => {
  it('has a head line for every error code the contract lists, except the desktop-only ones', () => {
    const desktopOnly = new Set<string>(['DEPARTMENT_HAS_OPEN_SECTIONS']);
    for (const code of REQUISITION_ERROR_CODES) if (!desktopOnly.has(code)) expect(HEAD_ERROR_COPY[code], code).toBeTruthy();
  });
  it('maps a known code, a lost connection and an unknown failure to plain words', () => {
    expect(headErrorMessage(new ApiError('x', 400, 'INVALID_PIN'))).toBe('That PIN is not right. Try again.');
    expect(headErrorMessage(new TypeError('Failed to fetch'))).toBe(OFFLINE_MESSAGE);
    expect(headErrorMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
  it('writes the approved home headlines', () => {
    expect(homeHeadline('MORNING', false)).toBe('Nothing asked for yet this morning');
    expect(homeHeadline('EXTRA', false)).toBe('Need something extra?');
    expect(homeHeadline('EXTRA', true)).toBe('Something came up after the Afternoon one?');
  });
  it('words the manager-changed banner for one line and for several', () => {
    const one = managerChangedBanner([{ itemName: 'Flour 25kg', asked: '6', approved: '4', unit: 'bags', reason: 'too much for the week' }]);
    expect(one.title).toBe('The Branch Manager changed 1 line');
    expect(one.body).toBe('Flour 25kg: you asked for 6 bags, 4 were approved. Reason: too much for the week. Nothing for you to do.');
    expect(managerChangedBanner([{ itemName: 'a', asked: '1', approved: '1', unit: 'x', reason: null }, { itemName: 'b', asked: '1', approved: '1', unit: 'x', reason: null }]).title).toBe('The Branch Manager changed 2 lines');
  });
  it('picks the banner by status: approved with the store, cancelled, waiting', () => {
    const base = { sentAt: '1:52 pm', lineCount: 12, cancelReason: 'Asked twice by mistake', changedByManagerLines: [] };
    expect(statusBanner({ ...base, requisitionStatus: 'APPROVED', sectionStatus: 'SUBMITTED' }).title).toBe('Approved, with the store');
    expect(statusBanner({ ...base, requisitionStatus: 'CANCELLED', sectionStatus: 'SUBMITTED' }).title).toBe('Cancelled');
    expect(statusBanner({ ...base, requisitionStatus: 'PENDING_APPROVAL', sectionStatus: 'SUBMITTED' }).body).toBe("You sent 12 lines at 1:52 pm. You'll be told as soon as they are approved.");
  });
  it('builds the head tracker: waiting, then the approved rail with the store rows greyed and undated', () => {
    const args = { departmentName: 'Kitchen', sectionStatus: 'SUBMITTED' as const, sentAtText: '1:52 pm', tracker: [], approvedAtText: '2:11 pm', approvedByLabel: 'Branch Manager', sectionsIn: 1, sectionsTotal: 1 };
    const waiting = headTracker({ ...args, requisitionStatus: 'PENDING_APPROVAL' });
    expect(waiting.map((s) => [s.title, s.state])).toEqual([
      ['Kitchen asked', 'DONE'],
      ['Branch Manager approves', 'CURRENT'],
      ['Store packs and sends', 'TODO'],
      ['Kitchen counts and confirms', 'TODO'],
    ]);
    const approved = headTracker({ ...args, requisitionStatus: 'APPROVED' });
    expect(approved[0]).toMatchObject({ title: 'Approved', line: 'Branch Manager, 2:11 pm', state: 'DONE' });
    expect(approved.slice(1).every((s) => s.state === 'TODO' && s.line === null)).toBe(true);
  });
});

describe("the head's rows in the navigation table", () => {
  const ctx = (isDepartmentHead: boolean): NavContext => ({ role: 'CHEF', isDepartmentHead, can: () => false, creditAccounts: false });
  const hrefs = (head: boolean): string[] => navFor(ctx(head)).flatMap((g) => g.items.map((i) => i.href));
  it('gives a head Requisitions, Deliveries, Waste and History on the new pages, and a member none of them', () => {
    expect(hrefs(true)).toEqual(expect.arrayContaining(['/app/requisitions', '/app/branch/deliveries', '/app/branch/waste/new', '/app/requisitions/history']));
    expect(hrefs(false)).not.toContain('/app/requisitions');
  });
  it('shows a chef-head one History (the head\'s), and a chef without the marker the floor History', () => {
    const labels = (head: boolean): string[] => navFor(ctx(head)).flatMap((g) => g.items.map((i) => i.label));
    expect(labels(true).filter((l) => l === 'History')).toHaveLength(1);
    expect(hrefs(true)).not.toContain('/app/history');
    expect(hrefs(false)).toContain('/app/history');
  });
});
