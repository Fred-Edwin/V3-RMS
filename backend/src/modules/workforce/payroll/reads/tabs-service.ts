import { ConflictError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import type { EffectiveRules } from '../../rules';
import { formatCents, parseCents } from '../engine/money';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { inputsRepository } from '../calculate/inputs-repository';
import { payrollActor, requireMonth } from '../payroll-context';
import { monthTotals, type TotalsRow } from './current-totals';
import { readsRepository } from './reads-repository';
import { ruleCards } from './rules-cards';

/** A tab other than Timesheets exists once the month is calculated (P25); before that it answers 409 with the reason. */
async function calculated(subject: AccessSubject, monthKey: string): Promise<{ month: MonthRow; runId: string; rules: EffectiveRules; companyId: string }> {
  const ctx = await payrollActor(subject, 'payroll.read');
  const month = await requireMonth(ctx.companyId, monthKey);
  if (month.state === 'WAITING' || !month.currentRunId) throw new ConflictError('Available once the month is calculated.', 'TAB_NOT_AVAILABLE', { state: month.state });
  const frozen = Object.values((month.rulesUsed ?? {}) as unknown as Record<string, EffectiveRules>)[0];
  if (!frozen) throw new ConflictError('Available once the month is calculated.', 'TAB_NOT_AVAILABLE', { state: month.state });
  return { month, runId: month.currentRunId, rules: frozen, companyId: ctx.companyId };
}

export async function rulesApplied(subject: AccessSubject, monthKey: string) {
  const { month, runId, rules } = await calculated(subject, monthKey);
  const lines = await readsRepository.linesFor(runId, ['OVERTIME_ORDINARY', 'OVERTIME_REST_DAY', 'OVERTIME_HOLIDAY', 'LATENESS', 'UNPAID_ABSENCE', 'HOLIDAY_PAY']);
  return { monthKey, state: month.state, cards: ruleCards(rules, lines, await readsRepository.sampleWeekHours(runId)) };
}

/** S3: the statutory tables as they were used, one panel per table in the Accountant's order, with a real person's line as the example. */
export async function taxAndDeductions(subject: AccessSubject, monthKey: string) {
  const { month, runId, rules } = await calculated(subject, monthKey);
  const [amounts, confirmed] = await Promise.all([readsRepository.byTable(runId), month.tablesConfirmedBy ? monthsRepository.userNames([month.tablesConfirmedBy]) : Promise.resolve(new Map())]);
  const tables = await Promise.all(
    rules.STATUTORY.values.tables.map(async (t) => {
      const key = t.code === 'OTHER' ? `OTHER:${t.name.toLowerCase()}` : t.code;
      const employee = amounts.find((a) => a.tableCode === key && a.share === 'EMPLOYEE');
      const employer = amounts.find((a) => a.tableCode === key && a.share === 'EMPLOYER');
      const example = await readsRepository.example(runId, key);
      return {
        code: key, name: t.name, kind: t.kind, base: t.base, reducesTaxable: t.reducesTaxable, isIncomeTax: t.isIncomeTax,
        bands: t.bands.map((b) => ({ from: b.fromAmount, to: b.toAmount, ratePercent: b.ratePercent, flatAmount: b.flatAmount })),
        reliefMonthly: t.reliefMonthly, employerRatePercent: t.employerRatePercent,
        employeeShare: { people: employee?.people ?? 0, amount: employee?.amount ?? '0.00' },
        employerShare: employer ? { people: employer.people, amount: employer.amount } : null,
        example: example ? { employeeId: example.payslip.employeeId, name: example.payslip.employeeName, text: example.workingText } : null,
        notUsed: (employee?.people ?? 0) === 0,
      };
    }),
  );
  const totalTakenOff = formatCents(amounts.filter((a) => a.share === 'EMPLOYEE').reduce((sum, a) => sum + parseCents(a.amount), 0n));
  const by = month.tablesConfirmedBy ? (confirmed.get(month.tablesConfirmedBy) as { name: string; role: string } | undefined) : undefined;
  return {
    monthKey,
    tablesVersionLabel: month.tablesVersion === null ? null : `Tax tables version ${month.tablesVersion}`,
    confirmedBy: by ? { name: by.name, role: by.role } : null,
    confirmedAt: month.tablesConfirmedAt?.toISOString() ?? null,
    totalTakenOff,
    employerContributions: formatCents(amounts.filter((a) => a.share === 'EMPLOYER').reduce((sum, a) => sum + parseCents(a.amount), 0n)),
    tables,
  };
}

/** S4: casual pay is a memo and the Casual feature does not exist yet, so the tab says so and shows zeros. */
export async function casualPay(subject: AccessSubject, monthKey: string) {
  const { month } = await calculated(subject, monthKey);
  return { monthKey, state: month.state, source: 'NONE' as const, days: 0, workers: 0, paidTotal: '0.00', inMonthlyRun: false, byDepartment: [], latestSheets: [], message: 'No casual pay sheets in the new system yet. Casual pay for this month is on the old pay sheets.' };
}

/** S5: gross to net by site, from the stored run. */
export async function totals(subject: AccessSubject, monthKey: string) {
  const { month, runId, companyId } = await calculated(subject, monthKey);
  const run = await monthsRepository.run(runId);
  const stored = await monthTotals(month);
  const names = await inputsRepository.siteNames(companyId, Object.keys(stored?.bySite ?? {}));
  const row = (r: Partial<TotalsRow>) => ({ people: r.people ?? 0, basic: r.basic ?? '0.00', gross: r.gross ?? '0.00', taxStatutory: r.taxStatutory ?? '0.00', other: r.other ?? '0.00', net: r.net ?? '0.00', employerShare: r.employerShare ?? '0.00' });
  const sites = Object.entries(stored?.bySite ?? {}).map(([siteId, r]) => ({ siteId, name: names.get(siteId) ?? '', ...row(r) })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const total = row(stored?.total ?? {});
  return { monthKey, state: month.state, runNumber: run?.runNumber ?? 0, bySite: sites, total, employerContributions: parseCents(total.employerShare) > 0n ? total.employerShare : null, casual: '0.00', totalCost: formatCents(parseCents(total.gross) + parseCents(total.employerShare)) };
}
