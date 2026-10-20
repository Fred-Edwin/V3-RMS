import { env } from '../../../config/env';
import { AUDIT_RETENTION_YEARS } from '../_shared/audit/audit.types';
import { KIND_INFO, type DocumentKind } from '../_shared/documents/document-kinds';
import type { DocumentRow } from '../_shared/documents/documents-repository';

export type ViewStatus = 'CURRENT' | 'REPLACED' | 'WITHDRAWN' | 'ARCHIVED';

/** After 7 years from signing a document reads ARCHIVED; nothing is deleted (SD5). Withdrawn and replaced stay as they are until then. */
export function statusOf(row: Pick<DocumentRow, 'status' | 'signedAt'>, now: Date): ViewStatus {
  const edge = new Date(now.getTime() - Math.round(AUDIT_RETENTION_YEARS * 365.25) * 86_400_000);
  return row.signedAt < edge ? 'ARCHIVED' : (row.status as 'CURRENT' | 'REPLACED' | 'WITHDRAWN');
}

export const verifyUrlOf = (row: Pick<DocumentRow, 'kind' | 'number' | 'hashPrefix'>): string =>
  `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/${KIND_INFO[row.kind as DocumentKind].slug}/${row.number}?h=${row.hashPrefix}`;

export interface DocumentItem {
  number: string;
  version: number;
  kind: string;
  title: string;
  about: string;
  siteName: string | null;
  signedBy: { name: string; role: string };
  signedAt: string;
  status: ViewStatus;
  /** "Version 2 replaces version 1" on the newer row. */
  replacesVersion: number | null;
}

export function toItem(row: DocumentRow, siteNames: ReadonlyMap<string, string>, now: Date): DocumentItem {
  return {
    number: row.number,
    version: row.version,
    kind: row.kind,
    title: row.title,
    about: row.about,
    siteName: row.siteId ? (siteNames.get(row.siteId) ?? null) : null,
    signedBy: { name: row.signedByName, role: row.signedByRole },
    signedAt: row.signedAt.toISOString(),
    status: statusOf(row, now),
    replacesVersion: row.version > 1 ? row.version - 1 : null,
  };
}

export interface DocumentPanel extends DocumentItem {
  approvedBy: { name: string; role: string; at: string };
  reviewedBy: { name: string; role: string; at: string } | null;
  method: 'PIN';
  replacedBy: { number: string; version: number; on: string } | null;
  withdrawn: { on: string; byRole: string; replacedByNumber: string | null } | null;
  forPerson: { name: string; role: string } | null;
  verifyUrl: string;
  /** Null once archived: the panel then says "Archived. Ask support for a copy." */
  openHref: string | null;
}

export function toPanel(row: DocumentRow, siteNames: ReadonlyMap<string, string>, forPerson: { name: string; role: string } | null, now: Date): DocumentPanel {
  const item = toItem(row, siteNames, now);
  return {
    ...item,
    approvedBy: { name: row.signedByName, role: row.signedByRole, at: row.signedAt.toISOString() },
    reviewedBy: row.reviewedByName && row.reviewedAt ? { name: row.reviewedByName, role: row.reviewedByRole ?? '', at: row.reviewedAt.toISOString() } : null,
    method: 'PIN',
    replacedBy: row.replacedByVersion && row.replacedAt ? { number: row.number, version: row.replacedByVersion, on: row.replacedAt.toISOString() } : null,
    withdrawn: row.withdrawnAt ? { on: row.withdrawnAt.toISOString(), byRole: row.withdrawnByRole ?? '', replacedByNumber: row.replacedByNumber } : null,
    forPerson,
    verifyUrl: verifyUrlOf(row),
    openHref: item.status === 'ARCHIVED' ? null : row.openHref,
  };
}
