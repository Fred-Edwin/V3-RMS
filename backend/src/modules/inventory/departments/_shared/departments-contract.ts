/**
 * Inventory: Departments as data (Block 1)
 * FROZEN API CONTRACT: request and response schemas for R23 to R26 (Paper step 20 and gap fix G4).
 *
 * Source of truth: docs/features/inventory/requisitions-contract.md (§2.1, §4.3). The front end mirrors this file by hand in
 * `frontend/features/inventory/departments/types/departments-contract.ts`; the shared sample payloads are in
 * `departments-contract.fixtures.json`.
 *
 * A department is a row, not a code value. `key` is the legacy enum value for the original five and null for an added one;
 * renaming or retiring never touches it. Do not add a department in production before Block 2 ships (contract §10).
 *
 * Do not change a shape here without changing the contract document, the mirror and the fixtures in the same commit, and only
 * with the owner's approval.
 */
import { z } from 'zod';
import { isoDateTime, personSchema, uuid } from '../../_shared/wire';

export const DEPARTMENT_STATUSES = ['ACTIVE', 'RETIRED'] as const;
export const departmentStatusSchema = z.enum(DEPARTMENT_STATUSES);
export type DepartmentStatus = z.infer<typeof departmentStatusSchema>;

/** The enum values of the original five (`DepartmentTag`). */
export const DEPARTMENT_KEYS = ['KITCHEN', 'BARISTA', 'PASTRY', 'SERVICE', 'HOUSEKEEPING'] as const;
export const departmentKeySchema = z.enum(DEPARTMENT_KEYS);

export const departmentNameSchema = z.string().trim().min(1).max(40);

export const branchPickSchema = z.object({ id: uuid, name: z.string(), code: z.string().nullable() });

export const departmentRowSchema = z.object({
  id: uuid,
  branchId: uuid,
  name: z.string(),
  /** Null for an added department. */
  key: departmentKeySchema.nullable(),
  status: departmentStatusSchema,
  position: z.number().int().nonnegative(),
  /** The user with isDepartmentHead whose department this is. Null when nobody holds it. */
  head: personSchema.nullable(),
  itemsTagged: z.number().int().nonnegative(),
  retiredAt: isoDateTime.nullable(),
  /** `departments.write` and the caller's own branch (or the System Admin). */
  can: z.object({ rename: z.boolean(), retire: z.boolean(), restore: z.boolean() }),
});
export type DepartmentRow = z.infer<typeof departmentRowSchema>;

// --- R23 GET /inventory/departments ------------------------------------------------

/** `departments.read`. A Branch Manager always gets their own branch; a hub role picks one (the first branch when omitted). */
export const listDepartmentsQuerySchema = z.object({ branchId: uuid.optional() });
export type ListDepartmentsQuery = z.infer<typeof listDepartmentsQuerySchema>;
export const listDepartmentsSchema = z.object({
  branch: branchPickSchema,
  /** Hub roles only: the branch picker. */
  branches: z.array(branchPickSchema).optional(),
  rows: z.array(departmentRowSchema),
  /** The caller may add a department here. */
  canAdd: z.boolean(),
});
export type ListDepartments = z.infer<typeof listDepartmentsSchema>;

// --- R24 POST /inventory/departments --------------------------------------------------

/** `departments.write`. 409 `DEPARTMENT_NAME_TAKEN` when the branch already has that name. The response is the new `DepartmentRow`. */
export const addDepartmentInputSchema = z.object({ branchId: uuid, name: departmentNameSchema }).strict();
export type AddDepartmentInput = z.infer<typeof addDepartmentInputSchema>;

// --- R25 PATCH /inventory/departments/:id ----------------------------------------------

/** Rename. The response is the updated `DepartmentRow`. */
export const renameDepartmentInputSchema = z.object({ name: departmentNameSchema }).strict();
export type RenameDepartmentInput = z.infer<typeof renameDepartmentInputSchema>;

// --- R26 POST /inventory/departments/:id/retire and /restore (no body) -------------------
/** The response is the updated `DepartmentRow`. Past requisitions keep their sections; a retired department gets no section in new ones. */

export const DEPARTMENT_ERROR_CODES = [
  'DEPARTMENT_NAME_TAKEN', // 409: R24, R25
  'DEPARTMENT_RETIRED', // 409: R25 on a retired department, R26 retire twice
  'DEPARTMENT_ACTIVE', // 409: R26 restore of an active department
  'WRONG_BRANCH', // 403: a Branch Manager writing to another branch
] as const;
export type DepartmentErrorCode = (typeof DEPARTMENT_ERROR_CODES)[number];
