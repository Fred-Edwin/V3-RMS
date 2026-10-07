import { z } from 'zod';
export { exportQuerySchema, needsLookQuerySchema } from '../_shared/prep-contract';

export const reviewRunParamSchema = z.object({ id: z.string().uuid() });
