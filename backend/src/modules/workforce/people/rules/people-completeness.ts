import type { SensitiveGroup } from '../../_shared/workforce-access';

export const FILE_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'EMERGENCY_CONTACT', 'CONTRACT'] as const;
export type FilePart = (typeof FILE_PARTS)[number];

/** What the server knows about a file, as plain facts. Built by the repository; no value ever leaves in this shape. */
export interface FileFacts {
  casual: boolean;
  hasNationalId: boolean;
  hasPhone: boolean;
  hasPosition: boolean;
  hasDepartment: boolean;
  /** Runs a place, not a department (Branch Manager, Store Manager, Accountant, Director, HR, System Admin): no department is expected. */
  departmentOptional: boolean;
  payAmountSet: boolean;
  payoutComplete: boolean; // BANK needs bank and account number; MPESA needs a phone; CASH is complete
  hasLogin: boolean;
  hasNssf: boolean;
  hasSha: boolean;
  hasPhoto: boolean;
  hasPersonalDetails: boolean; // personal phone and address
  hasEmergencyContact: boolean;
  contractActive: boolean;
}

export interface PartState {
  part: FilePart;
  applicable: boolean;
  done: boolean;
}

export const fileParts = (f: FileFacts): PartState[] => [
  { part: 'IDENTITY', applicable: true, done: f.hasNationalId && f.hasPhone },
  { part: 'JOB', applicable: true, done: f.hasPosition && (f.hasDepartment || f.departmentOptional) },
  { part: 'PAY', applicable: true, done: f.payAmountSet },
  { part: 'BANK', applicable: !f.casual, done: f.payoutComplete },
  { part: 'LOGIN', applicable: !f.casual, done: f.hasLogin },
  { part: 'NSSF_SHA', applicable: !f.casual, done: f.hasNssf && f.hasSha },
  { part: 'PHOTO_AND_DETAILS', applicable: !f.casual, done: f.hasPhoto && f.hasPersonalDetails },
  { part: 'EMERGENCY_CONTACT', applicable: true, done: f.hasEmergencyContact },
  { part: 'CONTRACT', applicable: !f.casual, done: f.contractActive },
];

/** The ring on the Overview (Paper Chapter 4, step 1): six parts. */
export const RING_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'CONTRACT', 'EMERGENCY_CONTACT'] as const satisfies readonly FilePart[];

/** The onboarding checklist (Paper Chapter 2, step 7): six rows, each made of one or two parts. */
export const CHECKLIST_ROWS = {
  WHO_AND_JOB: ['IDENTITY', 'JOB'],
  PAY_AND_BANK: ['PAY', 'BANK'],
  LOGIN: ['LOGIN'],
  NSSF_SHA: ['NSSF_SHA'],
  PHOTO_AND_DETAILS: ['PHOTO_AND_DETAILS'],
  CONTRACT: ['CONTRACT'],
} as const satisfies Record<string, readonly FilePart[]>;
export type ChecklistRow = keyof typeof CHECKLIST_ROWS;

const percent = (done: number, total: number): number => (total === 0 ? 100 : Math.round((done / total) * 100));

export const ringPercent = (states: readonly PartState[]): number => {
  const used = states.filter((s) => s.applicable && (RING_PARTS as readonly FilePart[]).includes(s.part));
  return percent(used.filter((s) => s.done).length, used.length);
};

export const checklistRows = (states: readonly PartState[]): { row: ChecklistRow; applicable: boolean; done: boolean }[] =>
  (Object.entries(CHECKLIST_ROWS) as [ChecklistRow, readonly FilePart[]][]).map(([row, parts]) => {
    const mine = states.filter((s) => s.applicable && parts.includes(s.part));
    return { row, applicable: mine.length > 0, done: mine.length > 0 && mine.every((s) => s.done) };
  });

export const checklistPercent = (rows: readonly { applicable: boolean; done: boolean }[]): number => {
  const used = rows.filter((r) => r.applicable);
  return percent(used.filter((r) => r.done).length, used.length);
};

/** Which sensitive group a part belongs to; a viewer who is locked out of the group never sees the part's gap. */
export const PART_GROUP: Partial<Record<FilePart, SensitiveGroup>> = {
  IDENTITY: 'ids',
  NSSF_SHA: 'ids',
  PAY: 'pay',
  BANK: 'bank',
};

/** Parts that make a file "Needs finishing" (question 10). Contract and emergency contact have their own filter and request. */
export const NEEDS_FINISHING_PARTS = ['IDENTITY', 'JOB', 'PAY', 'BANK', 'LOGIN', 'NSSF_SHA', 'PHOTO_AND_DETAILS'] as const satisfies readonly FilePart[];

/**
 * Parts whose gap stops the pay run or the rota (findings 8, 49, 52): the job, the pay amount, the payout details and the NSSF and SHA
 * numbers. A missing login, photo or emergency contact makes a file incomplete but blocks neither.
 */
export const BLOCKS_PAYROLL_PARTS = ['JOB', 'PAY', 'BANK', 'NSSF_SHA'] as const satisfies readonly FilePart[];

export const gapsOf = (states: readonly PartState[], locked: readonly SensitiveGroup[]): FilePart[] =>
  states
    .filter((s) => s.applicable && !s.done)
    .filter((s) => {
      const group = PART_GROUP[s.part];
      return group === undefined || !locked.includes(group);
    })
    .map((s) => s.part);
