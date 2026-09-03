import { UserRole, DepartmentTag } from '@prisma/client';

/**
 * HR shift-scheduling department model.
 *
 * The client wants department heads to schedule shifts for "their department".
 * Rather than tag every rank-and-file staff member, department membership is
 * DERIVED FROM ROLE (agreed 2026-08-28):
 *
 *   Kitchen      → CHEF   (a KITCHEN head also covers PASTRY-role staff — see note)
 *   Pastry       → CHEF   (no separate head yet; folded into the Kitchen head's view)
 *   Barista      → BARISTA
 *   Service      → WAITER
 *   Housekeeping → STEWARD, HOUSEKEEPING
 *
 * A department head is NOT a distinct role — since 2026-09-03 they keep their
 * real base role (WAITER/CHEF/…) and carry an `isDepartmentHead` marker plus a
 * `departmentTag` naming the department they head. So a head is matched into a
 * department's roster the same way anyone else is: by their real role. The
 * `departmentTag` on a head only says which department they are allowed to
 * SCHEDULE (their scoping reach), never which roster they appear on.
 *
 * Pastry note: `DepartmentTag` keeps KITCHEN and PASTRY as distinct values
 * (Inventory Phase 2 D-17 gives them separate heads). For shift scheduling the
 * client wants one head over both for now, so a head whose `departmentTag` is
 * KITCHEN gets the union of KITCHEN + PASTRY roles. When the client later
 * appoints a real PASTRY head, split `DEPARTMENT_ROLES` — no migration needed
 * because staff are matched by role, not by a stored tag.
 */

/**
 * Staff roles that can be placed on a shift. Department heads are covered by
 * their base role (already in this list), so there is no separate entry.
 */
export const SHIFT_ASSIGNABLE_ROLES: readonly UserRole[] = [
  UserRole.WAITER,
  UserRole.CHEF,
  UserRole.BARISTA,
  UserRole.STEWARD,
  UserRole.HOUSEKEEPING,
] as const;

/**
 * Worked roles that belong to each department, keyed by `departmentTag`.
 */
export const DEPARTMENT_ROLES: Record<DepartmentTag, readonly UserRole[]> = {
  [DepartmentTag.KITCHEN]: [UserRole.CHEF],
  [DepartmentTag.PASTRY]: [UserRole.CHEF],
  [DepartmentTag.BARISTA]: [UserRole.BARISTA],
  [DepartmentTag.SERVICE]: [UserRole.WAITER],
  [DepartmentTag.HOUSEKEEPING]: [UserRole.STEWARD, UserRole.HOUSEKEEPING],
};

/** The worked roles a department head may see and schedule. */
export const rolesForDepartment = (departmentTag: DepartmentTag): UserRole[] => [
  ...DEPARTMENT_ROLES[departmentTag],
];

const KITCHEN_GROUP: DepartmentTag[] = [DepartmentTag.KITCHEN, DepartmentTag.PASTRY];

/** KITCHEN and PASTRY are one group until the client appoints a separate PASTRY head. */
export const sameDepartmentGroup = (a: DepartmentTag, b: DepartmentTag): boolean =>
  a === b || (KITCHEN_GROUP.includes(a) && KITCHEN_GROUP.includes(b));

/** The department tags that resolve to the same scheduling group as `departmentTag`. */
const groupTagsFor = (departmentTag: DepartmentTag): DepartmentTag[] =>
  KITCHEN_GROUP.includes(departmentTag) ? KITCHEN_GROUP : [departmentTag];

/**
 * Does a staff member belong to the given department for shift scheduling?
 * Membership is purely role-derived — a head is matched by their real base
 * role, exactly like anyone else (the `isDepartmentHead` marker and their own
 * `departmentTag` play no part here).
 */
export const staffMatchesDepartment = (
  staff: { role: UserRole },
  departmentTag: DepartmentTag,
): boolean => DEPARTMENT_ROLES[departmentTag].includes(staff.role);

/**
 * Prisma `where.user` fragment that scopes a query to one department:
 * the worked roles for that department (KITCHEN pulls in PASTRY-group roles).
 */
export const departmentScopeFilter = (departmentTag: DepartmentTag) => {
  const roles = new Set<UserRole>();
  for (const tag of groupTagsFor(departmentTag)) {
    for (const role of DEPARTMENT_ROLES[tag]) {
      roles.add(role);
    }
  }
  return { role: { in: [...roles] } };
};
