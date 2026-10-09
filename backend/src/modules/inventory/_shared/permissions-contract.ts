/**
 * `GET /inventory/permissions/me`: the wire shape (Dispatch Amendment 1 row 10).
 *
 * Until now the payload had no schema; it is `{ role, isDepartmentHead, capabilities }`. Amendment 1 adds `departments`: the
 * departments the signed-in person belongs to and whether they are the head or a member, so the branch screens (deliveries, the
 * department rule behind `deliveries.count`) need no second call. Mirrored by hand in
 * `frontend/features/inventory/_shared/types/permissions-contract.ts`; fixture in `permissions-contract.fixtures.json`
 * (byte-identical on both sides, parsed by `permissions-contract.test.ts`).
 *
 * The route in `permissions-routes.ts` does not return `departments` yet. // back end C
 */
import { z } from 'zod';
import { CAPABILITIES } from './central-store-access';
import { uuid } from './wire';

export const DEPARTMENT_ROLES = ['HEAD', 'MEMBER'] as const;
export const departmentRoleSchema = z.enum(DEPARTMENT_ROLES);
export type DepartmentRole = z.infer<typeof departmentRoleSchema>;

export const permissionsMeSchema = z.object({
  role: z.string(),
  isDepartmentHead: z.boolean(),
  capabilities: z.array(z.enum(CAPABILITIES)),
  /** Active departments of the caller's branch they head or belong to; empty for a person with none (hub and desktop roles). */
  departments: z.array(z.object({ id: uuid, name: z.string(), role: departmentRoleSchema })),
});
export type PermissionsMe = z.infer<typeof permissionsMeSchema>;
