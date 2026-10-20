import { createHash } from 'node:crypto';
import { roleLabel } from '../../timesheets/approval/decided-by';
import { longDay, longStamp } from '../../timesheets/exports/export-format';
import { employerLines, maskNumber, monthSection, yearSection, type PayslipData } from '../reads/payslip-model';
import type { EmployeeFacts } from '../reads/reads-repository';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
};

export interface DocRow {
  label: string;
  basis: string;
  month: string;
  ytd: string;
  corrected: string | null;
}

/** Everything the A4 payslip prints. Pure data: the same data is the same file. */
export interface PayslipDoc {
  variant: 'ORIGINAL' | 'REPLACED';
  site: string;
  number: string | null;
  version: number;
  period: string;
  payDay: string | null;
  employee: { name: string; number: string; jobTitle: string; department: string; kraPin: string; nssf: string; sha: string; paidTo: string };
  gross: string;
  totalDeductions: string;
  net: string;
  netYtd: string;
  earnings: DocRow[];
  deductions: DocRow[];
  employer: { label: string; amount: string }[];
  replacesLine: string | null; // 'Version 2 · replaces version 1 of 19 October 2026'
  replacedLine: string | null; // 'Replaced by version 2 on 20 October 2026'
  signer: { name: string; roleLine: string; signedAt: string; versionLine: string } | null;
  created: Date;
  hashPrefix: string;
}

export interface DocInput {
  variant: 'ORIGINAL' | 'REPLACED';
  siteName: string;
  payDay: string | null;
  employee: EmployeeFacts;
  department: string | null;
  data: PayslipData; // the version drawn
  previous: PayslipData | null;
  earlierMonths: PayslipData[]; // the latest version of each earlier month of the year
  replacedBy: { version: number; at: Date } | null;
  previousAt: Date | null; // when the previous version was signed
  signer: { name: string; role: string; at: Date } | null;
  created: Date;
}

const rows = (items: ReturnType<typeof monthSection>['earnings'], ytd: ReturnType<typeof yearSection>['earnings']): DocRow[] =>
  items.map((l) => ({ label: l.label, basis: l.working ?? '', month: l.amount, ytd: ytd.find((y) => y.key === l.key)?.amount ?? l.amount, corrected: l.correctedFrom }));

export function buildPayslipDoc(input: DocInput): PayslipDoc {
  const month = monthSection(input.data, input.previous);
  const year = yearSection([...input.earlierMonths, input.data]);
  const e = input.employee;
  const paidTo = e.payoutMethod === 'BANK' && e.bankName ? `Bank transfer · ${e.bankName}${e.accountNumber ? ` •••• ${e.accountNumber.replace(/\D/g, '').slice(-4)}` : ''}` : e.payoutMethod === 'MPESA' ? 'M-Pesa' : e.payoutMethod === 'CASH' ? 'Cash' : 'Not on file';
  const v = input.data.version;
  const content = createHash('sha256').update(JSON.stringify({ n: input.data.number, v, m: input.data.monthKey, g: input.data.gross, net: input.data.net, l: input.data.lines.map((l) => [l.code, l.amount]) })).digest('hex');
  return {
    variant: input.variant,
    site: input.siteName,
    number: input.data.number,
    version: v,
    period: monthLabel(input.data.monthKey),
    payDay: input.payDay ? longDay(input.payDay) : null,
    employee: { name: e.name, number: e.employeeNumber, jobTitle: e.position ?? '—', department: `${input.department ?? '—'} · ${input.siteName}`, kraPin: maskNumber(e.kraPin), nssf: maskNumber(e.nssfNumber), sha: maskNumber(e.shaNumber), paidTo },
    gross: month.gross,
    totalDeductions: month.totalDeductions,
    net: month.net,
    netYtd: year.net,
    earnings: rows(month.earnings, year.earnings),
    deductions: rows(month.deductions, year.deductions),
    employer: employerLines(input.data).map((l) => ({ label: l.label, amount: l.amount })),
    replacesLine: v > 1 && input.previousAt ? `Version ${v} · replaces version ${v - 1} of ${longDay(toIso(input.previousAt))}` : null,
    replacedLine: input.replacedBy ? `Replaced by version ${input.replacedBy.version} on ${longDay(toIso(input.replacedBy.at))}` : null,
    signer: input.signer ? { name: input.signer.name, roleLine: `${input.signer.name}, ${roleLabel(input.signer.role)}`, signedAt: longStamp(input.signer.at), versionLine: `Version ${v}` } : null,
    created: input.created,
    hashPrefix: content.slice(0, 10),
  };
}

/** The Nairobi calendar date of an instant, as YYYY-MM-DD. */
function toIso(at: Date): string {
  return new Date(at.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
}
