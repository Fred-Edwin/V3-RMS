import { z } from 'zod';
import { uuid } from '../_shared/wire';

/**
 * Branch day's input schemas are the frozen contract's (`_shared/branch-day-contract.ts`); every body is `.strict()` there. This file
 * re-exports them for the controller and adds the two path-parameter schemas.
 */
export {
  acceptOpeningInputSchema,
  activityQuerySchema,
  closeDayInputSchema,
  correctCountInputSchema,
  countQuerySchema,
  entriesQuerySchema,
  historyQuerySchema,
  myHistoryQuerySchema,
  openingQuerySchema,
  recountOpeningInputSchema,
  recountPreviewInputSchema,
  saveCountInputSchema,
  sheetQuerySchema,
  signCountInputSchema,
  todayQuerySchema,
} from './_shared/branch-day-contract';

export const dayParamsSchema = z.object({ id: uuid });
export const dayDepartmentParamsSchema = z.object({ id: uuid, departmentId: uuid });
