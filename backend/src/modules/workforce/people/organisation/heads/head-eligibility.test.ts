import { describe, expect, it } from 'vitest';
import { assertEligible, assertRowsAllow, ineligibleReason, type HeadCandidateFacts } from './head-eligibility';
import type { HeadRowRecord } from './heads-repository';

const person = (over: Partial<HeadCandidateFacts> = {}): HeadCandidateFacts => ({ id: 'e1', departmentId: 'd1', userId: 'u1', status: 'ACTIVE', payType: 'MONTHLY_SALARY', userIsActive: true, ...over });
const row = (over: { departmentId?: string; isActing?: boolean; employeeId?: string } = {}): HeadRowRecord =>
  ({ id: 'r', departmentId: 'd1', employeeId: 'e9', isActing: false, startsOn: new Date(), endsOn: null, department: { siteId: 's', key: null, name: 'x' }, employee: { id: 'e9', name: 'x', userId: null }, ...over }) as HeadRowRecord;

describe('who may lead a department', () => {
  it('an active monthly employee of the department with a working login', () => {
    expect(ineligibleReason(person(), 'd1')).toBeNull();
  });

  it.each([
    ['NOT_IN_DEPARTMENT', person({ departmentId: 'd2' })],
    ['NOT_ACTIVE', person({ status: 'ONBOARDING' })],
    ['NOT_ACTIVE', person({ status: 'EXITED' })],
    ['CASUAL', person({ payType: 'DAILY_RATE', userId: null })],
    ['NO_LOGIN', person({ userId: null })],
    ['LOGIN_INACTIVE', person({ userIsActive: false })],
  ])('refuses %s', (reason, facts) => {
    expect(ineligibleReason(facts, 'd1')).toBe(reason);
    expect(() => assertEligible(facts, 'd1')).toThrowError(expect.objectContaining({ statusCode: 409, code: 'HEAD_NOT_ELIGIBLE' }));
  });
});

describe('rows already open', () => {
  it('nobody leads two departments', () => {
    expect(() => assertRowsAllow('REPLACE', 'd1', [row({ departmentId: 'd2' })], [], false)).toThrowError(expect.objectContaining({ code: 'ALREADY_HEAD' }));
    expect(() => assertRowsAllow('ACTING', 'd1', [row({ departmentId: 'd2', isActing: true })], [], false)).toThrowError(expect.objectContaining({ code: 'ALREADY_HEAD' }));
  });

  it('the head cannot be named head again', () => {
    expect(() => assertRowsAllow('REPLACE', 'd1', [row()], [row()], false)).toThrowError(expect.objectContaining({ code: 'ALREADY_HEAD' }));
  });

  it('an acting head here may be made the permanent head', () => {
    expect(() => assertRowsAllow('REPLACE', 'd1', [row({ isActing: true })], [row({ isActing: true })], false)).not.toThrow();
  });

  it('a second acting head needs replaceActing', () => {
    const acting = row({ isActing: true });
    expect(() => assertRowsAllow('ACTING', 'd1', [], [acting], false)).toThrowError(expect.objectContaining({ code: 'ACTING_HEAD_EXISTS' }));
    expect(() => assertRowsAllow('ACTING', 'd1', [], [acting], true)).not.toThrow();
    expect(() => assertRowsAllow('ACTING', 'd1', [], [row()], false)).not.toThrow(); // only a substantive head: fine
  });

  it('a new head replaces the old one and any acting head without a flag', () => {
    expect(() => assertRowsAllow('REPLACE', 'd1', [], [row(), row({ isActing: true })], false)).not.toThrow();
  });
});
