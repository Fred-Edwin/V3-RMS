import { z } from 'zod';
import {
  addCarrierInputSchema,
  cancelDispatchInputSchema,
  dispatchMineQuerySchema,
  listCarriersQuerySchema,
  printDispatchQuerySchema,
  savePackLinesInputSchema,
  signDispatchInputSchema,
  updateCarrierInputSchema,
} from './_shared/dispatch-contract';

/** The request schemas are the frozen contract's (`_shared/dispatch-contract.ts`); only the path params are local. */
export {
  addCarrierInputSchema,
  cancelDispatchInputSchema,
  dispatchMineQuerySchema,
  listCarriersQuerySchema,
  printDispatchQuerySchema,
  savePackLinesInputSchema,
  signDispatchInputSchema,
  updateCarrierInputSchema,
};

export const dispatchParamsSchema = z.object({ id: z.string().uuid() });
export const requisitionParamsSchema = z.object({ requisitionId: z.string().uuid() });
export const packDepartmentParamsSchema = z.object({ requisitionId: z.string().uuid(), departmentId: z.string().uuid() });
export const carrierParamsSchema = z.object({ id: z.string().uuid() });
