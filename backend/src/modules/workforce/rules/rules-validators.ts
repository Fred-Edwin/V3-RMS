import { z } from 'zod';
import { RULE_SCHEMAS } from './rules-schemas';

const groups = Object.keys(RULE_SCHEMAS) as [keyof typeof RULE_SCHEMAS, ...(keyof typeof RULE_SCHEMAS)[]];

export const EffectiveQuerySchema = z.object({
  siteId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const VersionsParamsSchema = z.object({ group: z.enum(groups) });
export const VersionsQuerySchema = z.object({ siteId: z.string().uuid().optional() });
