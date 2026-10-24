/**
 * The words that explain a Workforce page and the dialogs on it. ONE file for the feature, keyed by route, so a page never carries its
 * own sentence and the owner reads (and changes) them in one place.
 *
 * Rules (docs/UI_BUILD_RULES.md section 9), asserted by `page-copy.test.ts`:
 *  - every page under the routes in `PURPOSE_ROUTES` has a purpose line;
 *  - a purpose line is one plain sentence pair, 90 characters at most: what the page is for, then the first thing to do;
 *  - a dialog opens with what WILL happen ("This copies ...") before it asks for anything;
 *  - no banned word anywhere in this file: the old name for Shifts, the build word "slice", "arrives with", and any he, she, her or his.
 */

/** The pages that have a purpose line today (Schedule: Shifts and Attendance). Add a route here and a line below in the same change. */
export const PURPOSE_ROUTES = [
  '/app/workforce/schedule/rota',
  '/app/workforce/schedule/rota/print',
  '/app/workforce/schedule/templates',
  '/app/workforce/today',
  '/app/workforce/attendance/switch',
  '/app/workforce/my-time',
  '/app/workforce/my-time/rota',
  '/app/workforce/my-time/requests',
  '/app/workforce/my-time/report',
] as const;

export type PurposeRoute = (typeof PURPOSE_ROUTES)[number];

/** One muted sentence under the page title: what the page is for, and the first thing to do. 90 characters at most. */
export const PURPOSE_LINES: Record<PurposeRoute, string> = {
  '/app/workforce/schedule/rota': 'Plan who works when. Click a day to pick a shift; changes save as you go.',
  '/app/workforce/schedule/rota/print': 'A printable copy of the week for the notice board. Press Print when it looks right.',
  '/app/workforce/schedule/templates': 'The shifts you can pick on the grid. Add one, or change times; staff are told.',
  '/app/workforce/today': 'See who is in, late or missing today. Open a name to clock them in or fix a time.',
  '/app/workforce/attendance/switch': 'Turn the new clock on or off for a branch. You sign each change with your PIN.',
  '/app/workforce/my-time': 'Your clocked hours for the month. Tap a day to report a time that looks wrong.',
  '/app/workforce/my-time/rota': 'Your planned shifts for the next two weeks. A day not planned yet says so.',
  '/app/workforce/my-time/requests': 'Your reports about wrong times, and who is looking at them. Nothing disappears.',
  '/app/workforce/my-time/report': 'Tell your manager a time is wrong. Pick the day, then say what happened.',
};

export const purposeOf = (route: PurposeRoute): string => PURPOSE_LINES[route];

/**
 * How each dialog opens: what will happen. Static lines are plain strings; the ones that name people or dates are small functions the
 * test calls with sample values.
 */
export const DIALOG_LEADS = {
  copyWeek: (from: string, to: string, department: string | null): string =>
    `This copies the shifts of the week of ${from} into the week of ${to}, ${department ? `for ${department}` : 'for every department'}. Nothing is overwritten, and you can change anything afterwards.`,
  copyDay: (team: string): string => `This copies one day's shifts onto another day for ${team}. Days that already have a shift are kept.`,
  nearTerm: 'This changes shifts that start in the next two days, and tells the people it affects. A reason is optional.',
  leaveOverride: (days: string): string => `This puts someone on a shift while approved leave covers ${days}. Say why, so the record is clear.`,
  template: 'This adds a shift to the grid for the departments you pick. Staff already planned keep their times.',
  templateEdit: 'This changes a shift on the grid from today on. Past days keep what was worked, and staff are told.',
  switchOn: (branch: string): string => `This turns the new clock on for ${branch}. Staff clock in on their phones against their shifts.`,
  switchOff: (branch: string): string => `This turns the new clock off for ${branch}. Staff go back to the old clock.`,
  editTime: (person: string): string => `This changes a clock time for ${person}. The old time stays in the history.`,
  clockFor: (person: string): string => `This records a clock-in for ${person} at the time you give. ${person} is told.`,
} as const;

/** The empty and error sentences of these pages say the next step (the States kit reads them from here). */
export const NEXT_STEP_LINES = {
  noShiftsYet: 'No shifts for {range} yet. Click a day to pick one, or use Start from last week.',
  noOneToday: 'Nobody has a shift today. Add one from Shifts.',
  couldNotLoad: 'It is taking longer than it should. Nothing was changed. Try again, and quote the reference if it keeps happening.',
} as const;
