import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../../attendance/attendance-scope';
import { resolveActor } from '../../people/people-context';
import { periodsRepository } from '../periods/periods-repository';
import { timesheetEntry } from '../timesheets-audit';
import { assertCan } from '../timesheets-scope';
import { overtimeRepository } from './overtime-repository';
import type { OvertimeNoteBody } from './overtime-validators';

/**
 * A department head leaves one line on an overtime item of their own department (D24). It shows beside the evidence and decides
 * nothing. Once only, and only while the item is waiting and the month is not approved.
 */
export async function noteOvertime(subject: AccessSubject, itemId: string, body: OvertimeNoteBody, now: Date = new Date()): Promise<{ id: string; text: string; at: string }> {
  assertCan(subject, 'overtime.note');
  const item = await overtimeRepository.byIdAnywhere(itemId);
  if (!item) throw new NotFoundError('Overtime not found');
  const person = await personInScope(subject, 'overtime.note', item.employeeId, 'write');
  const period = await periodsRepository.find(item.siteId, item.periodId);
  if (!period) throw new NotFoundError('Period not found');
  if (period.state === 'APPROVED') throw new ConflictError('This month is approved.', 'PERIOD_APPROVED');
  if (item.status !== 'PENDING') throw new ConflictError('A note can be left only while the overtime is waiting.', 'NOT_PENDING');
  if (item.headNote) throw new ConflictError('A note has been left already.', 'ALREADY_NOTED');
  const ctx = await resolveActor(subject);
  const note = { byId: subject.id, text: body.text, at: now.toISOString() };
  await runAudited(async (tx) => {
    if ((await periodsRepository.lockState(tx, period.id)) === 'APPROVED') throw new ConflictError('This month is approved.', 'PERIOD_APPROVED');
    if (!(await overtimeRepository.setNote(tx, item.id, note))) throw new ConflictError('A note has been left already.', 'ALREADY_NOTED');
    const entry = timesheetEntry({ companyId: ctx.companyId, siteId: item.siteId, actor: ctx.auditActor, action: 'timesheet.overtime_noted', subjectId: item.employeeId, userId: person.userId, after: { date: item.shiftDate, note: body.text } });
    return { result: undefined, entries: [entry] };
  });
  return { id: item.id, text: note.text, at: note.at };
}
