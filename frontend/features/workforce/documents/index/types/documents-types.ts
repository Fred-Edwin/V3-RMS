/** The answers of `GET /workforce/documents*` (API_CONTRACT §46). */

export type DocumentStatus = 'CURRENT' | 'REPLACED' | 'WITHDRAWN' | 'ARCHIVED';

export interface DocumentItem {
  number: string;
  version: number;
  kind: string;
  title: string;
  about: string;
  /** The API still says "organization" for a site (wire names). */
  organizationName: string | null;
  signedBy: { name: string; role: string };
  signedAt: string;
  status: DocumentStatus;
  replacesVersion: number | null;
}

export interface DocumentsPage {
  items: DocumentItem[];
  total: number;
  totalIsExact: boolean;
  page: number;
  pageSize: number;
  types: { code: string; label: string }[];
  /** Empty for a reader limited to one site: no Site filter then. */
  organizations: { id: string; name: string }[];
}

export interface DocumentPanelData extends DocumentItem {
  approvedBy: { name: string; role: string; at: string };
  reviewedBy: { name: string; role: string; at: string } | null;
  method: 'PIN';
  replacedBy: { number: string; version: number; on: string } | null;
  withdrawn: { on: string; byRole: string; replacedByNumber: string | null } | null;
  forPerson: { name: string; role: string } | null;
  verifyUrl: string;
  /** Null once archived. */
  openHref: string | null;
}

export interface DocumentsQuery {
  q: string;
  type: string;
  siteId: string;
  from: string;
  to: string;
  sort: 'newest' | 'oldest';
  page: number;
  pageSize: 25 | 50 | 100;
}
