import { env } from '../../../../config/env';
import { ConflictError } from '../../../../utils/errors';
import type { ActorCtx } from '../../people/people-context';
import { workforceCan } from '../../_shared/workforce-access';
import type { EffectiveRules } from '../../rules';
import { approvalRepository } from '../approval/approval-repository';
import { toSnapshotPayslip, type MonthSnapshot, type SnapshotPayslip } from '../approval/month-snapshot';
import { buildBankFile } from '../bank/bank-build';
import { inputsRepository } from '../calculate/inputs-repository';
import { monthWindow } from '../months/month-calendar';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { readsRepository } from '../reads/reads-repository';
import { monthLabelOf } from '../../timesheets/months/rules/month-state';
import { sumOf, registerPerson, tableKeyOf, type PayrollModel, type TableColumn } from './export-model';

/** A month this big is refused (413) rather than slowing the server; the background job is the next step (decision 2B-X3). */
export const MAX_EXPORT_PEOPLE = 400;

export class ExportTooLarge extends Error {
  constructor(people: number) {
    super(`This month has ${people} people; exports are limited to ${MAX_EXPORT_PEOPLE}.`);
  }
}

const STAMPS = { TO_PUBLISH: 'APPROVED', PUBLISHED: 'APPROVED · PUBLISHED', PAID: 'APPROVED · PAID' } as const;

function rulesWords(rules: EffectiveRules | undefined): PayrollModel['rules'] {
  if (!rules) return { overtime: [], lateness: [], absence: [] };
  const m = rules.OVERTIME.values.multipliers;
  const l = rules.LATENESS.values;
  const policy = l.policy === 'RECORD_ONLY' ? 'Recorded only, nothing deducted' : l.policy === 'FROM_FIRST_MINUTE' ? 'Deducted from the first late minute' : `Deducted after ${l.afterLatesPerMonth ?? 0} late days`;
  return {
    overtime: [`Ordinary day ${m.ordinaryDay ?? 'not set'} ×, rest day ${m.restDay ?? 'not set'} ×`, `Public holiday ${rules.HOLIDAYS.values.payMultiplier ?? 'not set'} ×`, `Version ${rules.OVERTIME.companyVersion}`],
    lateness: [policy, l.deductionCapPercentOfPay === null ? 'No cap' : `Capped at ${l.deductionCapPercentOfPay}% of basic`, `Version ${rules.LATENESS.companyVersion}`],
    absence: [`Unpaid day = basic ÷ ${rules.LEAVE.values.unpaidDayDivisor}`, 'Approved leave never reduces pay'],
  };
}

/**
 * Assembles what a payroll document needs. An approved month is read from its frozen snapshot (the latest revision), so a file never
 * changes after approval and never carries a figure from outside it; a draft is read from the current run. A month with nothing
 * calculated has nothing to export (409). The bank sheet is built only for the Accountant and only from Published.
 */
export async function buildPayrollModel(ctx: ActorCtx, month: MonthRow, now: Date): Promise<PayrollModel> {
  if (!month.currentRunId) throw new ConflictError('Nothing is calculated yet.', 'NOTHING_CALCULATED', { state: month.state });
  const approved = month.state === 'TO_PUBLISH' || month.state === 'PUBLISHED' || month.state === 'PAID';
  const row = approved ? await approvalRepository.latestSnapshot(month.id) : null;
  if (approved && !row) throw new ConflictError('The approved figures are missing. Tell the developer.', 'SNAPSHOT_MISSING');
  const snapshot = row ? (row.data as unknown as MonthSnapshot) : null;

  let payslips: SnapshotPayslip[];
  let siteNames = new Map<string, string>();
  if (snapshot) payslips = snapshot.payslips;
  else {
    const live = await approvalRepository.payslipsWithLines(month.currentRunId);
    const ids = await approvalRepository.statutoryIds(live.map((p) => p.employeeId));
    payslips = live.map((p) => toSnapshotPayslip(p, ids.get(p.employeeId) ?? null));
    siteNames = await inputsRepository.siteNames(month.companyId, month.includedSiteIds);
  }
  if (payslips.length > MAX_EXPORT_PEOPLE) throw new ExportTooLarge(payslips.length);

  const frozen = (snapshot?.rulesUsed ?? month.rulesUsed ?? {}) as Record<string, EffectiveRules>;
  const rules = Object.values(frozen)[0];
  const tables: TableColumn[] = (rules?.STATUTORY.values.tables ?? []).map((t) => ({ key: tableKeyOf(t), name: t.name, isIncomeTax: t.isIncomeTax }));
  const people = payslips.map((p) => registerPerson(p, tables));
  const sites = [...new Set(payslips.map((p) => p.siteName))].sort((a, b) => a.localeCompare(b, 'en'));
  const bySite = sites.map((name) => {
    const own = payslips.filter((p) => p.siteName === name);
    return { name, people: own.length, gross: sumOf(own.map((p) => p.gross)), taxStatutory: sumOf(own.map((p) => p.statutoryEmployee)), other: sumOf(own.map((p) => p.otherDeductions)), net: sumOf(own.map((p) => p.net)) };
  });
  const totals = { headcount: payslips.length, gross: sumOf(payslips.map((p) => p.gross)), taxStatutory: sumOf(payslips.map((p) => p.statutoryEmployee)), other: sumOf(payslips.map((p) => p.otherDeductions)), net: sumOf(payslips.map((p) => p.net)), employerShare: sumOf(payslips.map((p) => p.employerShare)) };

  const nameIds = [month.approvedById, month.sentById, month.publishedById, month.paidById, month.tablesConfirmedBy, ...(snapshot?.preparedBy.map((p) => p.id) ?? [])].filter((id): id is string => id !== null);
  const names = await monthsRepository.userNames(nameIds);
  const who = (id: string | null, at: Date | null) => (id ? { name: names.get(id)?.name ?? '', role: names.get(id)?.role ?? null, at } : null);
  const documentNumber = approved ? (snapshot?.documentNumber ?? month.documentNumber) : null;
  const hashPrefix = row?.hash.slice(0, 10) ?? null;
  const numbers = new Map([...(await readsRepository.numbers(month.id, payslips.map((p) => p.employeeId)))].map(([id, n]) => [id, `PS-${String(n).padStart(4, '0')}`]));
  const window = monthWindow(month.monthKey);
  const bankReader = workforceCan(ctx.subject, 'payroll.pay') && (month.state === 'PUBLISHED' || month.state === 'PAID');
  const built = bankReader ? await buildBankFile(month) : null;
  const sheetSites = snapshot ? snapshot.sites.map((s) => ({ site: s.name, number: s.timesheetNumber })) : (await monthsRepository.sites(month.id)).map((s) => ({ site: siteNames.get(s.siteId) ?? '', number: `TSH-${String(s.timesheetNumber).padStart(4, '0')}` }));

  return {
    monthKey: month.monthKey,
    monthLabel: monthLabelOf(month.monthKey),
    start: window.first,
    end: window.last,
    draft: !approved,
    stamp: approved ? STAMPS[month.state as keyof typeof STAMPS] : 'DRAFT · NOT APPROVED',
    documentNumber,
    revision: snapshot?.revision ?? 1,
    corrections: snapshot?.corrections?.length ?? 0,
    hashPrefix,
    qrUrl: approved && documentNumber && hashPrefix ? `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/pay/${documentNumber}?h=${hashPrefix}` : null,
    exportedAt: now,
    exportedBy: { name: ctx.name, role: ctx.subject.role },
    approved: snapshot ? { name: snapshot.approvedBy?.name ?? '', role: names.get(snapshot.approvedBy?.id ?? '')?.role ?? 'ACCOUNTANT', at: new Date(snapshot.approvedAt) } : null,
    prepared: snapshot?.preparedBy.map((p) => p.name) ?? [],
    reviewed: who(month.sentById, month.sentAt),
    calculated: { at: month.calculatedAt, run: snapshot?.runNumber ?? month.runCount },
    published: who(month.publishedById, month.publishedAt),
    paid: who(month.paidById, month.paidAt),
    timesheets: sheetSites,
    tables,
    tablesNote: { version: month.tablesVersion, by: month.tablesConfirmedBy ? (names.get(month.tablesConfirmedBy)?.name ?? null) : null, at: month.tablesConfirmedAt },
    rules: rulesWords(rules),
    totals,
    bySite,
    people,
    payslips,
    numbers,
    correctedAt: new Map((snapshot?.corrections ?? []).map((c) => [c.employeeId, new Date(c.at)])),
    leftOut: snapshot?.leftOut?.map((l) => ({ name: l.name, siteName: l.siteName })) ?? (await readsRepository.leftOutLines(month.currentRunId)).map((l) => ({ name: l.employeeName, siteName: l.siteName })),
    bank: built ? { header: ['Reference', 'Account name', 'Bank name', 'Branch', 'Account number', 'Amount', 'Currency', 'Narration', 'Employee number'], rows: built.plan.rows.map((r) => [r.reference, r.accountName, r.bankName, r.branch, r.accountNumber, r.amount, r.currency, r.narration, r.employeeNumber]) } : null,
  };
}
