import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { fromDateColumn, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { employeesRepository } from '../../people/employees/employees-repository';
import { told } from '../../people/people-context';
import { roleLabel } from '../../timesheets/approval/decided-by';
import { longStamp } from '../../timesheets/exports/export-format';
import { payslipActor, payslipEntry } from '../payslips-context';
import { latestPerMonth } from '../reads/payslip-model';
import { publicationOf } from '../reads/publication';
import { recordsOf, versionData } from '../reads/records';
import { readsRepository, type EmployeeFacts } from '../reads/reads-repository';
import { P9_LAYOUT_VERSION } from './p9-layout';
import { p9Rows, p9Totals } from './p9-model';
import { p9Repository } from './p9-repository';
import { renderP9Pdf } from './p9-pdf';
import { availableFrom, monthStates, p9Number, p9Status, type P9Status } from './p9-rules';

export interface P9Summary {
  year: number;
  status: P9Status;
  availableFrom: NairobiDate | null;
  formatConfirmed: boolean;
}

const dateOf = (d: Date): NairobiDate => fromDateColumn(d);

/** Where the card stands for one person and year (S4, S12). Never builds anything. */
export async function p9StatusFor(companyId: string, employee: EmployeeFacts, year: number, now: Date): Promise<P9Summary> {
  const [months, confirmation] = await Promise.all([readsRepository.months(companyId), p9Repository.confirmation(companyId, P9_LAYOUT_VERSION)]);
  const pub = await publicationOf(months);
  const fact = (monthKey: string) => {
    const m = months.find((x) => x.monthKey === monthKey);
    const p = m ? pub.get(m.id) : undefined;
    return m && p ? { paid: p.paid, paidOn: p.paidOn } : null;
  };
  const exit = employee.exitedOn ? dateOf(employee.exitedOn) : null;
  const exitMonthKey = exit ? exit.slice(0, 7) : null;
  const from = availableFrom({ year, exitMonthKey, december: fact(`${year}-12`), finalMonth: exitMonthKey ? fact(exitMonthKey) : null });
  const formatConfirmed = confirmation !== null;
  return { year, status: p9Status({ today: nairobiToday(now), availableFrom: from, formatConfirmed }), availableFrom: from, formatConfirmed };
}

export interface P9File {
  bytes: Buffer;
  filename: string;
  number: string;
  hash: string;
}

/** Builds the card from the frozen payslips, or returns the one already built. A missing KRA PIN or a month with no payslip stops it and tells HR. */
async function cardFor(ctx: { companyId: string; auditActor: Parameters<typeof payslipEntry>[0]['actor'] }, actorId: string, employee: EmployeeFacts, year: number, now: Date): Promise<P9File> {
  const existing = await p9Repository.document(employee.id, year, P9_LAYOUT_VERSION);
  const file = (row: { bytes: Uint8Array | Buffer; number: string; hash: string }): P9File => ({ bytes: Buffer.from(row.bytes), number: row.number, hash: row.hash, filename: `${row.number}.pdf` });
  if (existing) return file(existing);
  if (!employee.kraPin) {
    await told(await employeesRepository.userIdsByRole(ctx.companyId, 'HR_MANAGER'), 'p9.no_kra_pin', { employeeId: employee.id, year });
    throw new ConflictError('The tax card cannot be made until a KRA PIN is on file. HR has been told.', 'P9_NO_KRA_PIN');
  }
  const records = (await recordsOf(ctx.companyId, employee.id)).filter((r) => r.monthKey.startsWith(`${year}-`));
  const exit = employee.exitedOn ? dateOf(employee.exitedOn) : null;
  const states = monthStates(year, dateOf(employee.startDate), exit, new Set(records.map((r) => r.monthKey)));
  if (records.length === 0) throw new NotFoundError('There are no payslips for that year.', 'P9_NO_PAYSLIPS');
  if (states.some((s) => s.state === 'NO_PAYSLIP')) throw new ConflictError('A month of that year has no payslip. HR must sort that out before the tax card is made.', 'P9_MONTH_MISSING');
  const latest = new Map(latestPerMonth(records.map((r) => ({ monthKey: r.monthKey, version: r.latest.version, r }))).map((x) => [x.monthKey, versionData(x.r, x.r.latest)]));
  const rows = p9Rows(states, latest);
  const totals = p9Totals(rows);
  const confirmation = await p9Repository.confirmation(ctx.companyId, P9_LAYOUT_VERSION);
  const signerId = confirmation?.confirmedById ?? null;
  const signer = signerId ? (await readsRepository.names([signerId])).get(signerId) : undefined;
  const number = p9Number(year, employee.employeeNumber);
  const doc = {
    number, layoutVersion: P9_LAYOUT_VERSION, year, site: employee.siteName,
    employee: { name: employee.name, number: employee.employeeNumber, kraPin: employee.kraPin, jobTitle: employee.position ?? '—' },
    rows, totals,
    signer: signer ? { name: signer.name, roleLine: `${signer.name}, ${roleLabel(signer.role)}`, signedAt: longStamp(confirmation!.confirmedAt) } : null,
    generatedLong: longStamp(now), created: now,
    hashPrefix: createHash('sha256').update(JSON.stringify({ number, rows, totals })).digest('hex').slice(0, 10),
  };
  const bytes = await renderP9Pdf(doc);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const row = await runAudited(async (tx) => {
    await p9Repository.lockCard(tx, employee.id, year);
    const again = await p9Repository.documentIn(tx, employee.id, year, P9_LAYOUT_VERSION);
    if (again) return { result: again, entries: [] };
    const made = await p9Repository.create(tx, { companyId: ctx.companyId, employeeId: employee.id, year, layoutVersion: P9_LAYOUT_VERSION, number, bytes, hash, data: { rows, totals } as unknown as Prisma.InputJsonValue, generatedById: actorId, generatedAt: now });
    return { result: made, entries: [payslipEntry({ companyId: ctx.companyId, siteId: employee.siteId, actor: ctx.auditActor, action: 'p9.generated', category: 'DOCUMENTS', subjectType: 'P9', subjectId: made.id, subjectUserId: employee.userId, after: { number, year, layoutVersion: P9_LAYOUT_VERSION } })] };
  });
  return file(row);
}

async function openAudit(ctx: { companyId: string; auditActor: Parameters<typeof payslipEntry>[0]['actor'] }, employee: EmployeeFacts, file: P9File, year: number, openerRole: string, ownerOpened: boolean, deviceLabel: string | null): Promise<void> {
  await runAudited(async () => ({ result: null, entries: [payslipEntry({ companyId: ctx.companyId, siteId: employee.siteId, actor: ctx.auditActor, action: 'payslip.p9_opened', category: 'PAYSLIP_ACCESS', subjectType: 'P9', subjectId: employee.id, subjectUserId: employee.userId, after: { number: file.number, year, openerRole, ownerOpened, confirmed: false }, deviceLabel })] }));
}

/** The person's own card, after the code. Only when it is available and the Accountant has confirmed the layout (PD13, PD14). */
export async function myP9Document(subject: AccessSubject, year: number, deviceLabel: string | null, now: Date = new Date()): Promise<P9File> {
  const ctx = await payslipActor(subject, 'me.payslip');
  const employee = await readsRepository.employeeOfUser(subject.id);
  if (!employee) throw new NotFoundError('There is no tax card for that year.', 'P9_NONE');
  const summary = await p9StatusFor(ctx.companyId, employee, year, now);
  if (summary.status !== 'READY') throw new ConflictError(summary.status === 'WAITING_FORMAT' ? 'Waiting for the Accountant to confirm the P9 format.' : 'Your tax card is not ready yet.', 'P9_NOT_AVAILABLE', { status: summary.status, availableFrom: summary.availableFrom });
  const file = await cardFor(ctx, subject.id, employee, year, now);
  await openAudit(ctx, employee, file, year, subject.role, true, deviceLabel);
  return file;
}

export async function myP9Status(subject: AccessSubject, year: number, now: Date = new Date()): Promise<P9Summary> {
  const ctx = await payslipActor(subject, 'me.payslip');
  const employee = await readsRepository.employeeOfUser(subject.id);
  if (!employee) return { year, status: 'NOT_YET', availableFrom: null, formatConfirmed: false };
  return p9StatusFor(ctx.companyId, employee, year, now);
}

/** HR or the Accountant builds (or fetches) a person's card, for a leaver HR hands it to; the opening is audited like a payslip (PD5). */
export async function generateP9(subject: AccessSubject, year: number, employeeId: string, deviceLabel: string | null, now: Date = new Date()): Promise<P9File & P9Summary> {
  const ctx = await payslipActor(subject, 'p9.generate');
  const employee = await readsRepository.employeeById(ctx.companyId, employeeId);
  if (!employee) throw new NotFoundError('There is no such person.', 'NO_EMPLOYEE');
  const summary = await p9StatusFor(ctx.companyId, employee, year, now);
  if (summary.status !== 'READY') throw new ConflictError(summary.status === 'WAITING_FORMAT' ? 'Waiting for the Accountant to confirm the P9 format.' : 'The tax card is not available yet.', 'P9_NOT_AVAILABLE', { status: summary.status, availableFrom: summary.availableFrom });
  const file = await cardFor(ctx, subject.id, employee, year, now);
  await openAudit(ctx, employee, file, year, subject.role, false, deviceLabel);
  return { ...file, ...summary };
}

/** The Accountant vouches for the P9 layout, once, with a PIN (PD14). Until then nobody can download a card. */
export async function confirmP9Format(subject: AccessSubject, pin: string, now: Date = new Date()): Promise<{ layoutVersion: number; confirmed: true; already: boolean }> {
  const ctx = await payslipActor(subject, 'p9.confirm_format');
  const already = await p9Repository.confirmation(ctx.companyId, P9_LAYOUT_VERSION);
  if (already) return { layoutVersion: P9_LAYOUT_VERSION, confirmed: true, already: true };
  await verifySignerPin(subject.id, pin, now.getTime());
  const made = await runAudited(async (tx) => {
    const created = await p9Repository.confirm(tx, { companyId: ctx.companyId, layoutVersion: P9_LAYOUT_VERSION, confirmedById: subject.id });
    return { result: created, entries: created ? [payslipEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'p9.format_confirmed', category: 'PAY_RUN_DECIDE', subjectType: 'P9Format', subjectId: `${ctx.companyId}:${P9_LAYOUT_VERSION}`, after: { layoutVersion: P9_LAYOUT_VERSION, method: 'PIN' } })] : [] };
  });
  return { layoutVersion: P9_LAYOUT_VERSION, confirmed: true, already: !made };
}
