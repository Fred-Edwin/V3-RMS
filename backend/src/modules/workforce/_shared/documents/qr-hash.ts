import { createHash } from 'node:crypto';

/** The first 10 hex characters of a hash: the value every renderer puts in the QR (`?h=`) and the verify page compares. */
export const HASH_PREFIX_LENGTH = 10;
export const hashPrefixOf = (hash: string): string => hash.slice(0, HASH_PREFIX_LENGTH);

export interface PayslipHashInput {
  number: string | null;
  version: number;
  monthKey: string;
  /** Two-decimal strings, as the payslip stores them. */
  gross: string;
  net: string;
  lines: readonly { code: string; amount: string }[];
}

/**
 * The one hash of a payslip version. Both payslip renderers (the person's own file in `payslips/documents` and the month's export in
 * `payroll/exports`) call this, and the Signed documents index stores it, so a QR printed by either one verifies against the same
 * value (6c X4). A version has its own hash: a copy of version 1 matches version 1 and reads "replaced". Never printed or returned
 * whole by a public route, and it holds the figures only as input to a one-way hash.
 */
export const payslipContentHash = (p: PayslipHashInput): string =>
  createHash('sha256').update(JSON.stringify({ n: p.number, v: p.version, m: p.monthKey, g: p.gross, net: p.net, l: p.lines.map((l) => [l.code, l.amount]) })).digest('hex');
