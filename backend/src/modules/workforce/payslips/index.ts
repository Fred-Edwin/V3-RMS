/**
 * The public door of the staff payslips (Workforce Segment 3). The rest of Workforce imports from here and from nowhere deeper.
 *
 * Seams with Payroll part 2 (lane 1), all small and with a working default on part 1's data:
 *  - `setPublicationSource`: which months are published or paid, and their pay day and paid date.
 *  - `ensureFileForPayslip`: part 2 may call it at publish and at each correction so the A4 file is made at that moment.
 *  - `setDeviceConfirmationSource`: the "Is this your phone?" feature registers its answer here.
 */
export { default as workforcePayslipsRouter } from './payslips-routes';
export { setPublicationSource, type MonthPublication, type MonthFacts, type PublicationSource } from './reads/publication';
export { P9_LAYOUT_VERSION } from './p9/p9-layout'; // Needs you shows "Confirm the P9 format" until the Accountant has
export { setDeviceConfirmationSource, type DeviceConfirmationSource } from './unlock/device-source';
export { ensureFileForPayslip, type PayslipFile } from './documents/document-service';
export { issuedPayslips, issuedP9 } from './documents/issued-documents'; // Segment 6b: what is already issued, for the Signed documents backfill
