/**
 * Pure helpers for the HR Payroll sheet's carry-forward feature.
 *
 * Carry-forward pre-fills a fresh pay period from the most recent prior period
 * so HR only edits what changed each month. The rules encoded here:
 *
 *  - RECURRING items (base salary + statutory deductions + fixed allowances)
 *    carry forward unchanged. See CARRIED_FIELDS.
 *  - VARIABLE, month-specific items (overtime, advance, incentives, and the
 *    N.C.N.S / stale-deduction line) are deliberately reset to blank so they
 *    are never silently repeated month to month.
 *
 * These live in `lib/` (rather than inline in the page component) so the
 * month-arithmetic and field-mapping logic is unit-testable in the repo's
 * node-only Vitest env — matching the pattern in `payroll-staff-details.ts`.
 */

/**
 * Recurring money fields that carry forward from the prior period unchanged.
 * Keep this in sync with the editable columns on the payroll sheet.
 */
export const CARRIED_FIELDS = [
  'grossPay',
  'paye',
  'sha',
  'nssfTier1',
  'nssfTier2',
  'housingLevy',
  'allowances',
] as const;

export type CarriedField = (typeof CARRIED_FIELDS)[number];

/**
 * True for a money cell that carries no real figure: empty/whitespace, or a
 * numeric value of zero (e.g. "0", "0.00", "-0"). A payslip left at all-zero
 * after a publish → revert cycle must still be treated as blank — otherwise
 * the copy-from-previous-month feature sees "0.00" as an already-filled cell
 * and refuses to overwrite it, or worse, "successfully" copies zeros forward.
 */
export function isBlankMoney(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (trimmed === '') return true;
  const n = Number(trimmed);
  return !Number.isNaN(n) && n === 0;
}

/**
 * The subset of a prior payslip needed to carry figures forward. Kept minimal
 * (and structurally compatible with the fuller `Payslip` type) so this module
 * has no dependency on API/response shapes.
 */
export interface CarryForwardSource {
  grossPay: string;
  paye: string;
  sha: string;
  nssfTier1: string;
  nssfTier2: string;
  housingLevy: string;
  allowances?: string | null;
}

/**
 * True when every recurring carried field on a payslip-like source is blank
 * (per `isBlankMoney`) — i.e. it holds no real, usable figures. Used to skip
 * a period whose only saved data is a zeroed-out publish/revert artifact when
 * searching backward for a prior period to carry forward from.
 */
export function isAllZeroSource(source: CarryForwardSource): boolean {
  return CARRIED_FIELDS.every((field) => isBlankMoney(source[field]));
}

/** The blank-able variable fields plus the recurring carried figures. */
export interface CarryForwardValues {
  grossPay: string;
  paye: string;
  sha: string;
  nssfTier1: string;
  nssfTier2: string;
  housingLevy: string;
  allowances: string;
  // Variable, month-specific items — always blank on a carried-over row.
  ncnsAmount: '';
  ncnsNote: '';
  advance: '';
  incentives: '';
  overtime: '';
}

/**
 * The pay-period string ("YYYY-MM") for `count` months before `payPeriod`.
 * `count` defaults to 1 (the immediately preceding month).
 */
export function priorPeriod(payPeriod: string, count = 1): string {
  const [y, m] = payPeriod.split('-').map(Number);
  const d = new Date(y, m - 1 - count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Map a prior-period payslip onto the carry-forward draft values: recurring
 * items copied, variable items blanked. The caller merges these onto a sheet
 * row and marks it `carriedOver: true` / unsaved.
 */
export function carryForwardValues(prior: CarryForwardSource): CarryForwardValues {
  return {
    grossPay: prior.grossPay,
    paye: prior.paye,
    sha: prior.sha,
    nssfTier1: prior.nssfTier1,
    nssfTier2: prior.nssfTier2,
    housingLevy: prior.housingLevy,
    allowances: prior.allowances ?? '',
    ncnsAmount: '',
    ncnsNote: '',
    advance: '',
    incentives: '',
    overtime: '',
  };
}
