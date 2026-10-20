import type { SnapshotPayslip } from '../approval/month-snapshot';
import { formatCents, parseCents, sumCents } from '../engine/money';

export type ExportKind = 'REGISTER' | 'SUMMARY' | 'STATUTORY' | 'PAYSLIPS';
export type ExportFormat = 'pdf' | 'xlsx' | 'zip';

/** What a file kind may be made as (S9: the format radios apply to the register only; the others are fixed). */
export const FORMATS_OF: Record<ExportKind, readonly ExportFormat[]> = { REGISTER: ['pdf', 'xlsx'], SUMMARY: ['pdf'], STATUTORY: ['xlsx'], PAYSLIPS: ['zip'] };

export interface TableColumn {
  key: string;
  name: string;
  isIncomeTax: boolean;
}

export interface RegisterPerson {
  id: string;
  name: string;
  department: string | null;
  siteName: string;
  basic: string;
  overtime: string;
  gross: string;
  /** Employee share per statutory table, by table key. */
  tables: Record<string, string>;
  other: string;
  net: string;
  version: number;
}

export interface WhoWhen {
  name: string;
  role: string | null;
  at: Date | null;
}

export interface PayrollModel {
  monthKey: string;
  monthLabel: string;
  start: string;
  end: string;
  draft: boolean;
  stamp: 'DRAFT · NOT APPROVED' | 'APPROVED' | 'APPROVED · PUBLISHED' | 'APPROVED · PAID';
  documentNumber: string | null; // PAY-2026-09; null while a draft
  revision: number;
  corrections: number;
  hashPrefix: string | null;
  qrUrl: string | null;
  exportedAt: Date;
  exportedBy: { name: string; role: string };
  approved: WhoWhen | null;
  prepared: string[];
  reviewed: WhoWhen | null;
  calculated: { at: Date | null; run: number };
  published: WhoWhen | null;
  paid: WhoWhen | null;
  timesheets: { site: string; number: string }[];
  tables: TableColumn[];
  tablesNote: { version: number | null; by: string | null; at: Date | null };
  rules: { overtime: string[]; lateness: string[]; absence: string[] };
  totals: { headcount: number; gross: string; taxStatutory: string; other: string; net: string; employerShare: string };
  bySite: { name: string; people: number; gross: string; taxStatutory: string; other: string; net: string }[];
  people: RegisterPerson[];
  payslips: SnapshotPayslip[];
  numbers: Map<string, string>; // employeeId -> PS-nnnn
  correctedAt: Map<string, Date>; // employeeId -> when the latest correction after approval was made
  leftOut: { name: string; siteName: string }[];
  bank: { rows: string[][]; header: readonly string[] } | null; // the Accountant's sheet only
}

/** The key a statutory table's lines carry (the engine writes `OTHER:name` for a table of the OTHER kind). */
export const tableKeyOf = (table: { code: string; name: string }): string => (table.code === 'OTHER' ? `OTHER:${table.name.toLowerCase()}` : table.code);

const cents = (value: string | undefined): bigint => (value === undefined ? 0n : parseCents(value));

/** One row of the register from a frozen payslip: a column per statutory table, in the table order. Money stays text, summed in cents. */
export function registerPerson(p: SnapshotPayslip, tables: readonly TableColumn[]): RegisterPerson {
  const overtime = p.overtimePay ?? formatCents(sumCents(p.lines.filter((l) => l.code.startsWith('OVERTIME')).map((l) => cents(l.amount))));
  const byTable: Record<string, string> = {};
  for (const t of tables) byTable[t.key] = formatCents(sumCents(p.lines.filter((l) => l.tableCode === t.key && l.share === 'EMPLOYEE').map((l) => cents(l.amount))));
  return { id: p.employeeId, name: p.employeeName, department: p.department, siteName: p.siteName, basic: p.basic, overtime, gross: p.gross, tables: byTable, other: p.otherDeductions, net: p.net, version: p.version ?? 1 };
}

/** Departments A to Z, people A to Z inside each: the one order the PDF and the Excel both use. */
export function groupByDepartment<T extends { id: string; name: string; department: string | null }>(people: readonly T[]): { department: string; people: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const person of people) groups.set(person.department ?? 'No department', [...(groups.get(person.department ?? 'No department') ?? []), person]);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([department, list]) => ({ department, people: [...list].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id)) }));
}

export const sumOf = (values: readonly string[]): string => formatCents(sumCents(values.map(parseCents)));

/** `Payroll-register-2026-09.pdf`, `Payroll-2026-09.xlsx`, `Statutory-2026-09.xlsx`, `Payslips-2026-09.zip`, `Payroll-summary-2026-09.pdf`. */
export function fileNameOf(kind: ExportKind, format: ExportFormat, monthKey: string): string {
  if (kind === 'REGISTER') return format === 'pdf' ? `Payroll-register-${monthKey}.pdf` : `Payroll-${monthKey}.xlsx`;
  if (kind === 'SUMMARY') return `Payroll-summary-${monthKey}.pdf`;
  if (kind === 'STATUTORY') return `Statutory-${monthKey}.xlsx`;
  return `Payslips-${monthKey}.zip`;
}

export const CONTENT_TYPES: Record<ExportFormat, string> = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip' };
