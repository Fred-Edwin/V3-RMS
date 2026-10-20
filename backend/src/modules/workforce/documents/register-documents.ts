import { registerDocumentSource } from '../_shared/documents/document-sources';
import { issuedP9, issuedPayslips } from '../payslips';
import { issuedCasualSheets, issuedPayrollMonths, issuedTimesheets } from './sources/issued-sources';

/**
 * Start-up (routes/index.ts): tells the documents index where the built issuers' documents come from, so every already-issued number
 * is indexed by the backfill and any later one by the catch-up. Leave and Conduct register no source; they call `registerDocument`.
 */
export function registerDocuments(): void {
  registerDocumentSource('PAY', issuedPayrollMonths);
  registerDocumentSource('PS', issuedPayslips);
  registerDocumentSource('CPS', issuedCasualSheets);
  registerDocumentSource('P9', issuedP9);
  registerDocumentSource('TSH', issuedTimesheets);
}
