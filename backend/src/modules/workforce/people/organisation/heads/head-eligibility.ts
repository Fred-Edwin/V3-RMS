import type { EmploymentStatus, PayType } from '@prisma/client';
import { ConflictError } from '../../../../../utils/errors';
import type { HeadRowRecord } from './heads-repository';

/** The facts the head rules need about the person being named. */
export interface HeadCandidateFacts {
  id: string;
  departmentId: string | null;
  userId: string | null;
  status: EmploymentStatus;
  payType: PayType;
  userIsActive: boolean;
}

export type IneligibleReason = 'NOT_IN_DEPARTMENT' | 'NOT_ACTIVE' | 'NO_LOGIN' | 'LOGIN_INACTIVE' | 'CASUAL';

const WORDS: Record<IneligibleReason, string> = {
  NOT_IN_DEPARTMENT: 'This person does not work in the department',
  NOT_ACTIVE: 'Only a person who is currently working can lead a department',
  NO_LOGIN: 'A head needs a login',
  LOGIN_INACTIVE: 'This person’s login is switched off',
  CASUAL: 'A casual cannot lead a department',
};

/** A head is an active, monthly employee of the department with a working login (contract 5.1). Null means eligible. */
export function ineligibleReason(person: HeadCandidateFacts, departmentId: string): IneligibleReason | null {
  if (person.departmentId !== departmentId) return 'NOT_IN_DEPARTMENT';
  if (person.status !== 'ACTIVE') return 'NOT_ACTIVE';
  if (person.payType === 'DAILY_RATE') return 'CASUAL';
  if (!person.userId) return 'NO_LOGIN';
  if (!person.userIsActive) return 'LOGIN_INACTIVE';
  return null;
}

export function assertEligible(person: HeadCandidateFacts, departmentId: string): void {
  const reason = ineligibleReason(person, departmentId);
  if (reason) throw new ConflictError(WORDS[reason], 'HEAD_NOT_ELIGIBLE', { reason });
}

/**
 * The rules about rows already open: nobody heads two departments (`ALREADY_HEAD`; move them first), and an acting head
 * who is already named needs `replaceActing`. An acting head here may be made the permanent head (a promotion).
 */
export function assertRowsAllow(
  mode: 'REPLACE' | 'ACTING',
  departmentId: string,
  personRows: readonly HeadRowRecord[],
  departmentRows: readonly HeadRowRecord[],
  replaceActing: boolean,
): void {
  const promotion = mode === 'REPLACE' && personRows.every((row) => row.departmentId === departmentId && row.isActing);
  if (personRows.length > 0 && !promotion) throw new ConflictError('This person already leads a department', 'ALREADY_HEAD');
  const acting = departmentRows.find((row) => row.isActing);
  if (mode === 'ACTING' && acting && !replaceActing) throw new ConflictError('An acting head is already named for this department', 'ACTING_HEAD_EXISTS');
}
