import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS } from './audit-actions';
import { areaOf, describeEntry, isFlagged } from './audit-describe';
import { AUDIT_TITLES } from './audit-titles';
import type { AuditCategoryCode, JsonValue } from './audit.types';

const entry = (action: string, over: { category?: AuditCategoryCode; after?: JsonValue | null; before?: JsonValue | null; reason?: string | null } = {}) => ({
  action,
  category: over.category ?? 'TIME',
  after: over.after ?? null,
  before: over.before ?? null,
  reason: over.reason ?? null,
});

describe('describeEntry', () => {
  it('has wording for every registered action (a new code without a title fails here and in the compiler)', () => {
    for (const action of Object.keys(AUDIT_ACTIONS)) {
      expect(AUDIT_TITLES).toHaveProperty([action]);
      const { title, detail } = describeEntry(entry(action));
      expect(title).not.toBe('Change recorded');
      expect(detail).not.toBe(action);
    }
  });

  it('answers "Change recorded" with the action code for an unknown action', () => {
    expect(describeEntry(entry('made.up'))).toEqual({ title: 'Change recorded', detail: 'made.up', flagged: false });
  });

  it('words the payslip code by its outcome and flags the 3rd wrong one', () => {
    const wrong3 = describeEntry(entry('payslip.code_tried', { category: 'SECURITY', after: { success: false, count: 3 } }));
    expect(wrong3).toMatchObject({ title: 'Payslip code wrong 3 times', flagged: true });
    expect(describeEntry(entry('payslip.code_tried', { after: { success: false, count: 1 } }))).toMatchObject({ title: 'Payslip code wrong', flagged: false });
    expect(describeEntry(entry('payslip.code_tried', { after: { success: true } })).title).toBe('Payslip code right');
  });

  it('flags a payslip opened on an unconfirmed phone and says so, without a payslip figure', () => {
    const opened = describeEntry(entry('payslip.opened', { category: 'PAYSLIP_ACCESS', after: { number: 'PS-0012', unconfirmed: true, net: 52000, purpose: 'view' } }));
    expect(opened.flagged).toBe(true);
    expect(opened.detail).toContain('not confirmed');
    expect(opened.detail).toContain('PS-0012');
    expect(opened.detail).not.toContain('52000');
  });

  it('never prints an amount, a code, a PIN or a password, whatever key they sit under', () => {
    const after = { month: '2026-09', netPay: 91000, grossAmount: 100000, code: '1234', pin: '9999', password: 'x', bankAccount: '0011', totalKes: 5, headcount: 86 };
    const { detail } = describeEntry(entry('payroll.published', { category: 'PAY_RUN_PREPARE', after }));
    expect(detail).toBe('Month 2026-09 · People 86');
  });

  it('shows old and new values for a non-pay rule change but not for a pay category', () => {
    const rule = entry('rules.version_created', { category: 'RULES_OPERATING', before: { value: '5 min' }, after: { field: 'Lateness grace', value: '10 min' } });
    expect(describeEntry(rule).detail).toBe('Lateness grace: 5 min → 10 min');
    expect(describeEntry({ ...rule, category: 'RULES_PAY' }).detail).toBe('');
  });

  it('adds the reason, trimmed to a sane length', () => {
    expect(describeEntry(entry('timesheet.day_decided', { reason: 'x'.repeat(500) })).detail.length).toBeLessThan(220);
  });

  it('flags the registry rules and nothing else', () => {
    expect(isFlagged({ action: 'security.wasnt_me', after: null })).toBe(true);
    expect(isFlagged({ action: 'audit.chain_failed', after: null })).toBe(true);
    expect(isFlagged({ action: 'payroll.payslip_corrected', after: { bankFileVoided: true } })).toBe(true);
    expect(isFlagged({ action: 'payroll.payslip_corrected', after: { bankFileVoided: false } })).toBe(false);
    expect(isFlagged({ action: 'rota.cells_changed', after: null })).toBe(false);
  });

  it('files security entries under the Access area and the rest under Workforce', () => {
    expect(areaOf('security.phone_confirmed')).toBe('ACCESS');
    expect(areaOf('payroll.approved')).toBe('WORKFORCE');
  });
});
