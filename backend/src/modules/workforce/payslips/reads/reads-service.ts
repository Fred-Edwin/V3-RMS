import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import type { ActorCtx } from '../../people/people-context';
import { payslipFile, type PayslipFile } from '../documents/document-service';
import { p9StatusFor } from '../p9/p9-service';
import { payslipActor } from '../payslips-context';
import { unlockRepository } from '../unlock/unlock-repository';
import { buildDetail, versionInfos, type PayslipDetail, type VersionInfo } from './detail-builder';
import { legacyStateOf, type LegacyState } from './legacy-card';
import { recordOpening, type OpenPurpose } from './open-audit';
import { last4, latestPerMonth, yearTotals } from './payslip-model';
import { isDeviceConfirmed } from '../unlock/device-source';
import { recordOfPayslip, recordsOf, versionData, type MonthRecord } from './records';
import { readsRepository, type EmployeeFacts } from './reads-repository';

export interface Phone {
  id: string;
  label: string | null;
  /** A coarse place from the tunnel's location headers (never an address); null when unknown. */
  placeLabel?: string | null;
}

interface Own {
  ctx: ActorCtx;
  employee: EmployeeFacts | null;
  records: MonthRecord[];
}

async function own(subject: AccessSubject): Promise<Own> {
  const ctx = await payslipActor(subject, 'me.payslip');
  const employee = await readsRepository.employeeOfUser(subject.id);
  return { ctx, employee, records: employee ? await recordsOf(ctx.companyId, employee.id) : [] };
}

const item = (r: MonthRecord) => ({
  id: r.first.id,
  month: r.monthKey,
  versionNumber: r.latest.version,
  correctedAt: r.latest.correctedAt?.toISOString() ?? null,
  payDay: r.pub.payDay,
  paidOn: r.pub.paidOn,
  status: r.pub.paid ? ('PAID' as const) : ('PUBLISHED' as const),
});

/** Only the owner's payslip, current run, published. Anything else is the same 404 as a payslip that does not exist (S1). */
async function ownRecord(subject: AccessSubject, id: string): Promise<{ o: Own & { employee: EmployeeFacts }; record: MonthRecord }> {
  const o = await own(subject);
  const row = await readsRepository.payslipById(id);
  if (!o.employee || !row || row.employeeId !== o.employee.id) throw new NotFoundError('We could not find that payslip.', 'NO_PAYSLIP');
  const record = await recordOfPayslip(row);
  if (!record) throw new NotFoundError('We could not find that payslip.', 'NO_PAYSLIP');
  return { o: { ...o, employee: o.employee }, record };
}

/** The list the locked screen shows (S1): months and pay days, never an amount. Needs no unlock token. */
export async function list(subject: AccessSubject) {
  const o = await own(subject);
  const legacy = await legacyStateOf(subject.id, o.employee?.siteId ?? subject.siteId);
  return { unlockRequired: true as const, hasCode: await unlockRepository.hasCode(subject.id), items: o.records.map(item), legacyAvailable: legacy.hasOldPayslips, legacy };
}

/** My payslips home (S2): the newest payslip, the year so far, the recent months. */
export async function home(subject: AccessSubject) {
  const o = await own(subject);
  const newest = o.records[0];
  const legacy: LegacyState = await legacyStateOf(subject.id, o.employee?.siteId ?? subject.siteId);
  if (!newest || !o.employee) return { latest: null, ytd: null, recent: [], legacyAvailable: legacy.hasOldPayslips, legacy };
  const year = newest.monthKey.slice(0, 4);
  const months = latestPerMonth(o.records.filter((r) => r.monthKey.startsWith(`${year}-`)).map((r) => ({ monthKey: r.monthKey, version: r.latest.version, r }))).map((x) => versionData(x.r, x.r.latest));
  const e = o.employee;
  return {
    latest: { ...item(newest), net: newest.latest.net.toFixed(2), bank: e.bankName ? { name: e.bankName, last4: last4(e.accountNumber) } : null },
    ytd: { fromMonth: months[0]?.monthKey ?? newest.monthKey, toMonth: newest.monthKey, ...yearTotals(months) },
    recent: o.records.slice(0, 6).map((r) => ({ ...item(r), net: r.latest.net.toFixed(2) })),
    legacyAvailable: legacy.hasOldPayslips,
    legacy,
  };
}

/** One payslip (S3, S11). Opening it is recorded, with the phone and the purpose. */
export async function detail(subject: AccessSubject, id: string, version: number | null, phone: Phone, now: Date = new Date()): Promise<PayslipDetail> {
  const { o, record } = await ownRecord(subject, id);
  const built = await buildDetail({ employee: o.employee, record, allRecords: o.records, version, today: nairobiToday(now), pathBase: '/workforce/payslips/me' });
  await opened(o, subject, record, built.versionNumber, 'view', phone, now);
  return built;
}

async function opened(o: Own & { employee: EmployeeFacts }, subject: AccessSubject, record: MonthRecord, version: number, purpose: OpenPurpose, phone: Phone, now: Date): Promise<void> {
  const confirmed = await isDeviceConfirmed(subject.id, phone.id);
  await recordOpening({ companyId: o.ctx.companyId, actor: o.ctx.auditActor, employee: o.employee, record, version, purpose, ownerOpened: true, deviceLabel: phone.label, placeLabel: phone.placeLabel ?? null, confirmed }, now);
}

export async function versionsOf(subject: AccessSubject, id: string): Promise<VersionInfo[]> {
  const { record } = await ownRecord(subject, id);
  return versionInfos(record);
}

/** The stored A4 file. The same bytes for view, download and share; each fetch is recorded with its purpose (S6). */
export async function documentOf(subject: AccessSubject, id: string, version: number | null, purpose: OpenPurpose, phone: Phone, now: Date = new Date()): Promise<PayslipFile> {
  const { o, record } = await ownRecord(subject, id);
  const v = version ?? record.latest.version;
  const file = await payslipFile(o.employee, record, o.records, v);
  await opened(o, subject, record, v, purpose, phone, now);
  return file;
}

/** History (S4): the years that have payslips, the months of the chosen year, and the P9 card for it. */
export async function history(subject: AccessSubject, year: number | null, now: Date = new Date()) {
  const o = await own(subject);
  const years = [...new Set(o.records.map((r) => Number(r.monthKey.slice(0, 4))))].sort((a, b) => b - a);
  const chosen = year !== null && years.includes(year) ? year : (years[0] ?? null);
  const legacy = await legacyStateOf(subject.id, o.employee?.siteId ?? subject.siteId);
  if (chosen === null || !o.employee) return { years, items: [], p9: null, legacy };
  const items = o.records.filter((r) => r.monthKey.startsWith(`${chosen}-`)).map((r) => ({ ...item(r), net: r.latest.net.toFixed(2) }));
  const p9 = await p9StatusFor(o.ctx.companyId, o.employee, chosen, now);
  return { years, items, p9: { year: chosen, status: p9.status, availableFrom: p9.availableFrom }, legacy };
}
