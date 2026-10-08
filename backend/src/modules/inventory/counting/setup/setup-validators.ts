import { z } from 'zod';
import { uuid } from '../../_shared/wire';

/** The body and query schemas are the frozen contract's (`counting/_shared/counting-contract.ts`); nothing is redefined here. */
export {
  addItemsInputSchema,
  addItemsQuerySchema,
  addSectionInputSchema,
  layoutInputSchema,
  moveItemInputSchema,
  sectionIdParamSchema,
} from '../_shared/counting-contract';

/** Path parameters the contract leaves to the route: a move's id and an item's id. */
export const moveIdParamSchema = z.object({ id: uuid });
export const itemIdParamSchema = z.object({ itemId: uuid });
