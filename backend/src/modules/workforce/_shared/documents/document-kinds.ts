import { scopeOf, workforceCan, type AccessSubject, type Capability } from '../workforce-access';

/** Every numbered, signed document the company issues (6c D1). The rota has no sign step, so it is not here (SD28). */
export const DOCUMENT_KINDS = ['PAY', 'PS', 'CPS', 'P9', 'TSH', 'LVE', 'WRN', 'CTR'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface KindInfo {
  /** The word in the verify address: `/verify/ps/PS-0987`. */
  slug: string;
  /** The Types menu and the verify page. */
  label: string;
  /** "It is a payroll statement for ..." on the signed-in "you cannot read this" answer. */
  typeWords: string;
  /** Who may read the type, in role words, for the same answer. */
  readableBy: readonly string[];
  /** Visibility is the type's own capability, read from the one access table; never a role list here. */
  capability: Capability;
  /** The role that issued it and is told when a printed copy does not match (6c D3). */
  issuerRole: 'ACCOUNTANT' | 'MANAGER' | 'HR_MANAGER' | 'DIRECTOR';
}

export const KIND_INFO: Record<DocumentKind, KindInfo> = {
  PAY: { slug: 'pay', label: 'Payroll', typeWords: 'payroll statement', readableBy: ['the Accountant', 'HR', 'the Director'], capability: 'payroll.read', issuerRole: 'ACCOUNTANT' },
  PS: { slug: 'ps', label: 'Payslip', typeWords: 'payslip', readableBy: ['the person it is for', 'HR', 'the Accountant'], capability: 'payslip.read_any', issuerRole: 'ACCOUNTANT' },
  CPS: { slug: 'cps', label: 'Casual pay sheet', typeWords: 'casual pay sheet', readableBy: ['the Branch Manager', 'HR', 'the Accountant', 'the Director'], capability: 'casual.read', issuerRole: 'MANAGER' },
  P9: { slug: 'p9', label: 'P9', typeWords: 'tax certificate', readableBy: ['the person it is for', 'HR', 'the Accountant'], capability: 'payslip.read_any', issuerRole: 'ACCOUNTANT' },
  TSH: { slug: 'tsh', label: 'Timesheet report', typeWords: 'timesheet report', readableBy: ['the Branch Manager', 'HR', 'the Accountant', 'the Director'], capability: 'timesheet.read', issuerRole: 'MANAGER' },
  LVE: { slug: 'lve', label: 'Leave slip', typeWords: 'leave slip', readableBy: ['the person it is for', 'the Branch Manager', 'HR'], capability: 'leave.read', issuerRole: 'MANAGER' },
  WRN: { slug: 'wrn', label: 'Warning notice', typeWords: 'warning notice', readableBy: ['the person it is for', 'HR', 'the Director'], capability: 'discipline.read', issuerRole: 'HR_MANAGER' },
  CTR: { slug: 'ctr', label: 'Contract', typeWords: 'employment contract', readableBy: ['HR', 'the Director'], capability: 'employee.read_sensitive', issuerRole: 'HR_MANAGER' },
};

export const kindOfSlug = (slug: string): DocumentKind | null => DOCUMENT_KINDS.find((k) => KIND_INFO[k].slug === slug.toLowerCase()) ?? null;

/** A document number is its kind, a dash and letters, digits and dashes: `PS-0987`, `PAY-2026-09`. Anything else is malformed. */
export const NUMBER_PATTERN = /^[A-Z0-9]{2,4}(-[A-Z0-9]{1,8}){1,2}$/;
export const isWellFormedNumber = (kind: DocumentKind, number: string): boolean => NUMBER_PATTERN.test(number) && number.startsWith(`${kind}-`);

export interface ReadableKind {
  kind: DocumentKind;
  /** Set when the reader sees only one site's documents of this type. */
  siteId: string | null;
}

/**
 * The types this person may read, from the access table. 'all' reads every site; 'unit' reads the person's own site; 'own' and 'dept'
 * scopes read nothing here (the index is a desktop, company-wide screen). A type the person may not read is not listed and not counted.
 */
export function readableKindsOf(subject: AccessSubject): ReadableKind[] {
  return DOCUMENT_KINDS.flatMap((kind): ReadableKind[] => {
    const capability = KIND_INFO[kind].capability;
    if (!workforceCan(subject, capability)) return [];
    const scope = scopeOf(subject, capability);
    if (scope === 'all') return [{ kind, siteId: null }];
    if (scope === 'unit' && subject.siteId) return [{ kind, siteId: subject.siteId }];
    return [];
  });
}
