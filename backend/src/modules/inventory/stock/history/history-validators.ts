import { z } from 'zod';
import { uuid } from '../../_shared/wire';

// The query schemas are the frozen contract's (stock/_shared/stock-contract.ts); only the path parameter is new here.
export { ledgerQuerySchema, stockCardQuerySchema } from '../_shared/stock-contract';

export const itemIdParamSchema = z.object({ itemId: uuid });
