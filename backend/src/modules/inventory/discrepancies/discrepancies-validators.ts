import { z } from 'zod';
import { findingPreviewQuerySchema, listDiscrepanciesQuerySchema, recordFindingInputSchema, reverseFindingInputSchema } from './_shared/discrepancies-contract';

/** The request schemas are the frozen contract's (`_shared/discrepancies-contract.ts`); only the path params are local. */
export { findingPreviewQuerySchema, listDiscrepanciesQuerySchema, recordFindingInputSchema, reverseFindingInputSchema };

export const discrepancyParamsSchema = z.object({ id: z.string().uuid() });
