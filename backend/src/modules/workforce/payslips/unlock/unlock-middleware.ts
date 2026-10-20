import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../../utils/errors';
import { tokenHash } from './unlock-service';
import { unlockRepository } from './unlock-repository';
import { unlockState } from './unlock-rules';

export const UNLOCK_HEADER = 'x-payslip-unlock';
export const DEVICE_HEADER = 'x-device-id';

const refuse = (reason: string): never => {
  // 403, not 401: the apps treat a 401 as "signed out", and an expired unlock is only a screen lock (PD2).
  throw new ForbiddenError('Open your payslips with your code.', 'UNLOCK_REQUIRED', { reason });
};

/**
 * Every payslip read that shows pay needs a live unlock token (PD7). The token must belong to the signed-in person and the phone named
 * in `x-device-id`, must not be revoked, past the hard cap or idle for 10 minutes. A good call counts as a tap and keeps it open.
 */
export async function requireUnlock(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const token = req.header(UNLOCK_HEADER);
  const device = req.header(DEVICE_HEADER);
  if (!token || !device) return refuse('missing');
  const row = await unlockRepository.findUnlock(tokenHash(token));
  if (!row || row.userId !== req.user.id || row.deviceId !== device) return refuse('unknown');
  const now = new Date();
  const state = unlockState(row, now);
  if (state !== 'OPEN') return refuse(state.toLowerCase());
  await unlockRepository.touch(row.id, now);
  next();
}
