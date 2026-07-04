/**
 * Pure helpers for the HR Payroll sheet's editable STAFF DETAILS columns
 * (KRA PIN, Bank Name, Account Number).
 *
 * These fields are employee-profile attributes, not payslip figures, so they
 * persist to `PATCH /hr/profiles/:userId` — a separate path from the payslip
 * money auto-save. Keeping the trim/assemble logic here (rather than inline in
 * the page component) makes it unit-testable in the repo's node-only Vitest env.
 */

export interface StaffDetailSource {
  kraPIN: string | null;
  bankName: string | null;
  accountNumber: string | null;
}

export interface StaffDetailPatch {
  kraPIN: string | null;
  bankName: string | null;
  accountNumber: string | null;
}

/**
 * Normalise a cell value for persistence: trim surrounding whitespace, and
 * treat an empty/whitespace-only string as "unset" (null) so the profile field
 * is cleared rather than saved as "".
 */
export function cleanStaffValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Build the PATCH payload for a row's staff details. All three fields are sent
 * together on every save so that a quick edit of one field can never drop an
 * unsaved edit of another on the same row.
 */
export function buildStaffDetailPatch(row: StaffDetailSource): StaffDetailPatch {
  return {
    kraPIN: cleanStaffValue(row.kraPIN),
    bankName: cleanStaffValue(row.bankName),
    accountNumber: cleanStaffValue(row.accountNumber),
  };
}

/**
 * The combined "BankName AccountNumber" display string shown wherever a single
 * bank-account column is rendered (e.g. exports). Null when there is no account
 * number, since bank name alone is not a payable account.
 */
export function formatSheetAccount(
  accountNumber: string | null | undefined,
  bankName: string | null | undefined,
): string | null {
  if (!accountNumber) return null;
  return bankName ? `${bankName} ${accountNumber}` : accountNumber;
}
