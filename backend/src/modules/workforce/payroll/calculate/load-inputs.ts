import { createHash } from 'node:crypto';
import { fromDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { EffectiveRules } from '../../rules';
import { payAmountOn } from '../../people/people-door';
import { getApprovedHours } from '../../timesheets/approved-hours';
import type { AdjustmentInput, PersonInput } from '../engine/engine.types';
import type { PersonFacts } from '../engine/review-flags';
import { amountSegments, employedRanges, previousMonthKey, rangeDays, type MonthWindow } from '../months/month-calendar';
import { countedLateDays, holidayWorkedMinutes, splitOvertime, type ApprovedDay } from './day-facts';
import { inputsRepository } from './inputs-repository';
import { holidaysInMonth } from './rules-to-engine';

export interface LoadedPerson {
  input: PersonInput;
  facts: PersonFacts;
  siteName: string;
  department: string | null;
  employeeNumber: string;
  payoutMethod: 'BANK' | 'MPESA' | 'CASH' | null;
  bankFingerprint: string | null;
}

export interface LoadArgs {
  companyId: string;
  window: MonthWindow;
  siteIds: readonly string[];
  siteNames: ReadonlyMap<string, string>;
  rulesBySite: ReadonlyMap<string, EffectiveRules>;
  adjustments: readonly (AdjustmentInput & { employeeId: string })[];
  leftOutIds: ReadonlySet<string>;
}

interface SnapshotPerson {
  employeeId: string;
  absentDays: number;
  leaveDays: number;
}

const CHUNK = 20;
const group = <T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
};
const fingerprintOf = (bank: string | null, account: string | null): string | null => (bank && account ? createHash('sha256').update(`${bank}|${account}`).digest('hex').slice(0, 16) : null);

/** Everything the engine and the review need about every person of the included sites, read in a few queries plus the two doors. */
export async function loadPeople(args: LoadArgs): Promise<LoadedPerson[]> {
  const { companyId, window } = args;
  const employees = await inputsRepository.employees(companyId, args.siteIds, window);
  const ids = employees.map((e) => e.id);
  const userIds = employees.map((e) => e.userId).filter((id): id is string => id !== null);
  const periods = await inputsRepository.periods(args.siteIds, window);
  const periodIds = periods.map((p) => p.id);
  const [days, overtime, previous, earlier, leftOutEarlier, legacy] = await Promise.all([
    inputsRepository.approvedDays(periodIds),
    inputsRepository.authorisedOvertime(periodIds),
    inputsRepository.previousMonth(companyId, previousMonthKey(window.monthKey)),
    inputsRepository.hadPayslipBefore(companyId, window.monthKey, ids),
    inputsRepository.leftOutEarlier(companyId, window.monthKey, ids),
    inputsRepository.legacyPayslipUsers(userIds, window.monthKey, args.siteIds),
  ]);
  const daysBy = group(days, (d) => d.employeeId);
  const overtimeBy = group(overtime, (o) => o.employeeId);
  const adjustmentsBy = group(args.adjustments, (a) => a.employeeId);
  const previousBy = new Map(previous.map((p) => [p.employeeId, p]));
  const periodBySite = new Map(periods.map((p) => [p.siteId, p]));
  const snapshotBy = new Map<string, SnapshotPerson>();
  for (const period of periods) for (const p of ((period.approvedSnapshot as { people?: SnapshotPerson[] } | null)?.people ?? [])) snapshotBy.set(p.employeeId, p);
  const accountCount = new Map<string, number>();
  for (const e of employees) if (e.payProfile?.accountNumber) accountCount.set(e.payProfile.accountNumber, (accountCount.get(e.payProfile.accountNumber) ?? 0) + 1);

  const build = async (e: (typeof employees)[number]): Promise<LoadedPerson> => {
    const rules = args.rulesBySite.get(e.siteId);
    const holidays = rules ? holidaysInMonth(rules, window) : new Set<string>();
    const spells = e.spells.map((s) => ({ startsOn: fromDateColumn(s.startsOn) as NairobiDate, endedOn: s.endedOn ? (fromDateColumn(s.endedOn) as NairobiDate) : null }));
    const ranges = employedRanges(window, spells);
    const { segments, lastAmount } = await amountSegments(ranges, (date) => payAmountOn(e.id, date));
    const myDays: ApprovedDay[] = daysBy.get(e.id) ?? [];
    const myOvertime = overtimeBy.get(e.id) ?? [];
    // The door answers by login. A person without a login (the door cannot find them) is read from the same approved rows the door sums.
    const hours = e.userId
      ? await getApprovedHours(e.userId, { start: window.first, end: window.last })
      : { workedMinutes: myDays.reduce((t, d) => t + d.workedMinutes, 0), overtimeApprovedMinutes: myOvertime.reduce((t, o) => t + o.authorisedMinutes, 0) };
    const snapshot = snapshotBy.get(e.id);
    const profile = e.payProfile;
    const split = splitOvertime(myOvertime, myDays, holidays, hours.overtimeApprovedMinutes);
    const lateDays = countedLateDays(myDays);
    const bank = fingerprintOf(profile?.bankName ?? null, profile?.accountNumber ?? null);
    const prior = previousBy.get(e.id);
    const priorBank = (prior?.input as { bankFingerprint?: string | null } | undefined)?.bankFingerprint ?? null;
    const input: PersonInput = {
      employeeId: e.id,
      name: e.name,
      siteId: e.siteId,
      payType: e.payType,
      daysInMonth: window.days,
      basisSegments: segments,
      amountInForce: lastAmount,
      overtimeEligible: profile?.overtimeEligible ?? false,
      standardWeekHours: profile?.standardWeekHours?.toString() ?? null,
      standardDayHours: profile?.standardDayHours?.toString() ?? null,
      workedMinutes: hours.workedMinutes,
      overtimeAuthorisedMinutes: split,
      holidayWorkedMinutes: holidayWorkedMinutes(myDays, myOvertime, holidays),
      lateDays,
      absentDays: snapshot?.absentDays ?? 0,
      leaveDays: snapshot?.leaveDays ?? 0,
      adjustments: adjustmentsBy.get(e.id) ?? [],
      timesheetDocument: periodBySite.get(e.siteId)?.documentNumber ? `TSH-${String(periodBySite.get(e.siteId)?.documentNumber).padStart(4, '0')}` : null,
    };
    const missing = [e.kraPin ? null : 'KRA PIN', e.nssfNumber ? null : 'NSSF number', e.shaNumber ? null : 'SHA number'].filter((m): m is string => m !== null);
    const firstSpell = [...spells].sort((a, b) => (a.startsOn < b.startsOn ? -1 : 1))[0];
    const last = [...spells].sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0];
    const facts: PersonFacts = {
      leftOut: args.leftOutIds.has(e.id),
      hasPayProfile: lastAmount !== null,
      payoutMethod: profile?.payoutMethod ?? null,
      hasBankAccount: Boolean(profile?.bankName && profile?.accountNumber),
      joinedThisMonth: Boolean(firstSpell && firstSpell.startsOn > window.first && firstSpell.startsOn <= window.last),
      firstPayrollMonth: !earlier.has(e.id),
      leftThisMonth: Boolean(last?.endedOn && last.endedOn >= window.first && last.endedOn < window.last),
      employedDays: rangeDays(ranges),
      daysInMonth: window.days,
      lastMonthNet: prior ? prior.net.toFixed(2) : null,
      missingIds: missing,
      timesheetDays: myDays.filter((d) => d.workedMinutes > 0).length,
      lateDayCount: lateDays.length,
      lateMinutes: lateDays.reduce((t, v) => t + v, 0),
      absentDays: input.absentDays,
      bankChangedSinceLastMonth: priorBank !== null && bank !== priorBank,
      duplicateAccount: Boolean(profile?.accountNumber && (accountCount.get(profile.accountNumber) ?? 0) > 1),
      movedBetweenSystems: e.userId !== null && legacy.has(e.userId),
      leftOutEarlier: leftOutEarlier.has(e.id),
      adjustmentCount: input.adjustments.length,
    };
    return { input, facts, siteName: args.siteNames.get(e.siteId) ?? '', department: e.department?.name ?? null, employeeNumber: e.employeeNumber, payoutMethod: profile?.payoutMethod ?? null, bankFingerprint: bank };
  };

  const out: LoadedPerson[] = [];
  for (let i = 0; i < employees.length; i += CHUNK) out.push(...(await Promise.all(employees.slice(i, i + CHUNK).map(build))));
  return out;
}
