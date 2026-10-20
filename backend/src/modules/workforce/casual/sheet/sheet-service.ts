import { NotFoundError } from '../../../../utils/errors';
import { addDays, fromDateColumn, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { assertCanSee, casualActor, departmentOf, dayRateFor } from '../casual-context';
import type { SheetView, WorkerView } from '../casual.types';
import { maskId, emptySheetView, listTotal, sheetView, cpsNumber } from './sheet-view';
import { sheetRepository, type SheetRow } from './sheet-repository';
import { recordingRepository } from '../recording/recording-repository';
import { isUnitManager } from '../approval/approval-rules';
import { parseCents, formatCents } from '../../payroll/engine/money';

const READERS = ['casual.read', 'casual.record', 'casual.approve'] as const;

/** A stored sheet as the screens read it: names, the cash holder and the money as strings. */
export async function buildView(row: SheetRow): Promise<SheetView> {
  const userIds = [row.recordedById, row.approvedById, row.cashHolderId].filter((id): id is string => id !== null);
  const [users, siteNames, deptNames] = await Promise.all([sheetRepository.names(userIds), sheetRepository.siteNames([row.siteId]), sheetRepository.departmentNames([row.departmentId])]);
  const holder = row.cashHolderId ? { id: row.cashHolderId, name: users.get(row.cashHolderId)?.name ?? '' } : null;
  return sheetView(row, { siteName: siteNames.get(row.siteId) ?? '', departmentName: deptNames.get(row.departmentId) ?? '', users }, holder);
}

/** The day's sheet for a department, or the empty shape the head starts from (with the rate in force, or `noRate`). */
export async function getDay(subject: AccessSubject, q: { siteId: string; departmentId: string; date: NairobiDate }): Promise<SheetView> {
  const ctx = await casualActor(subject, READERS);
  const dept = await departmentOf(ctx.companyId, q.siteId, q.departmentId);
  assertCanSee(subject, { siteId: dept.siteId, departmentId: dept.id });
  const row = await sheetRepository.live(ctx.companyId, dept.siteId, dept.id, q.date);
  if (row) return buildView(row);
  const { rate, version } = await dayRateFor(dept.siteId, dept.id, q.date);
  return emptySheetView({ date: q.date, siteId: dept.siteId, siteName: dept.siteName, departmentId: dept.id, departmentName: dept.name, rate, rateVersion: rate === null ? null : version });
}

export async function getById(subject: AccessSubject, id: string): Promise<SheetView> {
  const ctx = await casualActor(subject, READERS);
  const row = await sheetRepository.byId(ctx.companyId, id);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  assertCanSee(subject, row);
  return buildView(row);
}

/** "My casuals": the department's workers with the last day each worked. */
export async function listWorkers(subject: AccessSubject, q: { siteId: string; departmentId: string; q?: string }): Promise<WorkerView[]> {
  const ctx = await casualActor(subject, READERS);
  const dept = await departmentOf(ctx.companyId, q.siteId, q.departmentId);
  assertCanSee(subject, { siteId: dept.siteId, departmentId: dept.id });
  const rows = await recordingRepository.departmentWorkers(ctx.companyId, dept.siteId, dept.id, q.q ?? null);
  return rows.map(({ worker, lastWorked }) => ({ id: worker.id, fullName: worker.fullName, idMasked: maskId(worker.nationalId), phone: worker.phone, lastWorked }));
}

export interface SheetCard {
  id: string;
  number: string | null;
  date: NairobiDate;
  siteName: string;
  departmentName: string;
  status: string;
  workers: number;
  total: string;
  unsigned: number;
  sentAt: string | null;
}

type ListRow = Awaited<ReturnType<typeof sheetRepository.recent>>[number];
async function cards(rows: readonly ListRow[]): Promise<SheetCard[]> {
  const [sites, depts] = await Promise.all([sheetRepository.siteNames(rows.map((r) => r.siteId)), sheetRepository.departmentNames(rows.map((r) => r.departmentId))]);
  return rows.map((r) => ({
    id: r.id,
    number: r.number !== null ? cpsNumber(r.number) : null,
    date: fromDateColumn(r.workDate),
    siteName: sites.get(r.siteId) ?? '',
    departmentName: depts.get(r.departmentId) ?? '',
    status: r.status,
    workers: r.lines.length,
    total: r.status === 'APPROVED' && r.total ? r.total.toFixed(2) : listTotal(r),
    unsigned: r.status === 'APPROVED' ? r.lines.filter((l) => l.receivedAt === null).length : 0,
    sentAt: r.sentAt?.toISOString() ?? null,
  }));
}

/** The last 7 days of a department's sheets, or of every department at the site for a manager. */
export async function listRecent(subject: AccessSubject, q: { siteId: string; departmentId?: string }, now: Date = new Date()): Promise<SheetCard[]> {
  const ctx = await casualActor(subject, READERS);
  if (q.departmentId) {
    const dept = await departmentOf(ctx.companyId, q.siteId, q.departmentId);
    assertCanSee(subject, { siteId: dept.siteId, departmentId: dept.id });
    return cards(await sheetRepository.recent(ctx.companyId, dept.siteId, [dept.id], addDays(nairobiToday(now), -7)));
  }
  const heads = subject.headOfDepartmentIds ?? [];
  const managerOfSite = subject.siteId === q.siteId && (subject.role === 'MANAGER' || subject.role === 'STORE_MANAGER');
  const everyone = managerOfSite || subject.role === 'DIRECTOR' || subject.role === 'HR_MANAGER' || subject.role === 'ACCOUNTANT';
  return cards(await sheetRepository.recent(ctx.companyId, q.siteId, everyone ? null : heads, addDays(nairobiToday(now), -7)));
}

export interface WaitingForYou {
  toApprove: SheetCard[];
  unsigned: SheetCard[];
}

/** "Needs you" for an approver: sheets sent and waiting, and approved sheets with a worker unsigned for 3 days (PD25). */
export async function waiting(subject: AccessSubject, now: Date = new Date()): Promise<WaitingForYou> {
  const ctx = await casualActor(subject, ['casual.approve']);
  const siteId = subject.role === 'DIRECTOR' ? null : subject.siteId;
  const sent = await sheetRepository.byStatus(ctx.companyId, ['SENT'], siteId);
  const recorders = await sheetRepository.names(sent.map((s) => s.recordedById));
  const byManager = (s: { recordedById: string }) => isUnitManager(recorders.get(s.recordedById)?.role ?? '');
  // The Director decides Head office sheets and any a manager recorded; a manager decides the rest of their site (PD24).
  const mine = sent.filter((s) => (subject.role === 'DIRECTOR' ? s.siteId === subject.siteId || byManager(s) : !byManager(s)));
  const threeDays = new Date(now.getTime() - 3 * 86_400_000);
  const unsigned = await sheetRepository.unsignedApproved(ctx.companyId, siteId, threeDays);
  return { toApprove: await cards(mine), unsigned: await cards(unsigned) };
}

/** The Casual pay tab of Payroll (PD27): approved sheets of the month per site and department, outside gross, net and the bank file. Same shape part 1's tab returns. */
export async function monthSummary(companyId: string, monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number) as [number, number];
  const from = `${monthKey}-01` as NairobiDate;
  const next = (month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`) as NairobiDate;
  const [approved, waitingRows] = await Promise.all([sheetRepository.approvedInRange(companyId, from, next), sheetRepository.waitingInRange(companyId, from, next)]);
  const [sites, depts] = await Promise.all([sheetRepository.siteNames(approved.map((s) => s.siteId)), sheetRepository.departmentNames(approved.map((s) => s.departmentId))]);
  const groups = new Map<string, { siteId: string; siteName: string; departmentId: string; departmentName: string; days: Set<string>; workers: Set<string>; total: bigint }>();
  for (const s of approved) {
    const key = `${s.siteId}|${s.departmentId}`;
    const g = groups.get(key) ?? { siteId: s.siteId, siteName: sites.get(s.siteId) ?? '', departmentId: s.departmentId, departmentName: depts.get(s.departmentId) ?? '', days: new Set<string>(), workers: new Set<string>(), total: 0n };
    g.days.add(fromDateColumn(s.workDate));
    for (const l of s.lines) g.workers.add(l.workerId);
    g.total += parseCents(s.total?.toFixed(2) ?? '0.00');
    groups.set(key, g);
  }
  const all = [...groups.values()];
  return {
    monthKey,
    source: approved.length > 0 || waitingRows.length > 0 ? ('SHEETS' as const) : ('NONE' as const),
    days: new Set(approved.map((s) => `${s.siteId}|${fromDateColumn(s.workDate)}`)).size,
    workers: new Set(approved.flatMap((s) => s.lines.map((l) => l.workerId))).size,
    paidTotal: formatCents(all.reduce((sum, g) => sum + g.total, 0n)),
    inMonthlyRun: false,
    byDepartment: all.map((g) => ({ siteId: g.siteId, siteName: g.siteName, departmentId: g.departmentId, departmentName: g.departmentName, days: g.days.size, workers: g.workers.size, total: formatCents(g.total) })),
    latestSheets: approved.slice(0, 10).map((s) => ({ id: s.id, number: s.number !== null ? cpsNumber(s.number) : null, date: fromDateColumn(s.workDate), siteName: sites.get(s.siteId) ?? '', departmentName: depts.get(s.departmentId) ?? '', total: s.total?.toFixed(2) ?? '0.00', workers: s.lines.length })),
    waiting: waitingRows.map((w) => ({ id: w.id, siteId: w.siteId, departmentId: w.departmentId, date: fromDateColumn(w.workDate), status: w.status })),
    message: approved.length === 0 ? 'No approved casual pay sheets for this month yet.' : null,
  };
}
