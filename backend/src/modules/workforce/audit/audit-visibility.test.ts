import { describe, expect, it } from 'vitest';
import { AUDIT_CATEGORIES } from '../_shared/audit/audit.types';
import type { AccessSubject } from '../_shared/workforce-access';
import { EVENT_CODES, categoriesFor, eventOfCategory, logScopeOf, mayNameSubject, mayReadChanges, maySeeDevice, readableEvents } from './audit-visibility';

const who = (role: AccessSubject['role'], siteId: string | null = null): AccessSubject => ({ id: `${role}-1`, role, siteId });
const scopeOf = (s: AccessSubject) => {
  const scope = logScopeOf(s);
  if (!scope) throw new Error('expected a reader');
  return scope;
};

describe('who reads which category (A7)', () => {
  it('every category belongs to exactly one event', () => {
    for (const category of AUDIT_CATEGORIES) expect(EVENT_CODES).toContain(eventOfCategory(category));
  });

  it('the Director reads every category, including payslip opens and the log itself', () => {
    expect(scopeOf(who('DIRECTOR')).categories).toEqual([...AUDIT_CATEGORIES]);
    expect(scopeOf(who('DIRECTOR')).unit).toBe(false);
  });

  it('HR reads people, time, leave, pay set-up and preparation, discipline and rules, but not payslip opens or sign-ins', () => {
    const c = scopeOf(who('HR_MANAGER')).categories;
    expect(c).toEqual(expect.arrayContaining(['PEOPLE', 'TIME', 'LEAVE', 'PAY_SETUP', 'PAY_RUN_PREPARE', 'DISCIPLINE', 'RULES_OPERATING', 'RULES_PAY']));
    expect(c).not.toContain('PAYSLIP_ACCESS');
    expect(c).not.toContain('SECURITY');
    expect(c).not.toContain('LOG_ACCESS');
  });

  it('the Accountant reads the pay run and pay rules, not people or payslip opens', () => {
    const c = scopeOf(who('ACCOUNTANT')).categories;
    expect(c).toEqual(expect.arrayContaining(['PAY_RUN_DECIDE', 'PAY_RUN_PREPARE', 'RULES_PAY']));
    expect(c).not.toContain('PEOPLE');
    expect(c).not.toContain('PAYSLIP_ACCESS');
  });

  it('the System Admin reads every category, as the Director does (21 Oct 2026)', () => {
    expect(scopeOf(who('SYSTEM_ADMIN')).categories).toEqual([...AUDIT_CATEGORIES]);
  });

  it('a Branch Manager reads time, leave and operating rules for their own site only', () => {
    const scope = scopeOf(who('MANAGER', 'site-1'));
    expect(scope.categories.sort()).toEqual(['LEAVE', 'RULES_OPERATING', 'TIME']);
    expect(scope).toMatchObject({ unit: true, siteId: 'site-1' });
  });

  it('floor staff are not readers of the log at all (the route answers 404)', () => {
    expect(logScopeOf(who('WAITER', 'site-1'))).toBeNull();
  });
});

describe('narrowing by event never widens', () => {
  it('an event the reader cannot read gives no categories (an empty list, not a 403)', () => {
    expect(categoriesFor(scopeOf(who('MANAGER', 'site-1')), 'payslips')).toEqual([]);
    expect(categoriesFor(scopeOf(who('ACCOUNTANT')), 'security')).toEqual([]);
  });

  it('the Event menu lists only readable events', () => {
    expect(readableEvents(scopeOf(who('MANAGER', 'site-1'))).map((e) => e.code)).toEqual(['time', 'leave', 'rules']);
    expect(readableEvents(scopeOf(who('DIRECTOR'))).map((e) => e.code)).toEqual([...EVENT_CODES]);
  });
});

describe('what a row may show', () => {
  it('names the person of a payslip opening only to the Director', () => {
    expect(mayNameSubject('PAYSLIP_ACCESS', scopeOf(who('DIRECTOR')))).toBe(true);
    expect(mayNameSubject('PAYSLIP_ACCESS', scopeOf(who('HR_MANAGER')))).toBe(false);
    expect(mayNameSubject('PEOPLE', scopeOf(who('HR_MANAGER')))).toBe(true);
  });

  it('shows what changed in a pay entry only to readers of the pay decision, and never for payslip opens', () => {
    expect(mayReadChanges('PAY_RUN_DECIDE', scopeOf(who('ACCOUNTANT')))).toBe(true);
    expect(mayReadChanges('PAY_RUN_PREPARE', scopeOf(who('HR_MANAGER')))).toBe(false);
    expect(mayReadChanges('PAYSLIP_ACCESS', scopeOf(who('DIRECTOR')))).toBe(false);
    expect(mayReadChanges('TIME', scopeOf(who('HR_MANAGER')))).toBe(true);
  });

  it('shows device and place to the Director and the System Admin only', () => {
    expect(maySeeDevice(scopeOf(who('DIRECTOR')))).toBe(true);
    expect(maySeeDevice(scopeOf(who('SYSTEM_ADMIN')))).toBe(true);
    expect(maySeeDevice(scopeOf(who('HR_MANAGER')))).toBe(false);
  });
});
