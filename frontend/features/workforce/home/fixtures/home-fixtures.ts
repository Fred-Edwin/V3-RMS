import type { CardDataState } from '../lib/card-registry';
import type { BoardData, WaitingData } from '../cards/branch-cards';
import type { AttentionData, ComingUpData, KpiData, PeopleData } from '../cards/hr-cards';
import type { ClockCardData, TeamCardData, WeekCardData } from '../cards/phone-cards-defs';
import { formatHms } from '../../_shared';

/**
 * The names and numbers Paper's Chapter 1 screens draw, as card data, so every block shows in the dev gallery before any slice feeds
 * it. Examples only (Paper says so too). Never imported by the product screens.
 */

const noop = (): void => undefined;
const ready = <T>(data: T): CardDataState<unknown> => ({ status: 'ready', data });

// ── HR Manager (step 02) ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const HR_KPIS: KpiData = {
  cells: [
    { key: 'waiting', label: 'WAITING FOR YOU', value: '5', detail: '2 leave, 2 reports, 1 pay run step', actionable: true, onSelect: noop },
    { key: 'onboarding', label: 'ONBOARDING', value: '3', detail: 'employee files not complete', actionable: true, onSelect: noop },
    { key: 'contract', label: 'NO CONTRACT YET', value: '4', detail: 'monthly staff on the default policy', actionable: true, onSelect: noop },
    { key: 'payrun', label: 'OCTOBER PAY RUN', value: '82%', detail: 'of hours approved, 3 timesheets left' },
  ],
};

export const HR_ATTENTION: AttentionData = {
  viewAll: { label: 'View all 11', onClick: noop },
  items: [
    { key: '1', kind: 'request', title: 'Leave request · Faith Njeri', detail: "Annual leave, 12 to 16 Oct, 5 days · Branch Manager, Nyeri Town · a manager's own leave comes to you", age: '1 DAY', action: { label: 'Review', onClick: noop } },
    { key: '2', kind: 'report', title: 'Report a problem · Lucy Wambui', detail: "Says Friday's lateness was a bus breakdown · waiting on Faith Njeri for 4 days, moved to you", age: '4 DAYS', late: true, action: { label: 'Review', onClick: noop } },
    { key: '3', kind: 'setup', title: 'Finish hiring · Wanjiru Kamau', detail: 'Barista, Nyeri Town · pay and bank details are missing, so she cannot be paid yet', age: 'TODAY', action: { label: 'Finish', onClick: noop } },
    { key: '4', kind: 'date', title: 'Probation ends · Joy Chebet', detail: 'Barista, Nyeri Town · 14 Oct · decide whether to confirm her', age: '10 DAYS', action: { label: 'Open', onClick: noop } },
    { key: '5', kind: 'setup', title: 'No head for Pastry · Nyeri Highway', detail: 'Their rota and approvals are going to the branch manager for now', age: 'SET UP', action: { label: 'Assign', onClick: noop } },
  ],
};

export const HR_PEOPLE: PeopleData = {
  rows: [
    { key: 'town', name: 'Nyeri Town', count: 42 },
    { key: 'highway', name: 'Nyeri Highway', count: 31 },
    { key: 'store', name: 'Central Store', count: 12 },
    { key: 'office', name: 'Head office', count: 4 },
  ],
  note: '3 people are on leave today. 6 casuals are on the department pools and are not counted here.',
};

export const HR_COMING_UP: ComingUpData = {
  events: [
    { key: '1', date: '12 OCT', text: 'Faith Njeri starts leave' },
    { key: '2', date: '14 OCT', text: "Joy Chebet's probation ends" },
    { key: '3', date: '25 OCT', text: 'October timesheets close' },
    { key: '4', date: '28 OCT', text: 'Pay run goes to the Accountant' },
    { key: '5', date: '30 OCT', text: 'Payday', tone: 'good' },
  ],
};

// ── Branch Manager (step 03); the Store Manager sees the same for the Central Store ───────────────────────────────────────────
export const BRANCH_KPIS: KpiData = {
  cells: [
    { key: 'on', label: 'ON SHIFT NOW', value: '29', detail: 'of 31 rostered' },
    { key: 'late', label: 'LATE TODAY', value: '2', detail: '31 minutes in total', actionable: true, onSelect: noop },
    { key: 'notin', label: 'NOT IN YET', value: '2', detail: 'the longest 4 h 42 m', actionable: true, onSelect: noop },
    { key: 'waiting', label: 'WAITING FOR YOU', value: '4', detail: 'one tap each', actionable: true, onSelect: noop },
  ],
};

export const BRANCH_BOARD: BoardData = {
  shiftLine: 'Morning · 06:00 to 14:00 · 31 rostered',
  chips: [
    { key: 'all', label: 'All', count: 31 },
    { key: 'Kitchen', label: 'Kitchen', count: 9 },
    { key: 'Barista', label: 'Barista', count: 7, marker: 'warning' },
    { key: 'Service', label: 'Service', count: 10, marker: 'error' },
    { key: 'Pastry', label: 'Pastry', count: 3 },
    { key: 'Housekeeping', label: 'Housekeeping', count: 2 },
  ],
  looks: [
    { key: 'em', name: 'Esther Mwende', role: 'Steward · Service', status: 'Not in yet · due 06:00', tone: 'error', tile: 'muted', actions: [{ label: 'Clock in for her', onClick: noop }, { label: 'Mark absent', kind: 'danger', onClick: noop }] },
    { key: 'ah', name: 'Amina Hassan', role: 'Barista · Barista', status: 'Not in yet · due 06:00', tone: 'error', tile: 'muted', actions: [{ label: 'Clock in for her', onClick: noop }, { label: 'Mark absent', kind: 'danger', onClick: noop }] },
    { key: 'lw', name: 'Lucy Wambui', role: 'Waiter · Service', status: 'Late 22 min · in 06:22', tone: 'warning', tile: 'name', late: { grace: 5, minutes: 22 } },
    { key: 'mn', name: 'Mark Njoroge', role: 'Barista · Barista', status: 'Late 9 min · in 06:09', tone: 'warning', tile: 'name', late: { grace: 5, minutes: 9 } },
  ],
  departments: [
    { key: 'kitchen', name: 'Kitchen', onTime: 9, people: ['Kelvin Kings', 'Aisha Noor', 'Peter Mugo', 'Grace Wanjiku', 'Ian Kariuki', 'Tom Mwangi', 'Zawadi Ali', 'Dan Otieno', 'Sam Kirui'], note: { text: 'Head: Kelvin Kings', tone: 'muted' }, onOpen: noop },
    { key: 'barista', name: 'Barista', onTime: 5, people: ['Beth Njeri', 'Carl Mwenda', 'Dina Omar', 'Eli Kamau', 'Faith Ruto'], note: { text: '2 more are in Needs a look', tone: 'warning' }, onOpen: noop },
    { key: 'service', name: 'Service', onTime: 8, people: ['Nancy Wangari', 'Brian Otieno', 'Victor Maina', 'Joy Chebet', 'Rose Atieno', 'Kim Ndung', 'Lee Kibet', 'Ann Wafula'], note: { text: '2 more are in Needs a look', tone: 'warning' }, onOpen: noop },
    { key: 'pastry', name: 'Pastry', onTime: 3, people: ['Lucia Wanjiru', 'Mary Chege', 'Noel Kimani'], note: { text: 'Head: Lucia Wanjiru', tone: 'muted' }, onOpen: noop },
    { key: 'housekeeping', name: 'Housekeeping', onTime: 2, people: ['Ruth Njoki', 'Paul Okoth'], note: { text: 'No head assigned', tone: 'error' }, onOpen: noop },
  ],
};

export const BRANCH_WAITING: WaitingData = {
  openAll: { label: 'Open all', onClick: noop },
  items: [
    { key: '1', title: 'Overtime · Brian Otieno', detail: 'Stayed on yesterday, 1 h 30 m. 6 orders worth KES 8,420 in that time.', actions: [{ label: 'Approve', kind: 'primary', onClick: noop }, { label: 'Decline', onClick: noop }] },
    { key: '2', title: 'Overtime · Victor Maina', detail: 'Stayed on yesterday, 25 min, with 2 tickets open. Inside the service tail, so approved on its own.', actions: [{ label: 'See why', onClick: noop }] },
    { key: '3', title: 'Report a problem · Joy Chebet', detail: 'Says she clocked out at 14:00 on Friday, the record shows 15:35.', actions: [{ label: 'Review', kind: 'primary', onClick: noop }] },
    { key: '4', title: 'Leave · Lucy Wambui', detail: 'Annual leave, 19 to 20 Oct. No clash on the rota.', actions: [{ label: 'Approve', kind: 'primary', onClick: noop }, { label: 'Decline', onClick: noop }] },
  ],
};

// ── Accountant and Director (reference table, no drawing) ───────────────────────────────────────────────────────────────────────
export const PAYRUN_KPIS: KpiData = {
  cells: [
    { key: 'steps', label: 'PAY RUN STEPS WAITING', value: '2', detail: 'for the Accountant', actionable: true, onSelect: noop },
    { key: 'rules', label: 'RULES TO CONFIRM', value: '1', detail: 'overtime multipliers', actionable: true, onSelect: noop },
    { key: 'approved', label: 'OCTOBER PAY RUN', value: '82%', detail: 'of hours approved, 3 timesheets left' },
    { key: 'payday', label: 'PAYDAY', value: '30 Oct', detail: 'in 26 days' },
  ],
};

export const PAYRUN_STEPS: AttentionData = {
  items: [
    { key: '1', kind: 'request', title: 'Approve the October pay run', detail: 'Prepared by Mercy Achieng · 89 people · waiting for your approval', age: '28 OCT', action: { label: 'Review', onClick: noop } },
    { key: '2', kind: 'setup', title: 'Confirm the overtime multipliers', detail: 'The 2 x holiday rate and the weekday overtime rate need your confirmation before the run', age: '2 DAYS', late: true, action: { label: 'Confirm', onClick: noop } },
  ],
};

export const OVERDUE_APPROVALS: AttentionData = {
  items: [
    { key: '1', kind: 'report', title: 'Leave request · Faith Njeri', detail: 'Waiting on Mercy Achieng for 6 days, past the 5 day limit', age: '6 DAYS', late: true, action: { label: 'Open', onClick: noop } },
    { key: '2', kind: 'report', title: 'Overtime · Victor Maina', detail: 'Waiting on Faith Njeri for 4 days, past the 3 day limit', age: '4 DAYS', late: true, action: { label: 'Open', onClick: noop } },
  ],
};

export const PAYRUN_COMING_UP: ComingUpData = {
  events: [
    { key: '1', date: '25 OCT', text: 'October timesheets close' },
    { key: '2', date: '28 OCT', text: 'Pay run goes to the Accountant' },
    { key: '3', date: '30 OCT', text: 'Payday', tone: 'good' },
  ],
};

// ── Phone (step 05) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const noopAction = (label: string) => ({ label, onClick: noop });

export const CLOCK_ON_SHIFT: ClockCardData = {
  shiftLabel: 'MORNING · 06:00 TO 14:00',
  statusLabel: 'ON SHIFT',
  statusTone: 'on',
  timer: formatHms(4 * 3600 + 46 * 60 + 12),
  caption: 'In at 05:56. Your shift ends in 3 h 14 m.',
  progress: { percent: 52, ticks: ['06', '08', '10', '12', '14'], label: 'Shift progress' },
};

export const WEEK_STAFF: WeekCardData = {
  range: '28 SEP TO 4 OCT',
  hours: '36 h 20 m',
  hoursOf: 'of 40 h this week',
  overtimeWaiting: '1 h 30 m overtime waiting',
  bars: [
    { letter: 'M', fraction: 1, state: 'worked', label: 'Monday, 8 hours worked' },
    { letter: 'T', fraction: 1, state: 'worked', label: 'Tuesday, 8 hours worked' },
    { letter: 'W', fraction: 0, state: 'off', label: 'Wednesday, day off' },
    { letter: 'T', fraction: 1, state: 'worked', label: 'Thursday, 8 hours worked' },
    { letter: 'F', fraction: 1, extra: 0.2, state: 'worked', label: 'Friday, 8 hours and overtime' },
    { letter: 'S', fraction: 1, state: 'worked', label: 'Saturday, 8 hours worked' },
    { letter: 'S', fraction: 0.6, state: 'worked', today: true, label: 'Sunday, today, 4 hours so far' },
  ],
};

export const WEEK_HEAD: WeekCardData = {
  range: '28 SEP TO 4 OCT',
  hours: '35 h 05 m',
  hoursOf: 'of 40 h this week',
  bars: [
    { letter: 'M', fraction: 1, state: 'worked', label: 'Monday, 8 hours worked' },
    { letter: 'T', fraction: 1, state: 'worked', label: 'Tuesday, 8 hours worked' },
    { letter: 'W', fraction: 1, state: 'worked', label: 'Wednesday, 8 hours worked' },
    { letter: 'T', fraction: 0, state: 'off', label: 'Thursday, day off' },
    { letter: 'F', fraction: 1, state: 'worked', label: 'Friday, 8 hours worked' },
    { letter: 'S', fraction: 1, state: 'worked', label: 'Saturday, 8 hours worked' },
    { letter: 'S', fraction: 0.6, state: 'worked', today: true, label: 'Sunday, today, 4 hours so far' },
  ],
};

export const HEAD_WAITING: WaitingData = {
  items: [
    { key: '1', kind: 'overtime', title: 'Overtime · Lucy Wambui', detail: 'Stayed on 20 min with 3 tables open. Inside your allowance.', actions: [{ label: 'Approve', kind: 'primary', onClick: noop }, { label: 'Decline', onClick: noop }] },
    { key: '2', kind: 'casuals', title: 'Casuals · today', detail: 'Record who worked. The Branch Manager approves the day.', actions: [{ label: 'Record the day', kind: 'primary', onClick: noop }] },
  ],
};

export const HEAD_TEAM: TeamCardData = {
  title: 'Service team today',
  expected: 10,
  present: 9,
  people: ['Nancy Wangari', 'Brian Otieno', 'Victor Maina', 'Joy Chebet', 'Rose Atieno', 'Kim Ndung', 'Lee Kibet', 'Ann Wafula', 'Dan Otieno'],
  lateCount: 1,
  notInCount: 1,
  open: { label: 'Open', onClick: noop },
  rows: [
    { key: 'em', name: 'Esther Mwende', status: 'Not in yet · due 06:00', tone: 'error', action: noopAction('Clock in for her') },
    { key: 'lw', name: 'Lucy Wambui', status: 'Late 22 min · in 06:22', tone: 'warning', late: { grace: 6, minutes: 22 } },
  ],
};

export const JOB_SLOT = { text: 'Job cards: open tables and orders. Designed in the Orders redo.' };

// ── What each role's Home is made of, as card states keyed by card id ──────────────────────────────────────────────────────────
export const HR_STATES: Record<string, CardDataState<unknown>> = {
  'workforce.hr-kpis': ready(HR_KPIS),
  'workforce.hr-attention': ready(HR_ATTENTION),
  'workforce.people-by-branch': ready(HR_PEOPLE),
  'workforce.coming-up': ready(HR_COMING_UP),
};
export const BRANCH_STATES: Record<string, CardDataState<unknown>> = {
  'workforce.branch-kpis': ready(BRANCH_KPIS),
  'workforce.today-board': ready({ fixture: BRANCH_BOARD }),
  'workforce.waiting-for-you.desktop': ready(BRANCH_WAITING),
};
export const ACCOUNTANT_STATES: Record<string, CardDataState<unknown>> = {
  'workforce.payrun-kpis': ready(PAYRUN_KPIS),
  'workforce.payrun-steps': ready(PAYRUN_STEPS),
  'workforce.coming-up': ready(PAYRUN_COMING_UP),
};
export const DIRECTOR_STATES: Record<string, CardDataState<unknown>> = {
  'workforce.payrun-kpis': ready(PAYRUN_KPIS),
  'workforce.overdue-approvals': ready(OVERDUE_APPROVALS),
  'workforce.company-headcount': ready(HR_PEOPLE),
  'workforce.coming-up': ready(PAYRUN_COMING_UP),
};
export const STAFF_STATES: Record<string, CardDataState<unknown>> = {
  'workforce.clock': ready({ fixture: CLOCK_ON_SHIFT }),
  'workforce.job-cards-slot': ready(JOB_SLOT),
  'workforce.this-week': ready(WEEK_STAFF),
};
export const HEAD_STATES: Record<string, CardDataState<unknown>> = {
  'workforce.clock': ready({ fixture: { ...CLOCK_ON_SHIFT, timer: formatHms(4 * 3600 + 38 * 60 + 40), caption: 'In at 06:04. Your shift ends in 3 h 22 m.' } }),
  'workforce.waiting-for-you.phone': ready(HEAD_WAITING),
  'workforce.job-cards-slot': ready(JOB_SLOT),
  'workforce.team-today': ready({ fixture: HEAD_TEAM }),
  'workforce.this-week': ready(WEEK_HEAD),
};
