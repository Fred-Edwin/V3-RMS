import { describe, expect, it } from 'vitest';

import type { Lookups } from '../../_shared/types/people-types';
import { afterJobChoice, departmentsFor, loginEmailDefault, loginRolesFor, positionsFor, tracksTimeOf, withSingleSite } from './hire-choices';
import { emptyHire } from './hire-model';

const lookups = {
  organizations: [
    { id: 's1', name: 'Nyeri Town', type: 'BRANCH', isHub: false },
    { id: 's2', name: 'Nyeri Highway', type: 'BRANCH', isHub: false },
  ],
  departments: [
    { id: 'd1', organizationId: 's1', name: 'Barista', inventoryTag: 'BARISTA', isActive: true },
    { id: 'd2', organizationId: 's2', name: 'Kitchen', inventoryTag: 'KITCHEN', isActive: true },
    { id: 'd3', organizationId: 's1', name: 'Old', inventoryTag: null, isActive: false },
  ],
  positions: [
    { id: 'p1', name: 'Barista', defaultTracksTime: true, loginRole: 'BARISTA', casualsAllowed: false, departmentIds: ['d1'], isActive: true },
    { id: 'p2', name: 'Kitchen hand', defaultTracksTime: true, loginRole: null, casualsAllowed: true, departmentIds: ['d2'], isActive: true },
    { id: 'p3', name: 'Branch Manager', defaultTracksTime: false, loginRole: 'MANAGER', casualsAllowed: false, departmentIds: [], isActive: true },
  ],
  assignableLoginRoles: ['BARISTA', 'WAITER', 'MANAGER'],
} as unknown as Lookups;

const base = emptyHire('2026-10-05');

describe('hire choices', () => {
  it("offers only the site's active departments", () => {
    expect(departmentsFor(lookups, 's1').map((d) => d.id)).toEqual(['d1']);
  });
  it('offers positions of the department, and only casual-friendly ones to a casual; a position with no list fits any', () => {
    expect(positionsFor(lookups, { departmentId: 'd1', employment: 'MONTHLY_NO_CONTRACT_YET' }).map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(positionsFor(lookups, { departmentId: 'd2', employment: 'CASUAL' }).map((p) => p.id)).toEqual(['p2']);
  });
  it('lists only login roles a hire may give', () => {
    expect(loginRolesFor(lookups)).toEqual(['BARISTA', 'WAITER']);
  });
  it('clears the department and head when the site changes, and the position when the department does', () => {
    const state = { ...base, siteId: 's1', departmentId: 'd1', positionId: 'p1', reportsToId: 'e9' };
    const moved = afterJobChoice(state, { siteId: 's2' }, lookups);
    expect(moved).toMatchObject({ siteId: 's2', departmentId: '', reportsToId: '' });
    const changed = afterJobChoice({ ...state, siteId: 's2' }, { departmentId: 'd2' }, lookups);
    expect(changed.positionId).toBe('');
  });
  it('keeps a position that still fits and takes its login role', () => {
    const picked = afterJobChoice({ ...base, siteId: 's1', departmentId: 'd1' }, { positionId: 'p1' }, lookups);
    expect(picked.loginRole).toBe('BARISTA');
  });
  it('drops a position that takes no casuals when the person becomes one', () => {
    const state = { ...base, siteId: 's1', departmentId: 'd1', positionId: 'p1' };
    expect(afterJobChoice(state, { employment: 'CASUAL' }, lookups).positionId).toBe('');
  });
  it('chooses the only site for someone who sees one', () => {
    const one = { ...lookups, organizations: [lookups.organizations[0]] } as Lookups;
    expect(withSingleSite(base, one).siteId).toBe('s1');
    expect(withSingleSite(base, lookups).siteId).toBe('');
  });
  it("follows the position's time tracking until the form overrides it", () => {
    expect(tracksTimeOf({ positionId: 'p3', tracksTime: null }, lookups)).toBe(false);
    expect(tracksTimeOf({ positionId: 'p3', tracksTime: true }, lookups)).toBe(true);
  });
  it('starts the sign-in email as the one from step one', () => {
    expect(loginEmailDefault({ loginEmail: '' })).toBe('');
    expect(loginEmailDefault({ loginEmail: ' x@y.co ' })).toBe('x@y.co');
  });
});
