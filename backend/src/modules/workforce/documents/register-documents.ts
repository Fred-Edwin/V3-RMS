import { issuedConductNotices } from '../conduct/documents/notice-index';
import { registerDocumentSource } from '../_shared/documents/document-sources';
import { issuedLeaveSlips } from '../leave';
import { issuedP9, issuedPayslips } from '../payslips';
import { issuedCasualSheets, issuedPayrollMonths, issuedTimesheets } from './sources/issued-sources';

/**
 * Start-up (routes/index.ts): tells the documents index where the issuers' documents come from, so every already-issued number is
 * indexed by the backfill and any later one by the catch-up. Leave (LVE) and Conduct (WRN) also call `registerDocument` from their own
 * signing transactions; their sources here index the numbers issued before that wiring existed. Safe to call twice.
 */
export function registerDocuments(): void {
  registerDocumentSource('PAY', issuedPayrollMonths);
  registerDocumentSource('PS', issuedPayslips);
  registerDocumentSource('CPS', issuedCasualSheets);
  registerDocumentSource('P9', issuedP9);
  registerDocumentSource('TSH', issuedTimesheets);
  registerDocumentSource('LVE', issuedLeaveSlips);
  registerDocumentSource('WRN', issuedConductNotices);
}
