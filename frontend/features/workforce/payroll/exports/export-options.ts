import type { ExportFormat, ExportKind } from '../_shared/types/action-types';
import type { MonthState } from '../_shared/types/month-types';

/** What the Export menu offers for a month (spec S9): each kind, its formats, and why it is off when it is. */

export interface ExportOption {
  kind: ExportKind;
  title: string;
  description: string;
  badge: string;
  formats: ExportFormat[];
  /** The reason this one is off for this month; null when it is on. */
  offReason: string | null;
}

const CALCULATED: readonly MonthState[] = ['IN_REVIEW', 'TO_APPROVE', 'TO_PUBLISH', 'PUBLISHED', 'PAID'];
const PUBLISHED: readonly MonthState[] = ['PUBLISHED', 'PAID'];

export function exportOptions(state: MonthState): ExportOption[] {
  const nothing = CALCULATED.includes(state) ? null : 'Nothing is calculated yet.';
  return [
    { kind: 'REGISTER', title: 'Payroll register', badge: 'PDF · EXCEL', description: 'One row per person: gross, each deduction, net. By department, names A to Z.', formats: ['pdf', 'xlsx'], offReason: nothing },
    { kind: 'SUMMARY', title: 'Payroll summary', badge: 'PDF · 1 PAGE', description: 'Totals by site, tax, casual pay, and who prepared, approved and published it.', formats: ['pdf'], offReason: nothing },
    { kind: 'STATUTORY', title: 'Statutory schedules', badge: 'EXCEL', description: 'Each tax and statutory table by person, for filing.', formats: ['xlsx'], offReason: nothing },
    { kind: 'PAYSLIPS', title: 'All payslips', badge: 'PDF · ONE EACH', description: 'Every payslip as its own PDF, downloaded together.', formats: ['zip'], offReason: PUBLISHED.includes(state) ? null : 'Available once the payslips are published.' },
  ];
}

/** The first option that is on, so the menu opens with a sensible choice. */
export const firstOn = (options: readonly ExportOption[]): ExportOption | null => options.find((o) => o.offReason === null) ?? null;

/** The line above the button: what the file will say about the month. */
export function stampLine(state: MonthState, documentNumber: string | null, approvedAt: string | null): { tone: 'warning' | 'success'; text: string } {
  if (state === 'IN_REVIEW' || state === 'TO_APPROVE') return { tone: 'warning', text: 'This month is not approved yet. The file will say "Draft, not approved".' };
  return { tone: 'success', text: `${approvedAt ? `Approved ${approvedAt}. ` : ''}The file carries the signatures${documentNumber ? ` and ${documentNumber}` : ''}.` };
}

export const FORMAT_WORDS: Record<ExportFormat, string> = { pdf: 'PDF, landscape', xlsx: 'Excel', zip: 'ZIP of PDFs' };
export const buttonLabel = (option: ExportOption, format: ExportFormat): string => `Download ${option.title.toLowerCase()} (${format === 'xlsx' ? 'Excel' : format === 'zip' ? 'ZIP' : 'PDF'})`;
