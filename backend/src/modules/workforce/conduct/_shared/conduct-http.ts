import type { Request } from 'express';
import { env } from '../../../../config/env';
import { deviceLabelOf } from '../../payslips/unlock/unlock-rules';

export { ok, subjectOf } from '../../rota/rota-http';

/** "Android, Chrome" from the request, for the audit entry of a signed action. Never the digits of a code. */
export const deviceLabel = (req: Request): string | null => deviceLabelOf(req.get('user-agent'));

/** The site address a letter's QR points at. */
export const frontendOrigin = (): string => env.FRONTEND_ORIGIN;
