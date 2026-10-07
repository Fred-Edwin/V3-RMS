import { z } from 'zod';
import { uuid } from '../../_shared/wire';

// The body is the frozen contract's (waste/_shared/waste-contract.ts); only the path parameter is new here.
export { reverseWasteInputSchema } from '../_shared/waste-contract';

export const wasteIdParamSchema = z.object({ id: uuid });
