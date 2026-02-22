import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';

export const branchScope = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }

  req.user.organizationId = req.user.organizationId ?? null;
  next();
};
