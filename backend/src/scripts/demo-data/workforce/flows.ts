/** The month-by-month business flows, driven through the real API so every rule of the app applies. */
import { prisma } from '../../../config/database';
import { instantAt, parseClockTime, sweepPayroll, toDateColumn, type NairobiDate } from '../../../modules/workforce';
import { call, key, login, must, PIN, type Body } from './api';
import { out, type World } from './base';
import { runPeopleFlows } from './flows-people';

const TODAY = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10); // today in Nairobi: the app refuses rules that start in the past
const STATUTORY = {
  tables: [
    { code: 'NSSF', name: 'Alpha', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null, kind: 'RATE', base: 'GROSS', reducesTaxable: true, isIncomeTax: false, employerRatePercent: '6', reliefMonthly: null, floorAmount: null, ceilingAmount: null },
    { code: 'PAYE', name: 'Gamma', bands: [{ fromAmount: '0', toAmount: '24000', ratePercent: '10', flatAmount: null }, { fromAmount: '24000', toAmount: '32333', ratePercent: '25', flatAmount: null }, { fromAmount: '32333', toAmount: null, ratePercent: '30', flatAmount: null }], note: null, kind: 'BANDS', base: 'TAXABLE', reducesTaxable: false, isIncomeTax: true, employerRatePercent: null, reliefMonthly: '2000', floorAmount: null, ceilingAmount: null },
  ],
};
const OVERTIME = { serviceTailMinutes: 15, weeklyCapMinutes: null, branchBudgetMinutesPerPeriod: null, approvalWindowHours: 48, multipliers: { ordinaryDay: '1.5', restDay: '2' } };
const LEAVE_EXTRAS = { accrual: 'UP_FRONT', perMonthDays: null, carryOverDays: 0, sickNoteAfterDays: null, approvedBy: 'MANAGER' };
const LEAVE = {
  leaveTypes: [
    { code: 'ANNUAL', label: 'Annual leave', daysPerYear: 21, paid: true, requiresReason: false, ...LEAVE_EXTRAS },
    { code: 'SICK', label: 'Sick leave', daysPerYear: 14, paid: true, requiresReason: false, ...LEAVE_EXTRAS },
    { code: 'EMERGENCY', label: 'Emergency leave', daysPerYear: 3, paid: true, requiresReason: true, ...LEAVE_EXTRAS },
    { code: 'UNPAID', label: 'Unpaid leave', daysPerYear: null, paid: false, requiresReason: true, ...LEAVE_EXTRAS },
  ],
  defaultPolicy: { ANNUAL: 21, SICK: 14, EMERGENCY: 3 },
  minimumCover: {},
  unpaidDayDivisor: 30,
  hrContact: { phone: '+254 700 000 000', hoursText: 'Monday to Friday, 8 am to 5 pm' },
};

/** Saves a rule version as one person, and confirms it as another where the app asks for that. */
async function setRule(who: string, group: string, values: object, effectiveFrom: string, reason: string, confirmScope?: { by: string; scope: string }): Promise<void> {
  // The app refuses a rule that starts in the past, so it is saved as of today and moved back here (lane database only).
  const made = await must(`${group} rule`, who, 'POST', `/workforce/rules/${group}/versions`, { effectiveFrom: TODAY, values, reason, pin: PIN, idempotencyKey: key(group) });
  await prisma.ruleVersion.update({ where: { id: made['version']?.id }, data: { effectiveFrom: toDateColumn(effectiveFrom as NairobiDate) } });
  if (confirmScope) await must(`confirm ${group}`, confirmScope.by, 'POST', `/workforce/rules/versions/${made['version']?.id}/confirm`, { scope: confirmScope.scope, pin: PIN });
  out(`ok  rules: ${group} from ${effectiveFrom}`);
}

/** Decides every overtime item up to the end of the month as the branch manager (one declined, with a reason), then approves the month's timesheets. */
async function approveTimesheets(world: World, month: string, last: NairobiDate): Promise<void> {
  const sites: [string, string][] = [['bm.town', world.siteIds.TOWN], ['bm.highway', world.siteIds.HIGHWAY]];
  const first = `${month}-01` as NairobiDate;
  const cutoff = (month === '2026-08' ? '2026-09-01' : '2026-10-01') as NairobiDate;
  const label = month === '2026-08' ? 'August 2026' : 'September 2026';
  for (const [bm, siteId] of sites) {
    // The app opens only the current month by itself; a past month's sheet is opened here, as the timesheet demo did.
    if (!(await prisma.timesheetPeriod.findFirst({ where: { siteId, startDate: toDateColumn(first) }, select: { id: true } }))) {
      await prisma.timesheetPeriod.create({ data: { siteId, startDate: toDateColumn(first), endDate: toDateColumn(last), label, cutoffAt: instantAt(cutoff, parseClockTime('00:00')) } });
    }
    await must(`open ${month}`, bm, 'GET', `/workforce/timesheets/months/${month}?site=${siteId}`); // reading assembles the days and makes the overtime items
    const items = await prisma.overtimeItem.findMany({ where: { siteId, status: 'PENDING', shiftDate: { lte: toDateColumn(last) } }, orderBy: { shiftDate: 'asc' }, select: { id: true } });
    for (const [i, item] of items.entries()) {
      const card = await call(bm, 'GET', `/workforce/timesheets/overtime/${item.id}`);
      const version = card.data?.['version'];
      const decision = i === 1 ? { decision: 'DECLINE', reason: 'Not needed at that hour', pin: PIN, version } : { decision: 'APPROVE_ALL', pin: PIN, version };
      await must(`overtime ${bm}`, bm, 'POST', `/workforce/timesheets/overtime/${item.id}/decision`, decision);
    }
    const sheet = await must(`read ${month}`, bm, 'GET', `/workforce/timesheets/months/${month}?site=${siteId}`);
    const expectedTotals = { workedMinutes: sheet['kpis'].workedMinutes, overtimeAuthorisedMinutes: sheet['kpis'].overtime.approvedMinutes, headcount: sheet['kpis'].headcount };
    await must(`approve ${month}`, bm, 'POST', `/workforce/timesheets/months/${month}/approve`, { pin: PIN, idempotencyKey: key('approve'), expectedTotals, site: siteId });
    out(`ok  timesheets: ${month} approved for ${bm} (${items.length} overtime days decided)`);
  }
}

/** HR ticks every line, sends it on; the Accountant approves; HR publishes; the Accountant downloads the bank file and marks it paid. */
async function payTheMonth(month: string): Promise<void> {
  const M = `/workforce/payroll/months/${month}`;
  const open = await must('review', 'hr', 'GET', `${M}/review?rows=100&state=OPEN`);
  if (open['counts']?.blocking > 0) throw new Error(`${month} has ${open['counts'].blocking} blocking lines: fix the seed people before paying`);
  for (const kind of new Set<string>((open['lines'] as Body[]).map((l) => l['kind']))) await call('hr', 'POST', `${M}/review/check-kind`, { kind, stateVersion: open['stateVersion'] });
  for (const l of ((await must('review again', 'hr', 'GET', `${M}/review?rows=100&state=OPEN`))['lines'] as Body[])) await call('hr', 'POST', `${M}/review/${l['id']}/check`, { checked: true, stateVersion: open['stateVersion'] });
  const ready = await must('review ready', 'hr', 'GET', `${M}/review?rows=100`);
  if (ready['counts'].checked !== ready['counts'].total) throw new Error(`${month}: ${ready['counts'].total - ready['counts'].checked} lines are still unchecked`);
  const sent = await must('send to the Accountant', 'hr', 'POST', `${M}/send-to-accountant`, { idempotencyKey: key('send'), stateVersion: ready['stateVersion'] });
  const t = (await must('totals', 'accountant', 'GET', `${M}/totals`))['total'];
  const approved = await must('approve', 'accountant', 'POST', `${M}/approve`, { pin: PIN, idempotencyKey: key('approve'), stateVersion: sent['stateVersion'], handChecked: true, expectedTotals: { gross: t.gross, net: t.net, taxStatutory: t.taxStatutory, other: t.other, headcount: t.people } });
  const published = await must('publish', 'hr', 'POST', `${M}/publish`, { pin: PIN, idempotencyKey: key('publish'), stateVersion: approved['stateVersion'] });
  const file = await call('accountant', 'POST', `${M}/bank-file`, { idempotencyKey: key('bank') });
  if (file.status >= 300) throw new Error(`bank file failed: ${file.status} ${file.error}`);
  const view = await must('month', 'accountant', 'GET', M);
  await must('mark paid', 'accountant', 'POST', `${M}/mark-paid`, { pin: PIN, idempotencyKey: key('pay'), stateVersion: view['stateVersion'], bankFileHash: file.headers.get('x-bank-file-hash') });
  out(`ok  payroll: ${month} approved, published (${published['published']} payslips), bank file downloaded, marked Paid`);
}

export async function runFlows(world: World): Promise<void> {
  for (const who of ['hr', 'accountant', 'director', 'admin', 'bm.town', 'bm.highway']) await login(who);

  await setRule('hr', 'LEAVE', LEAVE, '2026-01-01', 'Demo: 21 days of annual leave a year');
  await setRule('accountant', 'STATUTORY', STATUTORY, '2026-08-01', 'Demo tax tables', { by: 'accountant', scope: 'statutory' });
  await setRule('director', 'OVERTIME', OVERTIME, '2026-08-01', 'Demo overtime rates', { by: 'accountant', scope: 'overtime.multipliers' });

  await approveTimesheets(world, '2026-08', '2026-08-31' as NairobiDate);
  out(`ok  payroll: the system calculated ${(await sweepPayroll()).calculated} month(s)`);
  await payTheMonth('2026-08');

  await approveTimesheets(world, '2026-09', '2026-09-30' as NairobiDate);
  out(`ok  payroll: the system calculated ${(await sweepPayroll()).calculated} month(s)`);
  const sept = await must('September', 'hr', 'GET', '/workforce/payroll/months/2026-09');
  out(`ok  payroll: September is ${sept['state']} (${sept['kpis']?.headcount} people, ${sept['kpis']?.openLines} lines to tick)`);

  await runPeopleFlows(world);
}
