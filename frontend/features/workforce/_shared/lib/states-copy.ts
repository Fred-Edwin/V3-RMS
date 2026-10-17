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
    screen: 'Waiting for you',
    nothingYet: 'Nothing is waiting for you. New requests show here and in the bell.',
    nothingFound: 'No request matches "{term}". Clear the filter.',
    error: 'We could not load your list. Your answers are safe.',
  },
  rota: {
    screen: 'Rota',
    nothingYet: 'No rota for {range} yet. Start from last week or from a template.',
    nothingFound: 'No shift matches "{term}". Clear the filter.',
    error: 'We could not load the rota. Nothing was changed.',
  },
  todayBoard: {
    screen: 'Today board',
    nothingYet: 'Nobody is rostered today. Add a shift from the rota.',
    nothingFound: 'Nobody late right now. Everyone on the rota is in.',
    error: 'We could not refresh the board. The times shown may be old.',
  },
  timesheets: {
    screen: 'Timesheets',
    nothingYet: 'No timesheet period is open yet. One opens when the first rota is published.',
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
    nothingYet: 'No pay run yet. The first one can be prepared after the period closes. A payslip appears when its run is published.',
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
    nothingYet: 'No entries in this period.',
    nothingFound: 'No entry matches. Widen the dates or clear the filter.',
    error: 'We could not load the log. Opening it was still recorded.',
  },
  rules: {
    screen: 'Rules',
    nothingYet: 'Not applicable: every tab has a value from the first day.',
    nothingFound: 'Not applicable',
    error: 'We could not load the rules. Pay runs are not affected.',
    notApplicable: true,
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
