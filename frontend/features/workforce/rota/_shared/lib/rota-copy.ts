import type { SaveStatus } from '../hooks/use-rota-editor';

/**
 * The words of the Shifts screens. Copy says "they" or the first name, never a guessed pronoun. Nothing here mentions publishing: edits
 * save at once and staff are told a few minutes after the last change.
 */

/** Why a shift for today or tomorrow was changed (Paper step 5). */
export const NEAR_TERM_REASONS = [
  { key: 'gap', label: 'Cover for a gap' },
  { key: 'request', label: 'Staff request' },
  { key: 'busy', label: 'Busy day expected' },
] as const;

/** Why someone on approved leave is given a shift (Paper step 4). */
export const LEAVE_OVERRIDE_REASONS = [
  { key: 'asked', label: 'They asked to work' },
  { key: 'gap', label: 'Cover for a gap' },
  { key: 'short', label: 'Leave was cut short' },
] as const;

export const RESTING_STATUS = 'Changes save as you go · Staff are told when their shifts change';
export const TOLD_LINE = 'Saved · Staff are told when their shifts change';

/** The top bar's status: "Saved just now" and how long ago after that, or the failure in words. */
export function statusLine(status: SaveStatus, now: number): { text: string; tone: 'default' | 'error' } {
  if (status.kind === 'saving') return { text: 'Saving…', tone: 'default' };
  if (status.kind === 'error') return { text: `Not saved · ${status.message}`, tone: 'error' };
  if (status.kind === 'idle') return { text: RESTING_STATUS, tone: 'default' };
  const minutes = Math.floor((now - status.at) / 60_000);
  const when = minutes < 1 ? 'just now' : minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return { text: `Saved ${when} · Staff are told when their shifts change`, tone: 'default' };
}

export const GRID_NOTE = "Past days are read-only: fix those in Timesheets. Pick a department on the left to see its week.";
export const GRID_NOTE_SITES = "Past days are read-only: fix those in Timesheets. Pick a site on the left, then filter by department.";
export const GRID_NOTE_READ_ONLY = 'You can read these shifts but not change them.';
export const LEFT_NOTE = 'Changes save as you go and staff are told. Warnings never block.';
export const LEFT_NOTE_SITES = 'HR builds any site. Each Branch Manager still sees only their own shifts.';

export const NO_ONE_ON_ROTA = { title: 'No one has shifts here yet', body: 'People who clock in appear here once they are hired into a department.' };
export const NO_ACCESS = { title: "You can't open Shifts", body: 'Ask HR if you need to plan or read a team’s week.' };

export const COPY_NOTE = 'Clashes are shown, never copied. Staff are told about their new shifts a few minutes after you finish.';
export const COPY_REASON_NOTE = 'Some of these days are today or tomorrow, so the copy needs a reason.';
