import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiDateOf } from '../../_shared/time/nairobi-time';
import { inScope, type AccessSubject } from '../../_shared/workforce-access';
import { targetOf } from '../people-access';
import { resolveActor, told, todayOf } from '../people-context';
import type { FileRequestKind } from '../people.constants';
import type { EmployeeFileView, FileRequestRow } from '../people.types';
import { buildFileView, instantDate, loadReadableRow } from './employee-file-view';
import { employeesRepository } from './employees-repository';

const requestOf = (r: { id: string; kind: string; askedAt: Date; remindedAt: Date | null; resolvedAt: Date | null }): FileRequestRow => ({
  id: r.id,
  kind: r.kind as FileRequestKind,
  askedOn: nairobiDateOf(r.askedAt),
  remindedOn: instantDate(r.remindedAt),
  resolvedOn: instantDate(r.resolvedAt),
});

/** Asking a person for a detail, reminding them, and HR verifying the statutory numbers. Merged into `employeesService`. */
export const employeeRequestsService = {
  // ---- file requests (W25) --------------------------------------------------------------------------------------
  async askForDetail(subject: AccessSubject, id: string, kind: FileRequestKind): Promise<FileRequestRow> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (!inScope(subject, 'employee.write_basic', targetOf(row))) throw new ForbiddenError('You do not have permission to perform this action');
    if (row.userId === null) throw new ConflictError('This person has no login to ask', 'NO_LOGIN');
    const created = await employeesRepository.createFileRequest({ employeeId: row.id, kind, askedById: subject.id });
    await told([row.userId], 'file_request.asked', { kind });
    return requestOf(created);
  },

  async remind(subject: AccessSubject, id: string, requestId: string): Promise<FileRequestRow> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (!inScope(subject, 'employee.write_basic', targetOf(row))) throw new ForbiddenError('You do not have permission to perform this action');
    const request = await employeesRepository.findFileRequest(row.id, requestId);
    if (!request || request.resolvedAt) throw new NotFoundError('Request not found');
    const updated = await employeesRepository.remindFileRequest(request.id, new Date());
    await told([row.userId], 'file_request.reminded', { kind: updated.kind });
    return requestOf(updated);
  },

  // ---- verify statutory (W26) -----------------------------------------------------------------------------------
  async verifyStatutory(subject: AccessSubject, id: string): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (!inScope(subject, 'employee.write_sensitive', targetOf(row))) throw new ForbiddenError('You do not have permission to perform this action');
    if (!row.nssfNumber || !row.shaNumber) throw new ConflictError('NSSF and SHA numbers are not both on file', 'STATUTORY_INCOMPLETE');
    await runAudited(async (tx) => {
      await employeesRepository.updateEmployee(tx, row.id, ctx.companyId, { statutoryVerifiedAt: new Date(), statutoryVerifiedById: subject.id });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.statutory_verified',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
          },
        ],
      };
    });
    const today = todayOf();
    return buildFileView(subject, await loadReadableRow(ctx, id, today), today);
  },
};
