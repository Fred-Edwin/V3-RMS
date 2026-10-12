import { z } from 'zod';
import { uuid } from '../../_shared/wire';

// The schemas are the frozen contract's (waste/_shared/waste-contract.ts, BW1 to BW7); nothing is redefined here.
export {
  allBranchesWasteQuerySchema,
  branchWasteItemsQuerySchema,
  branchWasteListQuerySchema,
  logBranchWasteInputSchema,
  myBranchWasteQuerySchema,
  reverseBranchWasteInputSchema,
} from '../_shared/waste-contract';

/** `:id` is a waste entry's uuid (BW6, BW7). */
export const branchWasteIdParamSchema = z.object({ id: uuid });
