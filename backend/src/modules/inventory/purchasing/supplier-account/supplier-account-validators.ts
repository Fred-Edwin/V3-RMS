import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date');

export const IdParamSchema = z.object({ id: z.string().uuid() });
export const StatementQuerySchema = z.object({ from: isoDate.optional(), to: isoDate.optional(), format: z.enum(['json', 'csv']).default('json') });

export type StatementQuery = z.infer<typeof StatementQuerySchema>;
