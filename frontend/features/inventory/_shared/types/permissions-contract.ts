/**
 * `GET /inventory/permissions/me`: the wire shape, front-end mirror of
 * `backend/src/modules/inventory/_shared/permissions-contract.ts` (Dispatch Amendment 1 row 10). `departments` is new: the
 * departments the signed-in person belongs to and whether they head or belong to each. The route returns it from back end C on.
 */
import type { Capability } from '../lib/capabilities';

export type DepartmentRole = 'HEAD' | 'MEMBER';
export const DEPARTMENT_ROLES: readonly DepartmentRole[] = ['HEAD', 'MEMBER'];

export interface PermissionsMe {
  role: string;
  isDepartmentHead: boolean;
  capabilities: Capability[];
  /** Active departments of the caller's branch they head or belong to; empty for hub and desktop roles. */
  departments: { id: string; name: string; role: DepartmentRole }[];
}
