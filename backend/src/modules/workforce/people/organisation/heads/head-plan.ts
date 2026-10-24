import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../../../../../utils/errors';
import { parseNairobiDate, toDateColumn, type NairobiDate } from '../../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../../_shared/workforce-access';
import { claimsFromHeadRows, type HeadRow } from '../../rules/head-claims';
import type { ActorCtx } from '../../people-context';
import { actingEndsOn } from '../../people-dates';
import { departmentsRepository, type DepartmentRecord } from '../departments/departments-repository';
import { assertCanReadDepartment, assertCanWriteIn } from '../org-scope';
import type { AssignHeadBody } from '../org-validators';
import { assertEligible, assertRowsAllow } from './head-eligibility';
import { claimsOf } from './head-sync';
import { headsRepository, type HeadRowRecord } from './heads-repository';

/**
 * Everything an assignment needs, read and checked once, so the preview and the real call can never disagree.
 * `ending` are the rows that end; `newRow` is the row that starts.
 */
export interface HeadPlan {
  department: DepartmentRecord;
  person: NonNullable<Awaited<ReturnType<typeof headsRepository.findPerson>>>;
  today: NairobiDate;
  mode: AssignHeadBody['mode'];
  returnsOn: NairobiDate | null;
  ending: { row: HeadRowRecord; reason: string }[];
  newRow: { isActing: boolean; endsOn: NairobiDate | null };
}

type Tx = Prisma.TransactionClient | undefined;

/** A department the caller may change heads in: it exists, is theirs to change, is active and is not the Central Store. */
export async function loadDepartmentForHeads(subject: AccessSubject, ctx: ActorCtx, id: string, access: 'read' | 'write'): Promise<DepartmentRecord> {
  const department = await departmentsRepository.findDepartment(ctx.companyId, id);
  if (!department) throw new NotFoundError('Department not found');
  if (access === 'write') assertCanWriteIn(subject, 'org.write_heads', { siteId: department.siteId, id: department.id });
  else assertCanReadDepartment(subject, department);
  if (department.site.isHub) throw new ConflictError('The Central Store has no department heads', 'HUB_HAS_NO_HEADS');
  if (department.status !== 'ACTIVE') throw new ConflictError('This department is retired', 'DEPARTMENT_RETIRED');
  return department;
}

export async function planAssignment(
  subject: AccessSubject,
  ctx: ActorCtx,
  departmentId: string,
  body: AssignHeadBody,
  today: NairobiDate,
  tx: Tx = undefined,
): Promise<HeadPlan> {
  const department = await loadDepartmentForHeads(subject, ctx, departmentId, 'write');
  const person = await headsRepository.findPerson(ctx.companyId, body.employeeId, tx);
  if (!person) throw new ConflictError('That person is not an employee of this company', 'HEAD_NOT_ELIGIBLE', { reason: 'NOT_FOUND' });
  assertEligible({ id: person.id, departmentId: person.departmentId, userId: person.userId, status: person.status, payType: person.payType, userIsActive: person.user?.isActive === true }, department.id);

  const todayColumn = toDateColumn(today);
  const [personRows, departmentRows] = await Promise.all([
    headsRepository.activeRowsOfEmployee(person.id, todayColumn, tx),
    headsRepository.activeRowsOfDepartment(department.id, todayColumn, tx),
  ]);
  assertRowsAllow(body.mode, department.id, personRows, departmentRows, body.replaceActing);

  let returnsOn: NairobiDate | null = null;
  if (body.mode === 'ACTING') {
    returnsOn = parseNairobiDate(body.returnsOn!);
    if (returnsOn <= today) throw new ValidationError('The head must return after today', 'INVALID_RETURN_DATE');
  }

  const ending: HeadPlan['ending'] = [];
  for (const row of departmentRows) {
    if (body.mode === 'REPLACE') ending.push({ row, reason: row.isActing ? 'HEAD_APPOINTED' : 'REPLACED' });
    else if (row.isActing) ending.push({ row, reason: 'REPLACED' }); // replaceActing was checked above
  }
  return { department, person, today, mode: body.mode, returnsOn, ending, newRow: { isActing: body.mode === 'ACTING', endsOn: returnsOn ? actingEndsOn(returnsOn) : null } };
}

/** The claims the named person would carry after the change, from the rows they would hold. */
export function claimsAfter(plan: HeadPlan): { isDepartmentHead: boolean; departmentTag: HeadRow['departmentInventoryTag'] } {
  const row: HeadRow = { startsOn: plan.today, endsOn: plan.newRow.endsOn, isActing: plan.newRow.isActing, departmentInventoryTag: plan.department.key };
  const { isDepartmentHead, departmentTag } = claimsFromHeadRows([row], plan.today);
  return { isDepartmentHead, departmentTag };
}

export const claimsBefore = (rows: readonly HeadRowRecord[], today: NairobiDate): { isDepartmentHead: boolean; departmentTag: HeadRow['departmentInventoryTag'] } => {
  const { isDepartmentHead, departmentTag } = claimsOf(rows, today);
  return { isDepartmentHead, departmentTag };
};
