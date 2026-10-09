/** The request schemas are the frozen contract's (`counting/_shared/counting-contract.ts`); nothing is redefined here. */
import { pageQuerySchema } from '../../_shared/wire';

export { countDetailParamsSchema, countsListQuerySchema, countsSummaryQuerySchema, myCountsQuerySchema } from '../_shared/counting-contract';
/** C3 and C4 take only the numbered pager. */
export const pagerQuerySchema = pageQuerySchema;
