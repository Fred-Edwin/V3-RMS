import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import type { AccessSubject } from '../_shared/workforce-access';

/** The two things every rota controller needs: who is asking (with their head rows) and the success envelope. */
export const subjectOf = (req: Request): AccessSubject => {
  const subject = req.workforceSubject ?? req.user;
  if (!subject) throw new UnauthorizedError('Authentication required');
  return subject;
};

export const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};
