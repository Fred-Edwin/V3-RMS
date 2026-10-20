import { createHash } from 'node:crypto';
import { ConflictError } from '../../../../utils/errors';
import { monthLabelOf } from '../../timesheets/months/rules/month-state';
import type { MonthRow } from '../months/months-repository';
import { readsRepository } from '../reads/reads-repository';
import { ACTIVE_BANK_FORMAT, BANK_FORMATS } from './bank-format';
import { planBankFile, type BankPlan } from './bank-rows';
import { bankRepository } from './bank-repository';

export interface BuiltBankFile {
  plan: BankPlan;
  text: string;
  hash: string;
  formatId: string;
}

/** "Wendo salary Sep 2026": the narration the bank prints against each payment. */
export const narrationOf = (monthKey: string): string => {
  const [month, year] = monthLabelOf(monthKey).split(' ');
  return `Wendo salary ${(month ?? '').slice(0, 3)} ${year ?? ''}`.trim();
};

/**
 * Builds the file from the current version of every payslip and the bank details as they are now. Nothing is stored: the same
 * payslips always give the same text, so the hash tells whether a file in someone's hand still matches the month (a correction or a
 * changed account makes the hash move, which is how a stale file is caught).
 */
export async function buildBankFile(month: Pick<MonthRow, 'id' | 'monthKey' | 'currentRunId'>): Promise<BuiltBankFile> {
  if (!month.currentRunId) throw new ConflictError('This month has not been calculated.', 'NOT_CALCULATED');
  const format = BANK_FORMATS[ACTIVE_BANK_FORMAT];
  if (!format) throw new ConflictError('The bank file format is not set up.', 'BANK_FORMAT_MISSING');
  const slips = await bankRepository.payslips(month.currentRunId);
  const [details, numbers] = await Promise.all([bankRepository.details(slips.map((s) => s.employeeId)), readsRepository.numbers(month.id, slips.map((s) => s.employeeId))]);
  const plan = planBankFile(
    slips.map((s) => ({
      employeeId: s.employeeId,
      employeeNumber: s.employeeNumber,
      employeeName: s.employeeName,
      net: s.net.toFixed(2),
      payoutMethod: s.payoutMethod,
      number: numbers.has(s.employeeId) ? `PS-${String(numbers.get(s.employeeId)).padStart(4, '0')}` : null,
      bank: details.get(s.employeeId) ?? null,
    })),
    narrationOf(month.monthKey),
  );
  const text = format.render(plan.rows);
  return { plan, text, hash: createHash('sha256').update(text).digest('hex'), formatId: format.id };
}
