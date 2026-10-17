import type { HrDocumentType, UserRole } from '@prisma/client';

/** All of these are EXAMPLES the owner can change (contract section 11). None is a legal or policy value. */
export const EMPLOYEE_NUMBER_PREFIX = 'W-';
export const EXIT_UNDO_DAYS = 7;
export const DRAFT_KEEP_DAYS = 30;

export const EXIT_REASONS = ['RESIGNED', 'END_OF_CONTRACT', 'DISMISSED', 'REDUNDANCY', 'RETIRED', 'OTHER'] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

export const PAY_CHANGE_REASONS = ['HIRING', 'PROBATION_CONFIRMED', 'PROMOTION', 'ANNUAL_REVIEW', 'CORRECTION', 'OTHER'] as const;
export type PayChangeReason = (typeof PAY_CHANGE_REASONS)[number];

export const FILE_REQUEST_KINDS = ['EMERGENCY_CONTACT', 'NSSF_SHA', 'PHOTO_AND_DETAILS', 'ID_NUMBER', 'BANK_DETAILS'] as const;
export type FileRequestKind = (typeof FILE_REQUEST_KINDS)[number];

export const PROBATION_VERDICTS = ['GOOD', 'CONCERNS'] as const;
export type ProbationVerdict = (typeof PROBATION_VERDICTS)[number];

/** Login roles a hire may give. The privileged roles are created in Access and then adopted into a file. */
export const HIRE_LOGIN_ROLES = ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT'] as const satisfies readonly UserRole[];
export type HireLoginRole = (typeof HIRE_LOGIN_ROLES)[number];

/** What a position may name as its login role (a prefill; hiring still uses HIRE_LOGIN_ROLES). Never the System Admin or a device. */
export const POSITION_LOGIN_ROLES = [
  ...HIRE_LOGIN_ROLES,
  'MANAGER',
  'STORE_MANAGER',
  'ACCOUNTANT',
  'HR_MANAGER',
  'DIRECTOR',
] as const satisfies readonly UserRole[];

/** Fields the reveal endpoint can return in clear, by sensitive group. */
export const REVEALABLE_FIELDS = {
  ids: ['nationalId', 'kraPin', 'shaNumber', 'nssfNumber', 'helbNumber', 'dateOfBirth', 'physicalAddress'],
  bank: ['bankName', 'bankBranch', 'accountName', 'accountNumber', 'mpesaPhone'],
} as const;
export const REVEALABLE_FIELD_LIST = [...REVEALABLE_FIELDS.ids, ...REVEALABLE_FIELDS.bank] as const;
export type RevealableField = (typeof REVEALABLE_FIELD_LIST)[number];

/** Every document type (mirrors the HrDocumentType enum; the compiler fails here if the enum gains a value). */
export const HR_DOCUMENT_TYPES = [
  'CONTRACT',
  'ID_COPY',
  'NATIONAL_ID_FRONT',
  'NATIONAL_ID_BACK',
  'CERTIFICATE',
  'MEDICAL_CERTIFICATE',
  'INCIDENT_REPORT',
  'WARNING_LETTER',
  'OTHER',
] as const satisfies readonly HrDocumentType[];
type MissingDocumentTypes = Exclude<HrDocumentType, (typeof HR_DOCUMENT_TYPES)[number]>;
export const DOCUMENT_TYPES_COMPLETE: [MissingDocumentTypes] extends [never] ? true : never = true;

/** The only documents a person may upload to their own file (the rest are HR-issued). */
export const SELF_UPLOADABLE_DOCUMENT_TYPES = ['ID_COPY', 'NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'CERTIFICATE', 'MEDICAL_CERTIFICATE', 'OTHER'] as const;
