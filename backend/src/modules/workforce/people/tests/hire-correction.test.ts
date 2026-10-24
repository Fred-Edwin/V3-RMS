import { describe, expect, it } from 'vitest';
import type { AccessSubject } from '../../_shared/workforce-access';
import { assertCanEditBasics } from '../people-access';

const manager: AccessSubject = { id: 'bm', role: 'MANAGER', siteId: 'town' };
const hr: AccessSubject = { id: 'hr', role: 'HR_MANAGER', siteId: null };
const base = { userId: 'u9', siteId: 'town', departmentId: null, status: 'ACTIVE' };
const now = new Date('2026-10-22T12:00:00Z');
const hoursAgo = (h: number): Date => new Date(now.getTime() - h * 3_600_000);

describe('the manager who made a hire may correct it for 24 hours (Q5)', () => {
  it('allows the hiring manager inside the window, on an active file', () => {
    expect(() => assertCanEditBasics(manager, { ...base, hiredById: 'bm', createdAt: hoursAgo(23) }, now)).not.toThrow();
  });
  it('asks for HR after 24 hours', () => {
    expect(() => assertCanEditBasics(manager, { ...base, hiredById: 'bm', createdAt: hoursAgo(25) }, now)).toThrowError(/Ask HR to change this/);
  });
  it('does not open the file to a manager who did not make the hire', () => {
    expect(() => assertCanEditBasics(manager, { ...base, hiredById: 'someone-else', createdAt: hoursAgo(1) }, now)).toThrowError(/Ask HR/);
  });
  it('keeps onboarding files editable and HR always able', () => {
    expect(() => assertCanEditBasics(manager, { ...base, status: 'ONBOARDING' }, now)).not.toThrow();
    expect(() => assertCanEditBasics(hr, { ...base, hiredById: null, createdAt: hoursAgo(500) }, now)).not.toThrow();
  });
});
