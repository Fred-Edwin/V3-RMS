import type { TourStep } from '@/lib/tour/types';

/**
 * Guided-tour steps for the HR Payroll page. Anchored to `data-tour` attributes
 * on the real controls so the tour survives styling changes. Steps whose anchor
 * is not currently rendered (e.g. Publish/Revert in the all-branches view, or
 * the missing-bank-details banner when everyone has details) are dropped at
 * runtime by `buildDriverSteps`.
 */
export const PAYROLL_TOUR_PAGE_KEY = 'payroll';

export const payrollTourSteps: TourStep[] = [
  {
    anchor: 'tabs',
    title: 'Welcome to Payroll',
    description:
      'Three tabs: <strong>Payroll Entry</strong> (where you key figures), <strong>Payslip Records</strong> (published history), and <strong>Stale-Order Deductions</strong>. This quick tour walks through the Entry tab.',
    side: 'bottom',
    align: 'start',
  },
  {
    anchor: 'pay-period',
    title: 'Pay period',
    description: 'Pick the month you are paying for. Everything below — figures, exports, publishing — applies to this period.',
    side: 'bottom',
    align: 'start',
  },
  {
    anchor: 'branch',
    title: 'Branch',
    description:
      'Switch branches here. Choosing <strong>“All branches”</strong> gives a consolidated, <strong>read-only</strong> view across every branch — great for exports, but you must pick a single branch to edit or publish.',
    side: 'bottom',
    align: 'start',
  },
  {
    anchor: 'sheet',
    title: 'Enter figures',
    description:
      'Key gross pay, deductions and extras directly in the spreadsheet. You can <strong>copy/paste</strong> from Excel, <strong>drag-fill</strong> a value down a column, and every change <strong>auto-saves</strong> — staff see drafts in real time.',
    side: 'top',
    align: 'center',
  },
  {
    anchor: 'computed',
    title: 'Computed columns',
    description:
      '<strong>Total Deductions</strong> and <strong>Net Salary</strong> are calculated for you from the figures you enter. They are read-only — you never type into them.',
    side: 'bottom',
    align: 'center',
  },
  {
    anchor: 'export-bank',
    title: 'Bank File export',
    description:
      'A <strong>strict CSV</strong> formatted for your bank’s bulk-payment uploader: net pay per employee, grouped by branch. Staff missing bank details are excluded.',
    side: 'bottom',
    align: 'end',
  },
  {
    anchor: 'export-register',
    title: 'Full Register export',
    description:
      'A human-readable record with every column, branch subtotals and a grand total — for your own files and audits, not for the bank.',
    side: 'bottom',
    align: 'end',
  },
  {
    anchor: 'publish',
    title: 'Publish & Revert',
    description:
      '<strong>Publish</strong> locks the period and lets staff see and print their payslips. <strong>Revert to Draft</strong> reopens it for corrections. This is per-branch, so it is hidden in the all-branches view.',
    side: 'bottom',
    align: 'end',
  },
  {
    anchor: 'missing-bank',
    title: 'Bank-details readiness',
    description:
      'If anyone is missing bank details this amber banner warns you — they would be left out of the bank file. Use <strong>“Notify staff”</strong> to send them a formal request to add their details.',
    side: 'bottom',
    align: 'start',
  },
];
