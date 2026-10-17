import type { EmployeeFile } from '../../_shared/types/people-types';

/**
 * The ID and bank values a file can show masked and reveal on request (W28). Opening one in clear is written to the audit log, so the
 * screen asks only when someone presses "Show", and puts it away again after 30 seconds.
 */
export const REVEAL_MS = 30_000;

export interface SensitiveField {
  key: string;
  label: string;
  group: 'ids' | 'bank';
}

export const SENSITIVE_FIELDS: readonly SensitiveField[] = [
  { key: 'nationalId', label: 'National ID', group: 'ids' },
  { key: 'kraPin', label: 'KRA PIN', group: 'ids' },
  { key: 'shaNumber', label: 'SHA number', group: 'ids' },
  { key: 'nssfNumber', label: 'NSSF number', group: 'ids' },
  { key: 'helbNumber', label: 'HELB number', group: 'ids' },
  { key: 'bankName', label: 'Bank', group: 'bank' },
  { key: 'accountNumber', label: 'Account number', group: 'bank' },
  { key: 'mpesaPhone', label: 'M-Pesa number', group: 'bank' },
];

export interface SensitiveRow {
  key: string;
  label: string;
  /** What the API sent: masked ("•••• 5678"), or null when nothing is on file. */
  masked: string | null;
  /** A value that is on file can be shown; one that is not has nothing to reveal. */
  canReveal: boolean;
}

/** The rows for the groups this viewer may see. A locked group is absent from `file.sensitive`, so its rows are left out. */
export function sensitiveRows(file: Pick<EmployeeFile, 'sensitive' | 'locked'>): SensitiveRow[] {
  return SENSITIVE_FIELDS.filter((f) => !file.locked.includes(f.group) && f.key in file.sensitive).map((f) => {
    const masked = file.sensitive[f.key] ?? null;
    return { key: f.key, label: f.label, masked, canReveal: masked !== null && masked !== '' };
  });
}
