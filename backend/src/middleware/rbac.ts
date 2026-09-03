import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    next();
  };
};

/**
 * Gate an endpoint on the department-head marker rather than a role. A head
 * keeps their base role (WAITER/CHEF/…) and carries `isDepartmentHead` on top —
 * see docs/context/DEPARTMENT_HEAD_MODEL_REFACTOR.md.
 */
export const requireDepartmentHead = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  if (!req.user.isDepartmentHead) {
    throw new ForbiddenError('You do not have permission to perform this action');
  }
  next();
};
