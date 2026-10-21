/**
 * Workforce audit (Shared parts, front end B): the Audit log and its entry drawer, Activity on my record, and the Director's
 * payslip-openings digest. Route shells import the screens from here; the Home card registry imports the digest card and its hook.
 * Nothing deeper is imported from outside this folder. See README.md.
 */
export { AuditLogPage } from './log/components/audit-log-page';
export { MyRecordScreen } from './my-record/components/my-record-screen';
export { PayslipOpensCard } from './digest/components/payslip-opens-card';
export { usePayslipOpens } from './digest/hooks/use-payslip-opens';
