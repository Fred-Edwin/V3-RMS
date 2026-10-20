/**
 * The one thing the app shell reads from Payroll: whether the Payroll menu row shows. A separate entry so the shell does not pull in
 * the screens (same pattern as `attendance/shell.ts`).
 */
export { usePayrollOn } from './_shared/hooks/use-payroll-on';
