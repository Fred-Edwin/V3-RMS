import { firstName, type FileDialogKey } from '../file-model';
import type { ChecklistRowKey, EmployeeFile } from '../../../_shared/types/people-types';

/** The onboarding checklist as Paper `SBM-0` draws it: a tick, a title, a grey word on the right, and one button when the viewer may act. */

export interface OnboardingRow {
  key: ChecklistRowKey;
  title: string;
  done: boolean;
  /** Grey words at the right ("Waiting on Wanjiru", "Link sent to their email"). */
  status: string;
  /** A tinted row is one that waits on the person. */
  waiting: boolean;
  action: { label: string; dialog: FileDialogKey; requestId?: string } | null;
}

const TITLES: Record<ChecklistRowKey, string> = {
  WHO_AND_JOB: 'Who and job details',
  PAY_AND_BANK: 'Pay profile and bank account',
  LOGIN: 'Login created',
  NSSF_SHA: 'NSSF and SHA numbers',
  PHOTO_AND_DETAILS: 'Their photo and personal details',
  CONTRACT: 'Contract',
};

export function onboardingRows(file: EmployeeFile): OnboardingRow[] {
  const first = firstName(file.name);
  const requestFor = (kind: 'NSSF_SHA' | 'PHOTO_AND_DETAILS'): string | undefined => file.nextSteps.find((s) => s.code === 'FILE_REQUEST' && s.fileRequestKind === kind)?.fileRequestId;
  return (file.completeness?.checklist ?? [])
    .filter((c) => c.applicable)
    .map((c): OnboardingRow => {
      const base = { key: c.row, title: TITLES[c.row], done: c.done };
      if (c.row === 'WHO_AND_JOB') return { ...base, status: c.done ? 'Done' : 'Incomplete', waiting: false, action: !c.done && file.actions.editJob ? { label: 'Edit', dialog: 'edit-job' } : null };
      if (c.row === 'PAY_AND_BANK') return { ...base, status: c.done ? 'Done' : 'Waiting on HR', waiting: !c.done, action: !c.done && file.actions.changePay ? { label: 'Add pay', dialog: 'change-pay' } : null };
      if (c.row === 'LOGIN') return { ...base, status: c.done ? 'Link sent to their email' : 'No login yet', waiting: !c.done, action: !c.done && file.actions.createLogin ? { label: 'Create login', dialog: 'login' } : null };
      if (c.row === 'CONTRACT') return { ...base, status: c.done ? 'On file' : 'not urgent', waiting: false, action: !c.done && file.actions.createContract ? { label: 'Assign contract', dialog: 'contract' } : null };
      // NSSF and SHA, photo and details: the person adds them on their phone, so the button asks or reminds.
      const kind = c.row;
      const requestId = requestFor(kind);
      if (c.done) return { ...base, status: kind === 'NSSF_SHA' ? 'Added' : 'Added by them', waiting: false, action: kind === 'NSSF_SHA' && file.actions.uploadDocument ? { label: 'Verify', dialog: 'verify' } : null };
      return {
        ...base,
        status: `Waiting on ${first}`,
        waiting: true,
        action: file.actions.remind ? { label: requestId ? 'Remind' : 'Ask', dialog: 'ask', requestId } : null,
      };
    });
}

/** The line under the ring: what the person can already do and how many things payroll still waits on. */
export function onboardingSentence(file: EmployeeFile): string {
  const open = (file.completeness?.checklist ?? []).filter((c) => c.applicable && !c.done && c.row !== 'CONTRACT').length;
  const can = file.tracksTime ? 'They can be rostered and can clock in.' : 'They can be rostered.';
  return open === 0 ? `${can} Nothing holds payroll.` : `${can} Payroll waits on ${open} ${open === 1 ? 'item' : 'items'}.`;
}
