import { z } from 'zod';
import { deviceId } from '../unlock/unlock-validators';

const id = z.string().uuid();
const version = z.coerce.number().int().min(1).max(20).optional();
const year = z.coerce.number().int().min(2020).max(2100);

export const idParams = z.object({ id }).strict();
export const detailQuery = z.object({ v: version }).strict();
export const documentQuery = z.object({ v: version, purpose: z.enum(['view', 'download', 'share']).default('view') }).strict();
export const historyQuery = z.object({ year: year.optional() }).strict();
export const yearParams = z.object({ year }).strict();
export const p9PersonParams = z.object({ year, employeeId: id }).strict();
export const dayQuery = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict();
export const confirmBody = z.object({ pin: z.string().regex(/^\d{4}$/, 'Your PIN is 4 digits') }).strict();

/** The phone sends its own random id with every payslip read; the unlock token is bound to it. */
export const phoneHeader = deviceId;
