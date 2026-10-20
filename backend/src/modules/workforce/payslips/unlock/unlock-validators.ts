import { z } from 'zod';

/** The phone's own random id, kept in its local storage. Opaque: the server only compares it. */
export const deviceId = z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9._-]+$/, 'Not a device id');
const code = z.string().regex(/^\d{4}$/, 'Your code is 4 digits');

export const unlockBody = z.object({ code, deviceId }).strict();
export const firstCodeBody = z.object({ code, deviceId }).strict();
export const lockBody = z.object({ deviceId }).strict();
export type UnlockBody = z.infer<typeof unlockBody>;
