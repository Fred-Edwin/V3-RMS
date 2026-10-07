import { z } from 'zod';
export { runsQuerySchema } from '../_shared/prep-contract';

export const runIdParamSchema = z.object({ id: z.string().uuid() });
