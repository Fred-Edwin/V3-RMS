import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';
import { fromWire, toWire } from '../shared/utils/wire-names';
import type { DepartmentTag, UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  isDepartmentHead?: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  // The claim stays "organizationId" (wire name) so tokens match what the frontend already reads.
  return jwt.sign(toWire(payload), env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    return fromWire(decoded);
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    return decoded;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
};
