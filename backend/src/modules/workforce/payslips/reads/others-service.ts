import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday, fromDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { ForbiddenError } from '../../../../utils/errors';
import { resolveActor } from '../../people/people-context';
import { payslipFile, type PayslipFile } from '../documents/document-service';
import { payslipActor } from '../payslips-context';
import { buildDetail, type PayslipDetail } from './detail-builder';
import { recordOpening, type OpenPurpose } from './open-audit';
import { recordOfPayslip, recordsOf } from './records';
import { readsRepository, type EmployeeFacts } from './reads-repository';

async function target(subject: AccessSubject, id: string) {
  const ctx = await payslipActor(subject, 'payslip.read_any');
  const row = await readsRepository.payslipById(id);
  const employee = row ? await readsRepository.employeeById(ctx.companyId, row.employeeId) : null;
  const record = row && employee ? await recordOfPayslip(row) : null;
  if (!row || !employee || !record) throw new NotFoundError('We could not find that payslip.', 'NO_PAYSLIP');
  return { ctx, employee: employee as EmployeeFacts, record, allRecords: await recordsOf(ctx.companyId, employee.id) };
}

/**
 * PD5: HR and the Accountant open anyone's published payslip from the Payroll page, with no staff code. Every opening is recorded with
 * the opener's name and role (the person sees it under Activity on my record) and counts toward the Director's daily digest.
 */
export async function openAny(subject: AccessSubject, id: string, version: number | null, deviceLabel: string | null, now: Date = new Date()): Promise<PayslipDetail> {
  const t = await target(subject, id);
  const built = await buildDetail({ employee: t.employee, record: t.record, allRecords: t.allRecords, version, today: nairobiToday(now), pathBase: '/workforce/payslips' });
  await recordOpening({ companyId: t.ctx.companyId, actor: t.ctx.auditActor, employee: t.employee, record: t.record, version: built.versionNumber, purpose: 'view', ownerOpened: t.employee.userId === subject.id, deviceLabel, confirmed: null }, now);
  return built;
}

export async function documentAny(subject: AccessSubject, id: string, version: number | null, purpose: OpenPurpose, deviceLabel: string | null, now: Date = new Date()): Promise<PayslipFile> {
  const t = await target(subject, id);
  const v = version ?? t.record.latest.version;
  const file = await payslipFile(t.employee, t.record, t.allRecords, v);
  await recordOpening({ companyId: t.ctx.companyId, actor: t.ctx.auditActor, employee: t.employee, record: t.record, version: v, purpose, ownerOpened: t.employee.userId === subject.id, deviceLabel, confirmed: null }, now);
  return file;
}

export interface DigestRow {
  openerId: string;
  name: string;
  role: string;
  day: NairobiDate;
  count: number;
}

/** The Director's row per opener for a day: "HR opened 12 payslips today" (PD5). Counts only, no names of the people opened. */
export async function openingsOfDay(subject: AccessSubject, day: NairobiDate): Promise<DigestRow[]> {
  if (!workforceCan(subject, 'audit.read.payslip_access')) throw new ForbiddenError('You do not have permission to perform this action');
  const ctx = await resolveActor(subject);
  const rows = await readsRepository.digestOfDay(ctx.companyId, day);
  const names = await readsRepository.names(rows.map((r) => r.openerId));
  return rows.map((r) => ({ openerId: r.openerId, name: names.get(r.openerId)?.name ?? '', role: names.get(r.openerId)?.role ?? '', day: fromDateColumn(r.day), count: r.openCount }));
}
