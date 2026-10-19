import { NotFoundError } from '../../../../utils/errors';
import { nairobiToday, monthKey as monthKeyOfDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { inputsRepository } from '../calculate/inputs-repository';
import { estimateRepository } from '../estimate/estimate-repository';
import { parseCents, formatCents } from '../engine/money';
import { monthLabelOf } from '../../timesheets/months/rules/month-state';
import { payrollActor } from '../payroll-context';
import { reviewRepository } from '../review/review-repository';
import { approvalCount } from '../sites/site-status';
import { loadSiteRows } from '../sites/site-rows';
import { isMonthKey, monthHasEnded, monthWindow } from './month-calendar';
import { buildStages, capabilitiesFor, stageCell, tabsEnabled, type MonthStage } from './month-stages';
import { monthsRepository, type MonthRow } from './months-repository';
import { waitingBanner } from './waiting-banner';

interface RunTotalsJson {
  total?: { people: number; gross: string; taxStatutory: string; other: string; net: string; employerShare: string };
}

const runTotals = async (month: MonthRow): Promise<RunTotalsJson['total'] | null> => {
  if (!month.currentRunId) return null;
  return ((await monthsRepository.run(month.currentRunId))?.totals as RunTotalsJson | null)?.total ?? null;
};

/** The months list, newest first: the running month (an estimate, no row) and every month that has a row. */
export async function listMonths(subject: AccessSubject, query: { page: number; rows: number }, now: Date = new Date()) {
  const ctx = await payrollActor(subject, 'payroll.read');
  const today = nairobiToday(now);
  const openKey = monthKeyOfDate(today);
  const [stored, switched] = await Promise.all([monthsRepository.allKeys(ctx.companyId), inputsRepository.switchedSites(ctx.companyId)]);
  const keys = new Set(stored.map((m) => m.monthKey));
  if (switched.length > 0 && !keys.has(openKey) && !monthHasEnded(monthWindow(openKey), today)) keys.add(openKey);
  const all = [...keys].sort().reverse();
  const slice = all.slice((query.page - 1) * query.rows, query.page * query.rows);
  const items = await Promise.all(slice.map(async (key) => {
    const month = await monthsRepository.find(ctx.companyId, key);
    if (!month) {
      const estimate = await estimateRepository.read(ctx.companyId, key);
      const earned = (estimate?.data as { earnedSoFar?: string } | undefined)?.earnedSoFar ?? null;
      return { monthKey: key, label: monthLabelOf(key), state: 'OPEN' as MonthStage, stateVersion: 0, netPay: null, estimate: earned === null ? null : { earnedSoFar: earned }, sitesApproved: { approved: 0, total: switched.length }, documentNumber: null, tabs: tabsEnabled('OPEN') };
    }
    const totals = await runTotals(month);
    const sites = month.state === 'WAITING' ? approvalCount(await loadSiteRows(ctx.companyId, monthWindow(key), today, now)) : { approved: month.includedSiteIds.length, total: month.includedSiteIds.length };
    return { monthKey: key, label: monthLabelOf(key), state: month.state as MonthStage, stateVersion: month.stateVersion, netPay: totals?.net ?? null, estimate: null, sitesApproved: { approved: sites.approved, total: sites.total }, documentNumber: month.documentNumber, tabs: tabsEnabled(month.state) };
  }));
  return { items, page: query.page, rows: query.rows, total: all.length };
}

/** One month: the stage line, the strip, what the viewer may do, the sites, and what it is waiting for. */
export async function getMonth(subject: AccessSubject, monthKey: string, now: Date = new Date()) {
  const ctx = await payrollActor(subject, 'payroll.read');
  if (!isMonthKey(monthKey)) throw new NotFoundError('There is no payroll for that month', 'NO_PAYROLL_MONTH');
  const window = monthWindow(monthKey);
  const today = nairobiToday(now);
  const month = await monthsRepository.find(ctx.companyId, monthKey);
  if (!month) {
    if (monthHasEnded(window, today) || monthKey !== monthKeyOfDate(today)) throw new NotFoundError('There is no payroll for that month', 'NO_PAYROLL_MONTH');
    return { monthKey, label: monthLabelOf(monthKey), state: 'OPEN' as MonthStage, stateVersion: 0, stages: [], stageCell: stageCell('OPEN', { sitesApproved: { approved: 0, total: 0 }, openLines: 0, waitingFor: null }), kpis: null, capabilities: capabilitiesFor(subject, 'OPEN'), tabs: tabsEnabled('OPEN'), sites: [], banner: null, documentNumber: null, rulesUsed: [], tablesConfirmed: null };
  }
  const rows = month.state === 'WAITING' ? await loadSiteRows(ctx.companyId, window, today, now) : null;
  const counts = month.currentRunId ? await reviewRepository.counts(month.currentRunId) : { total: 0, checked: 0, blocking: 0 };
  const open = counts.total - counts.checked;
  const approved = rows ? approvalCount(rows) : { approved: month.includedSiteIds.length, total: month.includedSiteIds.length, people: 0, peopleApproved: 0 };
  const banner = rows ? await waitingBanner(rows, window, monthLabelOf(monthKey)) : null;
  const totals = await runTotals(month);
  const userIds = [month.sentById, month.approvedById, month.tablesConfirmedBy].filter((id): id is string => id !== null);
  const names = await monthsRepository.userNames(userIds);
  const nameOf = (id: string | null): string | null => (id ? (names.get(id)?.name ?? null) : null);
  const storedSites = rows ? [] : await monthsRepository.sites(month.id);
  const siteNames = rows ? new Map<string, string>() : await inputsRepository.siteNames(ctx.companyId, month.includedSiteIds);
  const totalCost = totals ? formatCents(parseCents(totals.gross) + parseCents(totals.employerShare)) : null;
  return {
    monthKey,
    label: monthLabelOf(monthKey),
    state: month.state as MonthStage,
    stateVersion: month.stateVersion,
    stages: buildStages(month.state, { sitesApproved: approved, calculatedAt: month.calculatedAt, sentAt: month.sentAt, reviewedBy: nameOf(month.sentById), approvedAt: month.approvedAt, approvedBy: nameOf(month.approvedById), openLines: open }),
    stageCell: stageCell(month.state, { sitesApproved: approved, openLines: open, waitingFor: banner?.waitingFor ?? null }),
    kpis: { headcount: totals?.people ?? approved.people, gross: totals?.gross ?? null, net: totals?.net ?? null, totalCost, casual: '0.00', employerShare: totals?.employerShare ?? null, sitesApproved: { approved: approved.approved, total: approved.total }, openLines: open, blockingLines: counts.blocking },
    capabilities: capabilitiesFor(subject, month.state),
    tabs: tabsEnabled(month.state),
    sites: rows ?? storedSites.map((s) => ({ siteId: s.siteId, name: siteNames.get(s.siteId) ?? '', headcount: s.headcount, timesheetState: 'APPROVED' as const, approvedAt: s.timesheetApprovedAt.toISOString(), documentNumber: `TSH-${String(s.timesheetNumber).padStart(4, '0')}` })),
    banner,
    documentNumber: month.documentNumber,
    firstMonthForSites: month.firstMonthSiteIds,
    rulesUsed: Object.entries((month.rulesUsed ?? {}) as Record<string, { STATUTORY?: { companyVersion: number; effectiveFrom: string | null } }>).slice(0, 1).flatMap(([, rules]) => (rules.STATUTORY ? [{ key: 'STATUTORY', version: rules.STATUTORY.companyVersion, effectiveFrom: rules.STATUTORY.effectiveFrom }] : [])),
    tablesConfirmed: month.tablesVersion === null ? null : { version: month.tablesVersion, by: nameOf(month.tablesConfirmedBy), at: month.tablesConfirmedAt?.toISOString() ?? null },
  };
}
