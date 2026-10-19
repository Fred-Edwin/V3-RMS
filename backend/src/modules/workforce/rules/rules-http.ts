import type { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '../../../utils/errors';
import type { AccessSubject } from '../_shared/workforce-access';
import { GroupParamsSchema } from './page/page-validators';
import type { RuleGroupCode } from './rules-schemas';

/** The small HTTP helpers every rules controller shares. */

export const subjectOf = (req: Request): AccessSubject => {
  const subject = req.workforceSubject ?? req.user;
  if (!subject) throw new UnauthorizedError('Authentication required');
  return subject;
};

/** The group named in the path. An unknown name is a 404, not a validation error: there is no such tab. */
export const groupOf = (req: Request): RuleGroupCode => {
  const parsed = GroupParamsSchema.safeParse(req.params);
  if (!parsed.success) throw new NotFoundError('Unknown rule group');
  return parsed.data.group;
};

export const ok =(res: Response, data: unknown): void => {
  res.status(200).json({ success: true, data });
};

export const created = (res: Response, data: unknown): void => {
  res.status(201).json({ success: true, data });
};
