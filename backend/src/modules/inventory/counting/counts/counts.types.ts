import type { z } from 'zod';
import type { CountDetail, CountsHome, CountsList, CountsSummary, FlaggedList, MyCountsList, RepeatShortfallList } from '../_shared/counting-contract';
import type { countsListQuerySchema, countsSummaryQuerySchema, myCountsQuerySchema, pagerQuerySchema } from './counts-validators';

export type { CountDetail, CountsHome, CountsList, CountsSummary, FlaggedList, MyCountsList, RepeatShortfallList };
export type CountsListQuery = z.infer<typeof countsListQuerySchema>;
export type CountsSummaryQuery = z.infer<typeof countsSummaryQuerySchema>;
export type MyCountsQuery = z.infer<typeof myCountsQuerySchema>;
export type PagerQuery = z.infer<typeof pagerQuerySchema>;
