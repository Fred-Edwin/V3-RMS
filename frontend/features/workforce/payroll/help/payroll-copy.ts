/** The words of "How payroll works" (spec S0). Where Paper says "Director: Nothing in payroll" this reads "Nothing to do in payroll". */

export const PAYROLL_STAGES: readonly { name: string; title: string; body: string }[] = [
  { name: 'TIMESHEETS', title: 'Timesheets approved', body: 'Each branch manager approves their site\'s hours. Payroll waits for every site on the new system.' },
  { name: 'CALCULATED', title: 'Calculated', body: 'The system works out every payslip from the approved hours, the pay profiles and the rules.' },
  { name: 'REVIEWED', title: 'Reviewed', body: 'HR looks at the unusual lines, ticks them, then sends the month to the Accountant.' },
  { name: 'APPROVED', title: 'Approved', body: 'The Accountant checks the totals and approves with a PIN. Someone who prepared a month cannot approve it.' },
  { name: 'PUBLISHED', title: 'Published', body: 'HR publishes with a PIN. Staff see their own payslip and are told.' },
  { name: 'PAID', title: 'Paid', body: 'The Accountant downloads the bank file, pays at the bank, and marks the month paid. That locks it.' },
];

export const WHO_DOES_WHAT: readonly { who: string; does: string }[] = [
  { who: 'Branch or Store Manager', does: 'Approves the site\'s timesheets. Sees no pay.' },
  { who: 'HR', does: 'Reviews, adds a line, sends to the Accountant, publishes, corrects a payslip.' },
  { who: 'Accountant', does: 'Confirms the tax tables, approves, downloads the bank file, marks the month paid, corrects a payslip.' },
  { who: 'Director', does: 'Reads everything, sees the estimate of the running month, exports, reminds a site, approves a site\'s timesheets late. Nothing else to do in payroll.' },
  { who: 'System Admin', does: 'Reads. No buttons.' },
  { who: 'Staff', does: 'See their own published payslip on their phone.' },
];
