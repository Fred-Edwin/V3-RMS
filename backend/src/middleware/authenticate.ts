import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Missing access token');
  }

  const payload = verifyAccessToken(token);
  req.user = {
    id: payload.userId,
    role: payload.role,
    organizationId: payload.organizationId,
    departmentTag: payload.departmentTag,
    isDepartmentHead: payload.isDepartmentHead ?? false,
  };

  next();
};
