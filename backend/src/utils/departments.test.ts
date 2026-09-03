import { DepartmentTag, UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  DEPARTMENT_ROLES,
  SHIFT_ASSIGNABLE_ROLES,
  departmentScopeFilter,
  rolesForDepartment,
  sameDepartmentGroup,
  staffMatchesDepartment,
} from './departments';

describe('DEPARTMENT_ROLES', () => {
  it('covers every DepartmentTag', () => {
    for (const tag of Object.values(DepartmentTag)) {
      expect(DEPARTMENT_ROLES[tag].length).toBeGreaterThan(0);
    }
  });

  it('never lists DEPARTMENT_HEAD as a worked role (heads keep their base role)', () => {
    for (const tag of Object.values(DepartmentTag)) {
      expect(DEPARTMENT_ROLES[tag]).not.toContain(UserRole.DEPARTMENT_HEAD);
    }
  });

  it('maps the five worked roles to exactly one department each', () => {
    const worked = [UserRole.WAITER, UserRole.CHEF, UserRole.BARISTA, UserRole.STEWARD, UserRole.HOUSEKEEPING];
    for (const role of worked) {
      const owners = Object.values(DepartmentTag).filter((tag) => DEPARTMENT_ROLES[tag].includes(role));
      // CHEF is shared by KITCHEN + PASTRY (one group until a PASTRY head exists).
      if (role === UserRole.CHEF) {
        expect(owners.sort()).toEqual([DepartmentTag.KITCHEN, DepartmentTag.PASTRY].sort());
      } else {
        expect(owners).toHaveLength(1);
      }
    }
  });
});

describe('SHIFT_ASSIGNABLE_ROLES', () => {
  it('does not include DEPARTMENT_HEAD (a head is on the roster under their base role)', () => {
    expect(SHIFT_ASSIGNABLE_ROLES).not.toContain(UserRole.DEPARTMENT_HEAD);
  });

  it('is the five worked roles', () => {
    expect([...SHIFT_ASSIGNABLE_ROLES].sort()).toEqual(
      [UserRole.WAITER, UserRole.CHEF, UserRole.BARISTA, UserRole.STEWARD, UserRole.HOUSEKEEPING].sort(),
    );
  });
});

describe('sameDepartmentGroup', () => {
  it('treats KITCHEN and PASTRY as one group', () => {
    expect(sameDepartmentGroup(DepartmentTag.KITCHEN, DepartmentTag.PASTRY)).toBe(true);
    expect(sameDepartmentGroup(DepartmentTag.PASTRY, DepartmentTag.KITCHEN)).toBe(true);
  });

  it('keeps other departments distinct', () => {
    expect(sameDepartmentGroup(DepartmentTag.KITCHEN, DepartmentTag.SERVICE)).toBe(false);
    expect(sameDepartmentGroup(DepartmentTag.BARISTA, DepartmentTag.HOUSEKEEPING)).toBe(false);
  });
});

describe('staffMatchesDepartment', () => {
  it('matches a worked-role staffer to their department', () => {
    expect(staffMatchesDepartment({ role: UserRole.CHEF }, DepartmentTag.KITCHEN)).toBe(true);
    expect(staffMatchesDepartment({ role: UserRole.CHEF }, DepartmentTag.SERVICE)).toBe(false);
    expect(staffMatchesDepartment({ role: UserRole.HOUSEKEEPING }, DepartmentTag.HOUSEKEEPING)).toBe(true);
  });

  it('matches a head by their real base role, not a marker', () => {
    // A SERVICE head who is a WAITER matches SERVICE automatically.
    expect(staffMatchesDepartment({ role: UserRole.WAITER }, DepartmentTag.SERVICE)).toBe(true);
    expect(staffMatchesDepartment({ role: UserRole.WAITER }, DepartmentTag.KITCHEN)).toBe(false);
  });
});

describe('departmentScopeFilter', () => {
  it('scopes KITCHEN to the CHEF role (KITCHEN + PASTRY group)', () => {
    expect(departmentScopeFilter(DepartmentTag.KITCHEN)).toEqual({ role: { in: [UserRole.CHEF] } });
  });

  it('scopes SERVICE to the WAITER role only', () => {
    expect(departmentScopeFilter(DepartmentTag.SERVICE)).toEqual({ role: { in: [UserRole.WAITER] } });
  });

  it('scopes HOUSEKEEPING to both its worked roles', () => {
    const filter = departmentScopeFilter(DepartmentTag.HOUSEKEEPING) as { role: { in: UserRole[] } };
    expect(filter.role.in.sort()).toEqual([UserRole.HOUSEKEEPING, UserRole.STEWARD].sort());
  });
});

describe('rolesForDepartment', () => {
  it('returns a fresh array', () => {
    const a = rolesForDepartment(DepartmentTag.HOUSEKEEPING);
    a.push(UserRole.WAITER);
    expect(rolesForDepartment(DepartmentTag.HOUSEKEEPING)).not.toContain(UserRole.WAITER);
  });
});
