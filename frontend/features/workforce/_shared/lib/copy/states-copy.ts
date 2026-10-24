/**
 * The per-screen copy table from Paper "Workforce · States kit" (node 1Q84-0),
 * every row, so a screen asks for its words by key and never writes its own.
 *
 * Three lines per screen:
 * - `nothingYet`: the screen has no data at all (invites the first action).
 * - `nothingFound`: a search or filter matched nothing (names it, offers to clear it).
 * - `error`: it could not load (says whether anything was lost).
 *
 * A few lines carry a hole for something the screen knows: `{term}` is the
 * search or filter text, `{range}` a date range. `fillCopy` fills them.
 * "Rules" has no empty state: every tab has a value from the first day.
 */
export const SCREEN_KEYS = [
  'waitingForYou',
  'rota',
  'todayBoard',
  'timesheets',
  'myTime',
  'leave',
  'conduct',
  'pay',
  'people',
  'audit',
  'rules',
  'myPayslips',
  'securityAlerts',
  'phones',
] as const;

export type WorkforceScreenKey = (typeof SCREEN_KEYS)[number];

export interface ScreenStatesCopy {
  /** The screen's name as the Paper table writes it. */
  screen: string;
  nothingYet: string;
  nothingFound: string;
  error: string;
  /** True for a screen that never shows an empty state (Rules). */
  notApplicable?: boolean;
}

export const STATES_COPY: Record<WorkforceScreenKey, ScreenStatesCopy> = {
  waitingForYou: {
    screen: 'Needs you',
    nothingYet: 'Nothing needs you. New requests show here, in the bell and as badges on the menu.',
    nothingFound: 'No request matches "{term}". Clear the filter.',
    error: 'We could not load your list. Your answers are safe.',
  },
  rota: {
    screen: 'Shifts',
    nothingYet: 'No shifts for {range} yet. Pick a shift for a day, or use Start from last week.',
    nothingFound: 'No shift matches "{term}". Clear the filter.',
    error: 'We could not load the shifts. Nothing was changed.',
  },
  todayBoard: {
    screen: 'Today board',
    nothingYet: 'Nobody has a shift today. Add one from Shifts.',
    nothingFound: 'Nobody late right now. Everyone on shift is in.',
    error: 'We could not refresh the board. The times shown may be old.',
  },
  timesheets: {
    screen: 'Timesheets',
    nothingYet: 'No timesheet month is open yet. One opens when the first shifts are set.',
    nothingFound: 'No person matches "{term}". Clear the search.',
    error: 'We could not load the period. Nothing was changed.',
  },
  myTime: {
    screen: 'My time and My requests',
    nothingYet: 'No time recorded yet. Your first clock-in appears here.',
    nothingFound: 'Nothing in that month.',
    error: 'We could not load your time. Your clock-ins are safe.',
  },
  leave: {
    screen: 'Leave requests and balances',
    nothingYet: 'No leave requests. Ask for leave from My leave.',
    nothingFound: 'No request matches. Clear the filter.',
    error: 'We could not load leave. Nothing was changed.',
  },
  conduct: {
    screen: 'Conduct',
    nothingYet: 'No notices on file. A notice appears here when one is issued.',
    nothingFound: 'No notice matches. Clear the filter.',
    error: 'We could not load notices. Nothing was changed.',
  },
  pay: {
    screen: 'Pay runs and payslips',
    nothingYet: "No payroll yet. The first one appears once a month's timesheets are approved. A payslip appears when its payroll is published.",
    nothingFound: 'No run matches that year.',
    error: 'We could not load pay. Nothing was published or changed.',
  },
  people: {
    screen: 'Employees and Organisation',
    nothingYet: 'No employees yet. Hire the first person from Employees.',
    nothingFound: 'No employee matches "{term}". Clear the search.',
    error: 'We could not load people. Nothing was changed.',
  },
  audit: {
    screen: 'Audit log and Signed documents',
    nothingYet: 'No entries in this month.',
    nothingFound: 'No entry matches. Widen the dates or clear the filter.',
    error: 'We could not load the log. Opening it was still recorded.',
  },
  rules: {
    screen: 'Rules',
    nothingYet: 'Not applicable: every tab has a value from the first day.',
    nothingFound: 'Not applicable',
    error: 'We could not load the rules. Payroll is not affected.',
    notApplicable: true,
  },
  // Rows added in production (6b M3; words in 6a S1 and S2). My payslips, Security alerts and Phones are Shared parts A; Signed documents and
  // Activity on my record arrive with Shared parts B.
  myPayslips: {
    screen: 'My payslips',
    nothingYet: 'No payslip yet. Your first one appears here when your pay is published.',
    nothingFound: 'No payslip in that year.',
    error: 'We could not load your payslips. Nothing was changed.',
  },
  securityAlerts: {
    screen: 'Security alerts',
    nothingYet: 'No security alerts. A new one shows here and as a badge on the menu.',
    nothingFound: 'No alert matches. Clear the filter.',
    error: 'We could not load the alerts. Nothing was changed.',
  },
  phones: {
    screen: 'Phones',
    nothingYet: 'No other phones. This is the only phone that has signed in.',
    nothingFound: 'No phone matches.',
    error: 'We could not load your phones. Nothing was changed.',
  },
};

export type StatesCopyKind = 'nothingYet' | 'nothingFound' | 'error';

/** Fill `{term}` and `{range}`. A hole with no value is left visible so a missing value is noticed, not hidden. */
export function fillCopy(text: string, values: { term?: string; range?: string } = {}): string {
  return text
    .replace(/\{term\}/g, values.term ?? '{term}')
    .replace(/\{range\}/g, values.range ?? '{range}');
}

export function statesCopy(
  screen: WorkforceScreenKey,
  kind: StatesCopyKind,
  values?: { term?: string; range?: string }
): string {
  return fillCopy(STATES_COPY[screen][kind], values);
}

/** Fixed lines from the States kit that are not per screen. */
export const STATES_FIXED = {
  stillLoading: 'Still loading. Your work is safe.',
  tryAgain: 'Try again',
  referencePrefix: 'Reference',
  offlineStrip: 'No signal.',
  savedOnPhone: 'SAVED ON THIS PHONE',
} as const;

/** "WF-1A2B": the reference support uses to find the log entry. Pass the server's code; this only formats it. */
export function formatReference(code: string): string {
  const clean = code.replace(/^WF-/i, '').trim().toUpperCase();
  return `WF-${clean}`;
}
