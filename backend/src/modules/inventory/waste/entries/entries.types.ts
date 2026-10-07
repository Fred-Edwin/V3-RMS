import type { z } from 'zod';
import type { wasteListQuerySchema } from '../_shared/waste-contract';

export type { WasteList } from '../_shared/waste-contract';
export type WasteListQuery = z.infer<typeof wasteListQuerySchema>;
