import type { AppRole } from '@/types/auth';
import type { Payslip } from '@/types/payslip';
import type { StaffDto } from '@/services/staffService';
import { carryForwardValues } from '@/lib/payroll-carry-forward';
import { formatSheetAccount } from '@/lib/payroll-staff-details';

/**
 * Pure data model + helpers for the payroll entry sheet. Extracted from the
 * page so the sheet column config and the page share one source of truth.
 */

export type RowState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface SheetRow {
  userId: string;
  name: string;
  role: string;
  branchName: string;
  grossPay: string;
  paye: string;
  sha: string;
  nssfTier1: string;
  nssfTier2: string;
  housingLevy: string;
  ncnsAmount: string;
  ncnsNote: string;
  advance: string;
  incentives: string;
  overtime: string;
  allowances: string;
  kraPIN: string | null;
  shifNhifNumber: string | null;
  nssfNumber: string | null;
  bankAccount: string | null;
  bankName: string | null;
  accountNumber: string | null;
  payslipId: string | null;
  state: RowState;
  errorMsg: string;
  // True when the money figures were pre-filled by carry-forward from a prior
  // period (an unsaved draft). Cleared once the row is saved or manually edited
  // away. Used to show the "carried over" tag and to know the row still needs review.
  carriedOver: boolean;
}

export const EDITABLE_COLUMNS = [
  'grossPay',
  'paye',
  'sha',
  'nssfTier1',
  'nssfTier2',
  'housingLevy',
  'ncnsAmount',
  'ncnsNote',
  'advance',
  'incentives',
  'overtime',
  'allowances',
] as const;

export type EditableColumnKey = (typeof EDITABLE_COLUMNS)[number];

export const MONEY_COLUMNS = new Set<EditableColumnKey>(
  EDITABLE_COLUMNS.filter((column) => column !== 'ncnsNote'),
);

export const EXCLUDED_ROLES = new Set<AppRole>(['KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'SYSTEM_ADMIN']);

export const normalizeClipboardValue = (columnKey: EditableColumnKey, value: string): string | null => {
  const trimmed = value.trim();
  if (!MONEY_COLUMNS.has(columnKey)) return trimmed;

  const normalized = trimmed.replace(/,/g, '');
  if (normalized === '') return '';
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  return normalized;
};

export const computeRow = (row: SheetRow) => {
  const totalDeductions =
    Number(row.paye || 0) +
    Number(row.sha || 0) +
    Number(row.nssfTier1 || 0) +
    Number(row.nssfTier2 || 0) +
    Number(row.housingLevy || 0) +
    Number(row.ncnsAmount || 0) +
    Number(row.advance || 0);
  const totalEarnings =
    Number(row.grossPay || 0) +
    Number(row.incentives || 0) +
    Number(row.overtime || 0) +
    Number(row.allowances || 0);
  const netSalary = totalEarnings - totalDeductions;
  return { totalDeductions, netSalary };
};

export interface PayrollTotals {
  grossPay: number;
  paye: number;
  sha: number;
  nssfTier1: number;
  nssfTier2: number;
  housingLevy: number;
  ncnsAmount: number;
  advance: number;
  incentives: number;
  overtime: number;
  allowances: number;
  totalDeductions: number;
  netSalary: number;
}

export const computeTotals = (rows: SheetRow[]): PayrollTotals => {
  const sum = (field: keyof SheetRow) =>
    rows.reduce((acc, r) => acc + Number((r[field] as string) || 0), 0);
  return {
    grossPay: sum('grossPay'),
    paye: sum('paye'),
    sha: sum('sha'),
    nssfTier1: sum('nssfTier1'),
    nssfTier2: sum('nssfTier2'),
    housingLevy: sum('housingLevy'),
    ncnsAmount: sum('ncnsAmount'),
    advance: sum('advance'),
    incentives: sum('incentives'),
    overtime: sum('overtime'),
    allowances: sum('allowances'),
    totalDeductions: rows.reduce((acc, r) => acc + computeRow(r).totalDeductions, 0),
    netSalary: rows.reduce((acc, r) => acc + computeRow(r).netSalary, 0),
  };
};

const SHEET_ROLE_ORDER: Record<string, number> = {
  DIRECTOR: 0,
  HR_MANAGER: 1,
  MANAGER: 2,
  ACCOUNTANT: 3,
  CHEF: 4,
  BARISTA: 5,
  WAITER: 6,
};

export const sheetRoleRank = (role: string): number => SHEET_ROLE_ORDER[role] ?? 99;

export const roleLabel = (role: string) =>
  role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const staffToRow = (staff: StaffDto, branchName: string): SheetRow => ({
  userId: staff.id,
  name: staff.name,
  role: roleLabel(staff.role),
  branchName,
  grossPay: '',
  paye: '',
  sha: '',
  nssfTier1: '',
  nssfTier2: '',
  housingLevy: '',
  ncnsAmount: '',
  ncnsNote: '',
  advance: '',
  incentives: '',
  overtime: '',
  allowances: '',
  kraPIN: null,
  shifNhifNumber: null,
  nssfNumber: null,
  bankAccount: null,
  bankName: null,
  accountNumber: null,
  payslipId: null,
  state: 'idle',
  errorMsg: '',
  carriedOver: false,
});

export const payslipToRow = (payslip: Payslip): Partial<SheetRow> => {
  const ep = payslip.user.employeeProfile;
  const otherDed = payslip.otherDeductions?.[0];
  return {
    grossPay: payslip.grossPay,
    paye: payslip.paye,
    sha: payslip.sha,
    nssfTier1: payslip.nssfTier1,
    nssfTier2: payslip.nssfTier2,
    housingLevy: payslip.housingLevy,
    ncnsAmount: otherDed?.amount ?? '',
    ncnsNote: otherDed?.label ?? '',
    advance: payslip.advance ?? '',
    incentives: payslip.incentives ?? '',
    overtime: payslip.overtime ?? '',
    allowances: payslip.allowances ?? '',
    kraPIN: ep?.kraPIN ?? null,
    shifNhifNumber: ep?.shifNhifNumber ?? null,
    nssfNumber: ep?.nssfNumber ?? null,
    bankAccount: formatSheetAccount(ep?.accountNumber, ep?.bankName),
    bankName: ep?.bankName ?? null,
    accountNumber: ep?.accountNumber ?? null,
    payslipId: payslip.id,
    state: 'saved',
  };
};

/**
 * Map a prior-period payslip onto the current sheet row as a *carry-forward
 * draft*. Recurring/variable field rules live in `carryForwardValues`; here we
 * add the sheet-row bookkeeping. The result is an unsaved draft (`state: 'idle'`,
 * `carriedOver: true`) that HR must review and save.
 */
export const carryForwardRow = (prior: Payslip): Partial<SheetRow> => ({
  ...carryForwardValues(prior),
  // This is a fresh draft for the new period, not the prior payslip.
  payslipId: null,
  state: 'idle',
  carriedOver: true,
});

/** Map a sheet row to the bulkUpsert row payload for a given period. */
export const rowToUpsertPayload = (row: SheetRow, payPeriod: string) => {
  const otherDeductions = row.ncnsAmount
    ? [{ label: row.ncnsNote || 'Deduction', amount: Number(row.ncnsAmount).toFixed(2) }]
    : [];
  return {
    userId: row.userId,
    payDate: lastDayOfMonth(payPeriod),
    grossPay: row.grossPay || '0',
    paye: row.paye || '0',
    sha: row.sha || '0',
    nssfTier1: row.nssfTier1 || '0',
    nssfTier2: row.nssfTier2 || '0',
    housingLevy: row.housingLevy || '0',
    helb: null,
    advance: row.advance || null,
    incentives: row.incentives || null,
    overtime: row.overtime || null,
    allowances: row.allowances || null,
    otherDeductions: otherDeductions.length > 0 ? otherDeductions : undefined,
  };
};

/** The current month as a "YYYY-MM" pay-period string. */
export const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const lastDayOfMonth = (payPeriod: string): string => {
  const [y, m] = payPeriod.split('-').map(Number);
  const last = new Date(y, m, 0);
  return last.toISOString().slice(0, 10);
};
