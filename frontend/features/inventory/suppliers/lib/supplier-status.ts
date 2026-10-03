import type { SupplierStatus } from '../types/supplier';

/** What the status buttons on the supplier page offer, by the status now. Archived suppliers come back as Active. */
export type StatusMove = 'HOLD' | 'ARCHIVE' | 'ACTIVATE';

export function movesFor(status: SupplierStatus): StatusMove[] {
  switch (status) {
    case 'ACTIVE':
      return ['HOLD', 'ARCHIVE'];
    case 'ON_HOLD':
      return ['ACTIVATE', 'ARCHIVE'];
    case 'ARCHIVED':
      return ['ACTIVATE'];
  }
}

export const MOVE_LABEL: Record<StatusMove, string> = { HOLD: 'Put on hold', ARCHIVE: 'Archive', ACTIVATE: 'Make active' };
export const MOVE_STATUS: Record<StatusMove, SupplierStatus> = { HOLD: 'ON_HOLD', ARCHIVE: 'ARCHIVED', ACTIVATE: 'ACTIVE' };

/** Why a supplier is archived: a label, or the words typed for "Other". */
export const ARCHIVE_REASONS = ['Closed down', 'We stopped using them', 'Other'] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export const STATUS_REASON_MAX = 200;

/** The sentence kept in the audit row. Null while an archive has no reason yet. */
export function composeArchiveReason(reason: ArchiveReason | null, otherNote: string): string | null {
  if (reason === null) return null;
  const base = reason === 'Other' ? otherNote.trim() : reason;
  if (base === '') return null;
  const sentence = /[.!?]$/.test(base) ? base : `${base}.`;
  return sentence.length > STATUS_REASON_MAX ? null : sentence;
}

/** A hold's note is optional; empty means none. */
export function holdReason(note: string): string | undefined {
  const text = note.trim();
  return text === '' ? undefined : text.slice(0, STATUS_REASON_MAX);
}

export interface OwedInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  outstanding: string;
}

/** Invoices with something left to pay, oldest due date first. Amounts stay strings. */
export function unpaidInvoices<T extends OwedInvoice>(invoices: readonly T[]): T[] {
  return invoices
    .filter((i) => Number.parseFloat(i.outstanding) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
