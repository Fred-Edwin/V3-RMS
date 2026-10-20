/**
 * Workforce Payslips (Segment 3, front end): the public API. Route shells import the screens from here; nothing deeper is imported from
 * outside this folder. See README.md.
 */
export { PayslipGate } from './unlock/components/payslip-gate';
export { PayslipsHome } from './home/components/home-screen';
export { PayslipDetailScreen } from './detail/components/detail-screen';
export { HistoryScreen } from './history/components/history-screen';
export { PayslipDocumentScreen } from './document/components/document-screen';
export { PAYSLIP_HOME, payslipHref } from './_shared/lib/routes';
