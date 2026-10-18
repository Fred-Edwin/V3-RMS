import { z } from 'zod';
import { REASON_MAX_LENGTH } from './rota.constants';

/** The field shapes every rota validator file reuses, so an id, a day and a reason are checked the same way everywhere. */
export const idField = z.uuid();
export const nairobiDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const clockTimeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
export const reasonField = z.string().trim().max(REASON_MAX_LENGTH);
export const flagField = z.enum(['true', 'false']).transform((value) => value === 'true');
export const IdParamsSchema = z.object({ id: idField });
