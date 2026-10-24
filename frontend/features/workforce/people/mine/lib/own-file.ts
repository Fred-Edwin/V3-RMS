import type { PatchMeBody } from '../../_shared/types/people-requests';
import type { EmployeeFile } from '../../_shared/types/people-types';

/**
 * The person's own file (frames 8.1 to 8.6): what is still to finish, in the person's words, and the body the emergency form sends.
 * Pure and tested. Nothing here names a role: it works from the file the API sent for `me`. The numbers form is `own-numbers.ts`.
 */
export type OwnForm = 'emergency' | 'numbers' | 'photo';
/** The forms the screen can open: the three HR can ask for, and Edit on the IDs and bank card (`numbers`). */
export type OwnDialog = OwnForm | 'contact';

export interface StillToFinish {
  key: OwnForm;
  title: string;
  /** The grey line under the title. */
  detail: string;
  /** The word on the button. */
  action: string;
}

const TITLES: Record<OwnForm, string> = { emergency: 'Emergency contact', numbers: 'NSSF and SHA numbers', photo: 'Photo' };
/** The grey line under each title (frame 8.1). */
const DETAILS: Record<OwnForm, string> = { emergency: 'HR asked for it. Takes 1 minute.', numbers: 'HR asked for them. Takes 1 minute.', photo: 'Your team sees it on Shifts.' };
const PART_FOR: Record<OwnForm, 'EMERGENCY_CONTACT' | 'NSSF_SHA' | 'PHOTO_AND_DETAILS'> = { emergency: 'EMERGENCY_CONTACT', numbers: 'NSSF_SHA', photo: 'PHOTO_AND_DETAILS' };
const KIND_FOR: Record<string, OwnForm> = { EMERGENCY_CONTACT: 'emergency', NSSF_SHA: 'numbers', PHOTO_AND_DETAILS: 'photo' };

export function stillToFinish(file: EmployeeFile): StillToFinish[] {
  const asked = new Map<OwnForm, string>();
  for (const s of file.nextSteps) {
    const form = s.fileRequestKind ? KIND_FOR[s.fileRequestKind] : undefined;
    if (form && s.fileRequestAskedOn) asked.set(form, s.fileRequestAskedOn);
  }
  return (['emergency', 'numbers', 'photo'] as const).flatMap((key): StillToFinish[] => {
    const part = file.completeness?.parts.find((p) => p.part === PART_FOR[key]);
    const open = part ? part.applicable && !part.done : asked.has(key);
    if (!open && !asked.has(key)) return [];
    // Both numbers are already on the file (the IDs card shows them): there is nothing left to ask for (finding 66).
    if (key === 'numbers' && file.sensitive.nssfNumber && file.sensitive.shaNumber) return [];
    return [{ key, title: TITLES[key], detail: DETAILS[key], action: 'Add' }];
  });
}

export const RELATIONS = ['Parent', 'Spouse', 'Sibling', 'Other'] as const;

export interface EmergencyForm {
  name: string;
  relation: string;
  phone: string;
}

export function validateEmergency(f: EmergencyForm): Partial<Record<keyof EmergencyForm, string>> {
  const errors: Partial<Record<keyof EmergencyForm, string>> = {};
  if (f.name.trim().length < 2) errors.name = 'Enter their name.';
  if (f.relation === '') errors.relation = 'Choose how they are related to you.';
  if (f.phone.replace(/\D/g, '').length < 9) errors.phone = 'Enter a phone number such as 0712 345 678.';
  return errors;
}

export const toEmergencyBody = (f: EmergencyForm): PatchMeBody => ({ emergencyName: f.name.trim(), emergencyRelation: f.relation, emergencyPhone: f.phone.trim() });

/** "Day 80 of 90": how far through the finishing list the person is, for the bar in the header. */
export function finishProgress(file: EmployeeFile): { done: number; total: number } {
  const parts = (file.completeness?.parts ?? []).filter((p) => p.applicable && (p.part === 'EMERGENCY_CONTACT' || p.part === 'NSSF_SHA' || p.part === 'PHOTO_AND_DETAILS'));
  return { done: parts.filter((p) => p.done).length, total: parts.length };
}
