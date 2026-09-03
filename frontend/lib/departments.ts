import type { AppRole, DepartmentTag } from '@/types/auth';

/**
 * Which staff roles belong to each department for shift scheduling, keyed by
 * `departmentTag`. Mirrors backend `src/utils/departments.ts` — KITCHEN also
 * covers PASTRY-role staff until the client appoints a separate PASTRY head.
 *
 * A department head keeps their real base role, so they are matched into a
 * department by that role like anyone else — their `isDepartmentHead` marker
 * and their own `departmentTag` do not affect roster membership.
 */
export const DEPARTMENT_ROLES: Record<DepartmentTag, AppRole[]> = {
  KITCHEN: ['CHEF'],
  PASTRY: ['CHEF'],
  BARISTA: ['BARISTA'],
  SERVICE: ['WAITER'],
  HOUSEKEEPING: ['STEWARD', 'HOUSEKEEPING'],
};

const KITCHEN_GROUP: DepartmentTag[] = ['KITCHEN', 'PASTRY'];

/** KITCHEN and PASTRY are one group until a separate PASTRY head exists. */
export const sameDepartmentGroup = (a: DepartmentTag, b: DepartmentTag): boolean =>
  a === b || (KITCHEN_GROUP.includes(a) && KITCHEN_GROUP.includes(b));

const groupTagsFor = (tag: DepartmentTag): DepartmentTag[] =>
  KITCHEN_GROUP.includes(tag) ? KITCHEN_GROUP : [tag];

/** The worked roles that resolve to the same scheduling group as `departmentTag`. */
export const rolesInDepartmentGroup = (departmentTag: DepartmentTag): AppRole[] => {
  const roles: AppRole[] = [];
  for (const tag of groupTagsFor(departmentTag)) {
    for (const role of DEPARTMENT_ROLES[tag]) {
      if (!roles.includes(role)) roles.push(role);
    }
  }
  return roles;
};

/** Is this staff member part of `departmentTag` for shift scheduling? Role-derived. */
export const staffInDepartment = (
  staff: { role: AppRole },
  departmentTag: DepartmentTag,
): boolean => rolesInDepartmentGroup(departmentTag).includes(staff.role);

/** Human label for a department tag. */
export const departmentLabel = (tag: DepartmentTag): string =>
  ({ KITCHEN: 'Kitchen', PASTRY: 'Pastry', BARISTA: 'Barista', SERVICE: 'Service', HOUSEKEEPING: 'Housekeeping' })[tag];
