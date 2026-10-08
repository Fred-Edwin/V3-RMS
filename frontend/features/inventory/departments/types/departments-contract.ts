/**
 * Inventory: Departments as data (Block 1). FROZEN API CONTRACT, front-end mirror.
 *
 * Hand-written mirror of `backend/src/modules/inventory/departments/_shared/departments-contract.ts` (R23 to R26).
 * Source of truth: docs/features/inventory/requisitions-contract.md §2.1 and §4.3. Screens read the `can` flags.
 */
import type { Person } from '../../_shared/types/wire';

export type DepartmentStatus = 'ACTIVE' | 'RETIRED';
export type DepartmentKey = 'KITCHEN' | 'BARISTA' | 'PASTRY' | 'SERVICE' | 'HOUSEKEEPING';
export const DEPARTMENT_KEYS: readonly DepartmentKey[] = ['KITCHEN', 'BARISTA', 'PASTRY', 'SERVICE', 'HOUSEKEEPING'];

export interface BranchPick {
  id: string;
  name: string;
  code: string | null;
}

export interface DepartmentRow {
  id: string;
  branchId: string;
  name: string;
  /** Null for an added department. */
  key: DepartmentKey | null;
  status: DepartmentStatus;
  position: number;
  head: Person | null;
  itemsTagged: number;
  retiredAt: string | null;
  can: { rename: boolean; retire: boolean; restore: boolean };
}

/** R23 */
export interface ListDepartmentsQuery {
  branchId?: string;
}
export interface ListDepartments {
  branch: BranchPick;
  /** Hub roles only. */
  branches?: BranchPick[];
  rows: DepartmentRow[];
  canAdd: boolean;
}

/** R24. The response is the new `DepartmentRow`. */
export interface AddDepartmentInput {
  branchId: string;
  name: string;
}

/** R25. The response is the updated `DepartmentRow`. */
export interface RenameDepartmentInput {
  name: string;
}

/** R26 retire / restore: no body, the response is the updated `DepartmentRow`. */

export const DEPARTMENT_ERROR_CODES = ['DEPARTMENT_NAME_TAKEN', 'DEPARTMENT_RETIRED', 'DEPARTMENT_ACTIVE', 'WRONG_BRANCH'] as const;
export type DepartmentErrorCode = (typeof DEPARTMENT_ERROR_CODES)[number];
