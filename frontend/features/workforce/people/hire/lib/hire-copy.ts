import type { HireStepKey } from './hire-model';

/**
 * Every word of the hire flow (Paper Chapter 2), in one place. Paper writes "she" and "her"; nobody's pronouns are on file, so the
 * lines use the person's first name or "they". `first` is the first name once one is typed, "the new hire" before.
 */
export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] || 'the new hire';

/** For a sentence that starts with the name, which may be "the new hire" before one is typed. */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const STEP_LABELS: Record<HireStepKey, string> = {
  who: 'Who',
  job: 'Job',
  pay: 'Pay',
  statutory: 'Statutory and bank',
  login: 'Login',
};

export interface StepHeading {
  title: string;
  lead: string;
}

export function stepHeading(step: HireStepKey, first: string, casual: boolean): StepHeading {
  switch (step) {
    case 'who':
      return { title: 'Who is joining?', lead: `The basics. ${cap(first)} can add a photo and more details on their first sign-in.` };
    case 'job':
      return { title: `What will ${first} do?`, lead: `Where ${first} works and how they are employed. After this step they can be put on the rota.` };
    case 'pay':
      return casual
        ? { title: `How is ${first} paid?`, lead: 'A casual is paid each day in cash from petty cash. There is no login, no bank and no statutory step.' }
        : { title: `How is ${first} paid?`, lead: 'Only HR, the Director and the Accountant ever see this. Payroll reads it. Nobody types hours or deductions into a payslip.' };
    case 'statutory':
      return { title: 'Statutory and bank details', lead: `Fill what you have now. ${cap(first)} completes the rest on their phone, and you verify it.` };
    case 'login':
      return { title: `${first}'s login`, lead: 'What the system lets them do. This is the account, separate from the job title.' };
  }
}

export const STEP_NOTES = {
  personalEmailPurpose: 'Used only to send the first sign-in link and to reset a password.',
  // Placeholder wording: the lawyer who reviews the contract wording confirms this notice (Data Protection Act 2019).
  personalEmailPrivacy: 'We keep this address only for sign-in help. It is not shown to colleagues and is not used for anything else. The person can ask HR to remove it.',
  draftSaved: 'Saved as a draft as you go',
  casualSteps: 'Casual · 3 steps instead of 5',
  noDuplicate: 'We checked: no one with this ID number or phone is already on file.',
  duplicateId: 'Someone with this ID number is already on file. Open their file from Employees instead of adding a second one.',
  duplicatePhone: 'Someone with this phone number is already on file.',
  duplicateEmail: 'Someone with this email address already has a login.',
  confirmPhone: 'This is a different person who shares the number',
} as const;

export const photoNote = 'Optional now. It replaces the initials everywhere.';

export const JOB_PANEL = (first: string, department: string | null, head: string | null): string[] => [
  department
    ? `Department. ${cap(first)} joins the ${department} team.${head ? ` ${head}, its head, can build their rota and approve their overtime.` : ' Its head can build their rota and approve their overtime.'}`
    : 'Department. Choose one and its head can build the rota and approve overtime.',
  `No contract yet. A nudge on the file, not a blocker. ${cap(first)} gets the default leave policy so they have balances from day one.`,
  'Tracks time. Defaults from the position. Managers and HR do not clock in.',
  `Casual. Choosing it skips the login step and puts ${first} in the department's casual pool.`,
];

export const JOB_PANEL_NOTE = 'A Branch Manager can fill this step for their own site. Pay, statutory and bank stay with HR.';
export const NOT_HR_NOTE = 'Pay, statutory and bank details stay with HR. HR is told this file needs finishing.';

export const PAY_PANEL = {
  heading: (first: string) => `${first}'s hourly equivalent`,
  lateness: 'Lateness and overtime use this. The working is shown on every payslip.',
  rules: 'The overtime multiplier and the legal limits on deductions are rules set by the Director and confirmed by the Accountant. They are not typed here.',
  hidden: 'Branch Managers and heads never see this step. A head sees only their own pay, on their own payslip.',
  latenessDefault: 'Company default · set by the Director in Rules',
} as const;

export const CASUAL_PANEL = (first: string, head: string | null, manager: string): string[] => [
  `1 · ${cap(first)} turns up. ${head ?? 'The department head'} ticks them in and adjusts their arrival and leave times on a phone.`,
  `2 · ${manager}, the Branch Manager, approves the day.`,
  `3 · A daily pay voucher is printed. ${cap(first)} signs it, and the person paying signs with their PIN.`,
  '4 · Lateness reduces that day\'s payout, and is shown on the voucher.',
];
export const CASUAL_NOTE = 'Who holds the petty cash and pays each day is still to be confirmed with the client.';

export const STATUTORY_PANEL = {
  caption: 'WHO DOES WHAT',
  rows: (first: string): { label: string; value: string; tone?: 'success' | 'warning' }[] => [
    { label: 'KRA PIN', value: 'Entered by HR', tone: 'success' },
    { label: 'NSSF, SHA', value: `${first}, then HR verifies`, tone: 'warning' },
    { label: 'Bank account', value: 'Entered by HR', tone: 'success' },
  ],
  audit: 'Changing a bank account later asks for a reason and tells the Accountant. Every view of these details is logged on the audit trail.',
  held: 'Payroll is held until NSSF, SHA and a payout method are complete. It shows as "Blocks payroll" on HR Home.',
} as const;

export const LOGIN_PANEL = {
  casualCaption: 'A CASUAL SKIPS THIS STEP',
  casual: 'Casuals have no login. The department head records their day, the Branch Manager approves it, and a daily pay voucher is printed. Nothing here is asked for them.',
  whenCaption: 'WHEN YOU HIRE',
  lines: (first: string, head: string | null, department: string | null): string[] => [
    'The account is created, and they get a first-sign-in link',
    `${head ?? 'Their head'}${head ? ', their head,' : ''} is told ${first} has joined${department ? ` the ${department} team` : ''}`,
    'They appear on the rota, ready to be scheduled',
    'The hire is written to the audit log with who did it',
  ],
  shownOnce: 'Shown once. They must change it, and set their PIN, the first time they sign in.',
} as const;
