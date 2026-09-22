/**
 * Inventory — Milestone Five (Dispatch & Branch Receiving), Session A.
 * FROZEN API CONTRACT (Session A subset) — TypeScript types.
 *
 * Every type here is inferred from the Zod schemas in
 * `dispatch-validators.ts` — the schemas are the single definition, these
 * are the compile-time view of them.
 *
 * Mirrored (by hand) in `frontend/features/dispatch/types/index.ts`.
 */
import type { z } from 'zod';

import type {
  DeliveryNoteSchema,
  DispatchDepartmentParamsSchema,
  DispatchQueueRowSchema,
  DispatchRequisitionParamsSchema,
  FulfilDepartmentSchema,
  FulfilDetailSchema,
  ListDispatchQueueQuerySchema,
  departmentTagSchema,
  dispatchStatusSchema,
} from './dispatch-validators';

export type DepartmentTag = z.infer<typeof departmentTagSchema>;
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;

export type DispatchQueueRow = z.infer<typeof DispatchQueueRowSchema>;
export type ListDispatchQueueQuery = z.infer<typeof ListDispatchQueueQuerySchema>;

export type FulfilDetail = z.infer<typeof FulfilDetailSchema>;
export type FulfilDepartmentInput = z.infer<typeof FulfilDepartmentSchema>;
export type DispatchRequisitionParams = z.infer<typeof DispatchRequisitionParamsSchema>;
export type DispatchDepartmentParams = z.infer<typeof DispatchDepartmentParamsSchema>;

export type DeliveryNote = z.infer<typeof DeliveryNoteSchema>;
