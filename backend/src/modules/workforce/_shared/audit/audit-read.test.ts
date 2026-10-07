import type { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { AccessSubject } from '../workforce-access';
import { AUDIT_CATEGORIES, type AuditCategoryCode } from './audit.types';
import { OWN_RECORD_EXCLUDED_CATEGORIES, auditReadScopeOf } from './audit-read';

const as = (role: UserRole, extra: Partial<AccessSubject> = {}): AccessSubject => ({ id: 'u1', role, siteId: 's1', ...extra });
const cats = (role: UserRole): AuditCategoryCode[] => [...auditReadScopeOf(as(role)).categories].sort();

describe('auditReadScopeOf', () => {
  it('staff and heads read only their own record', () => {
    expect(auditReadScopeOf(as('WAITER'))).toMatchObject({ categories: [], ownRecord: true });
    expect(auditReadScopeOf(as('CHEF', { isDepartmentHead: true, departmentTag: 'KITCHEN' }))).toMatchObject({ categories: [], ownRecord: true });
  });

  it('the Branch Manager reads TIME, LEAVE and RULES_OPERATING for their own unit', () => {
    expect(auditReadScopeOf(as('MANAGER'))).toEqual({ categories: ['TIME', 'LEAVE', 'RULES_OPERATING'], scope: 'unit', siteId: 's1', ownRecord: true });
  });

  it('HR reads people, time, leave, pay set-up, pay-run preparation and discipline', () => {
    expect(cats('HR_MANAGER')).toEqual(['DISCIPLINE', 'LEAVE', 'PAY_RUN_PREPARE', 'PAY_SETUP', 'PEOPLE', 'TIME']);
    expect(auditReadScopeOf(as('HR_MANAGER'))).toMatchObject({ scope: 'all', siteId: null });
  });

  it('the Accountant reads pay-run decisions and pay-rule changes', () => {
    expect(cats('ACCOUNTANT')).toEqual(['PAY_RUN_DECIDE', 'RULES_PAY']);
  });

  it('the Director reads every category, including LOG_ACCESS and PAYSLIP_ACCESS', () => {
    expect(cats('DIRECTOR')).toEqual([...AUDIT_CATEGORIES].sort());
  });

  it('the System Admin reads security and rule changes, not payslip opens', () => {
    expect(cats('SYSTEM_ADMIN')).toEqual(['RULES_OPERATING', 'RULES_PAY', 'SECURITY']);
    expect(cats('SYSTEM_ADMIN')).not.toContain('PAYSLIP_ACCESS');
    expect(auditReadScopeOf(as('SYSTEM_ADMIN')).ownRecord).toBe(false);
  });

  it('nobody except the Director can read LOG_ACCESS or PAYSLIP_ACCESS', () => {
    const roles: UserRole[] = ['WAITER', 'CHEF', 'STORE_ATTENDANT', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'SYSTEM_ADMIN'];
    for (const role of roles) {
      expect(cats(role)).not.toContain('LOG_ACCESS');
      expect(cats(role)).not.toContain('PAYSLIP_ACCESS');
    }
  });

  it('"my record" never includes LOG_ACCESS', () => {
    expect(OWN_RECORD_EXCLUDED_CATEGORIES).toContain('LOG_ACCESS');
  });
});
