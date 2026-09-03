import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';

type Guard = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Wrap a role guard so a department head is also let through, regardless of
 * their base role. Since 2026-09-03 "department head" is a marker
 * (`req.user.isDepartmentHead`), not a `UserRole`, so it cannot be passed to
 * `requireRole(...)` — this combinator is how a scheduling endpoint admits both
 * "MANAGER/HR_MANAGER/…" and "any department head".
 *
 *   allowDepartmentHead(requireRole('MANAGER', 'HR_MANAGER'))
 */
export const allowDepartmentHead = (guard: Guard): Guard => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (req.user.isDepartmentHead) {
      next();
      return;
    }
    guard(req, res, next);
  };
};
