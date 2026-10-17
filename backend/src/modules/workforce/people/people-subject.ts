import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../../utils/errors';
import { nairobiToday, toDateColumn } from '../_shared/time/nairobi-time';
import type { AccessSubject } from '../_shared/workforce-access';
import { employeesRepository, type SubjectFacts } from './employees-repository';

export type { SubjectFacts };

export const buildSubject = (user: NonNullable<Request['user']>, facts: SubjectFacts): AccessSubject => ({
  ...user,
  ...(facts.tracksTime === null ? {} : { tracksTime: facts.tracksTime }),
  headOfDepartmentIds: facts.headOfDepartmentIds,
});

/** After `authenticate`. Sets req.workforceSubject for requireCapability, assertInScope and the services. */
export const attachWorkforceSubject = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  const facts = await employeesRepository.loadSubjectFacts(req.user.id, toDateColumn(nairobiToday(new Date())));
  req.workforceSubject = buildSubject(req.user, facts);
  next();
};
