import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenError, UnauthorizedError } from '../../../../utils/errors';
import { verifyAccessToken } from '../../../../utils/jwt';
import { devicesRepository, hashDeviceId } from '../devices/devices-repository';
import { createSessionCache } from './session-cache';
import { sessionRepository } from './session-repository';

interface SessionState {
  /** When "This wasn't me" was last pressed (seconds, for comparing with a token's `iat`); null = never. */
  raisedAtSeconds: number | null;
  mustChangePassword: boolean;
  phoneRemoved: boolean;
}

const cache = createSessionCache<SessionState>();
export const forgetSession = (userId: string): void => cache.forget(userId);

/** Open to a person who must choose a password, or whose phone is asking again: only what they need to get back in. */
const OPEN_WHILE_RESETTING = ['/workforce/security/reset-password', '/workforce/security/state', '/workforce/permissions/me'];
const OPEN_FOR_REMOVED_PHONE = ['/workforce/security/phones/me/current/seen'];

async function stateOf(userId: string, deviceId: string | null, now: number): Promise<SessionState> {
  const key = `${userId}:${deviceId ?? ''}`;
  const hit = cache.get(key, now);
  if (hit) return hit;
  const [flag, device] = await Promise.all([sessionRepository.flagOf(userId), deviceId ? devicesRepository.findByHash(userId, deviceId) : Promise.resolve(null)]);
  const state: SessionState = {
    raisedAtSeconds: flag ? Math.floor(flag.raisedAt.getTime() / 1000) : null,
    mustChangePassword: flag?.mustChangePassword === true,
    phoneRemoved: device !== null && device.removedAt !== null,
  };
  cache.set(key, state, now);
  return state;
}

/**
 * Mounted once in front of every `/workforce` route (routes/index.ts), because the old sign-in code may not change in this segment.
 *   - a token issued before the person pressed "This wasn't me" is refused (401 SESSION_ENDED): every session ends at once here;
 *   - a person who must choose a new password can reach only the reset, their state and their permissions (403 PASSWORD_RESET_REQUIRED);
 *   - a phone the person removed is refused (401 PHONE_REMOVED) until it signs in and is asked "Is this your phone?" again.
 * A request with no usable token passes through: the route's own `authenticate` answers it. The old (non-Workforce) routes are not
 * covered; closing that is one check in `authenticate`, listed in decisions-6a-backend.md.
 */
export async function workforceSessionGate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    const token = header.slice('Bearer '.length).trim();
    let userId: string;
    try {
      userId = verifyAccessToken(token).userId;
    } catch {
      return next();
    }
    const issuedAt = (jwt.decode(token) as { iat?: number } | null)?.iat ?? Number.MAX_SAFE_INTEGER;
    const deviceHeader = req.header('x-device-id');
    const state = await stateOf(userId, deviceHeader && /^[A-Za-z0-9._-]{8,64}$/.test(deviceHeader) ? deviceHeader : null, Date.now());
    if (state.raisedAtSeconds !== null && issuedAt < state.raisedAtSeconds) throw new UnauthorizedError('Please sign in again.', 'SESSION_ENDED');
    const path = req.path.replace(/\/+$/, '');
    if (state.mustChangePassword && !OPEN_WHILE_RESETTING.includes(path)) throw new ForbiddenError('Choose a new password to come back in.', 'PASSWORD_RESET_REQUIRED');
    if (state.phoneRemoved && !OPEN_FOR_REMOVED_PHONE.includes(path)) throw new UnauthorizedError('This phone was removed. Sign in again.', 'PHONE_REMOVED');
    next();
  } catch (error) {
    next(error);
  }
}

export { hashDeviceId };
