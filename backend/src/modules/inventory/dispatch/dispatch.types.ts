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
  ConfirmDeliverySchema,
  DeliveryNoteSchema,
  DeliveryRowSchema,
  DiscrepancyDetailSchema,
  DiscrepancyIdParamSchema,
  DiscrepancyRowSchema,
  DispatchDepartmentParamsSchema,
  DispatchIdParamSchema,
  DispatchQueueRowSchema,
  DispatchRequisitionParamsSchema,
  FulfilDepartmentSchema,
  FulfilDetailSchema,
  ListDeliveriesQuerySchema,
  ListDiscrepanciesQuerySchema,
  ListDispatchQueueQuerySchema,
  ResolveDiscrepancySchema,
  departmentTagSchema,
  discrepancyOutcomeSchema,
  discrepancyStatusSchema,
  dispatchStatusSchema,
} from './dispatch-validators';

export type DepartmentTag = z.infer<typeof departmentTagSchema>;
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;
export type DiscrepancyStatus = z.infer<typeof discrepancyStatusSchema>;
export type DiscrepancyOutcome = z.infer<typeof discrepancyOutcomeSchema>;

export type DispatchQueueRow = z.infer<typeof DispatchQueueRowSchema>;
export type ListDispatchQueueQuery = z.infer<typeof ListDispatchQueueQuerySchema>;

export type FulfilDetail = z.infer<typeof FulfilDetailSchema>;
export type FulfilDepartmentInput = z.infer<typeof FulfilDepartmentSchema>;
export type DispatchRequisitionParams = z.infer<typeof DispatchRequisitionParamsSchema>;
export type DispatchDepartmentParams = z.infer<typeof DispatchDepartmentParamsSchema>;
export type DispatchIdParam = z.infer<typeof DispatchIdParamSchema>;

export type DeliveryNote = z.infer<typeof DeliveryNoteSchema>;

export type ListDeliveriesQuery = z.infer<typeof ListDeliveriesQuerySchema>;
export type DeliveryRow = z.infer<typeof DeliveryRowSchema>;
export type ConfirmDeliveryInput = z.infer<typeof ConfirmDeliverySchema>;

export type ListDiscrepanciesQuery = z.infer<typeof ListDiscrepanciesQuerySchema>;
export type DiscrepancyRow = z.infer<typeof DiscrepancyRowSchema>;
export type DiscrepancyDetail = z.infer<typeof DiscrepancyDetailSchema>;
export type DiscrepancyIdParam = z.infer<typeof DiscrepancyIdParamSchema>;
export type ResolveDiscrepancyInput = z.infer<typeof ResolveDiscrepancySchema>;
