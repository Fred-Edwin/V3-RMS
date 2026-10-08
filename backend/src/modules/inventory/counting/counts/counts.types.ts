import type { z } from 'zod';
import type { CountDetail, CountsList, CountsSummary, FlaggedList, RepeatShortfallList } from '../_shared/counting-contract';
import type { countsListQuerySchema, countsSummaryQuerySchema, pagerQuerySchema } from './counts-validators';

export type { CountDetail, CountsList, CountsSummary, FlaggedList, RepeatShortfallList };
export type CountsListQuery = z.infer<typeof countsListQuerySchema>;
export type CountsSummaryQuery = z.infer<typeof countsSummaryQuerySchema>;
export type PagerQuery = z.infer<typeof pagerQuerySchema>;
