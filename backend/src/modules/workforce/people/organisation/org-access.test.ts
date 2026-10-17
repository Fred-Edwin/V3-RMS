import type { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { assertCanReadDepartment, assertCanWriteIn, assertCompanyWideWrite, orgReadScope } from './org-scope';

const subject = (role: UserRole, extra: Partial<AccessSubject> = {}): AccessSubject => ({ id: 'u1', role, siteId: 's1', headOfDepartmentIds: [], ...extra });

describe('who holds the organisation capabilities', () => {
  it.each<[UserRole, string | null, string | null, string | null]>([
    // role, org.read, org.write, org.write_heads
    ['HR_MANAGER', 'all', 'all', 'all'],
    ['SYSTEM_ADMIN', 'all', 'all', 'all'],
    ['DIRECTOR', 'all', null, null],
    ['MANAGER', 'unit', null, 'unit'],
    ['STORE_MANAGER', 'unit', null, 'unit'],
    ['ACCOUNTANT', null, null, null],
    ['WAITER', null, null, null],
    ['STORE_ATTENDANT', null, null, null],
  ])('%s', (role, read, write, heads) => {
    const s = subject(role);
    expect([scopeOf(s, 'org.read'), scopeOf(s, 'org.write'), scopeOf(s, 'org.write_heads')]).toEqual([read, write, heads]);
  });

  it('a head by head rows reads their own departments only', () => {
    const head = subject('WAITER', { headOfDepartmentIds: ['d1'] });
    expect(scopeOf(head, 'org.read')).toBe('dept');
    expect(scopeOf(head, 'org.write')).toBeNull();
    expect(orgReadScope(head)).toEqual({ kind: 'departments', siteId: 's1', departmentIds: ['d1'] });
    expect(() => assertCanReadDepartment(head, { id: 'd1', siteId: 's1' })).not.toThrow();
    expect(() => assertCanReadDepartment(head, { id: 'd2', siteId: 's1' })).toThrow(NotFoundError);
  });
});

describe('scope checks', () => {
  it('a read outside the viewer’s branch answers 404, a write 403', () => {
    const manager = subject('MANAGER');
    expect(() => assertCanReadDepartment(manager, { id: 'd9', siteId: 'other' })).toThrow(NotFoundError);
    expect(() => assertCanWriteIn(manager, 'org.write_heads', { siteId: 'other', id: 'd9' })).toThrow(ForbiddenError);
    expect(() => assertCanWriteIn(manager, 'org.write_heads', { siteId: 's1', id: 'd1' })).not.toThrow();
  });

  it('HR reads and writes everywhere', () => {
    const hr = subject('HR_MANAGER', { siteId: null });
    expect(orgReadScope(hr)).toEqual({ kind: 'all' });
    expect(() => assertCanWriteIn(hr, 'org.write', { siteId: 'any' })).not.toThrow();
    expect(() => assertCompanyWideWrite(hr)).not.toThrow();
  });

  it('only a company-wide writer changes positions', () => {
    expect(() => assertCompanyWideWrite(subject('MANAGER'))).toThrow(ForbiddenError);
    expect(() => assertCompanyWideWrite(subject('DIRECTOR'))).toThrow(ForbiddenError);
  });

  it('a viewer with no organisation read, or a branch viewer with no branch, is refused', () => {
    expect(() => orgReadScope(subject('ACCOUNTANT'))).toThrow(ForbiddenError);
    expect(() => orgReadScope(subject('MANAGER', { siteId: null }))).toThrow(ForbiddenError);
  });
});
