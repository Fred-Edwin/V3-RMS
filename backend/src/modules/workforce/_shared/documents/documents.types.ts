import type { DocumentKind } from './document-kinds';

export interface DocumentPerson {
  id: string | null;
  name: string;
  role: string;
}

/**
 * What an issuer hands to `registerDocument` (6c D1). Call it inside the issuing transaction, after the document is signed and numbered
 * and never for a draft. Holds no pay figure: `about` is a period or a day, `title` the kind of document.
 */
export interface RegisterDocumentInput {
  companyId: string;
  siteId: string | null;
  kind: DocumentKind;
  /** `PS-0987`, `PAY-2026-09`, `LVE-0030`. Starts with the kind and a dash. */
  number: string;
  /** 1 for the first issue. A correction registers the same number with version 2, and version 1 reads REPLACED in the same call. */
  version?: number;
  /** Defaults to the kind's label (`Payslip`). */
  title?: string;
  /** The period or day in words: `September 2026`, `Mon 19 Oct`. */
  about: string;
  subjectUserId?: string | null;
  signedBy: DocumentPerson;
  reviewedBy?: (DocumentPerson & { at: Date }) | null;
  signedAt: Date;
  /** The full sha256 hex of the file or snapshot; its first 10 characters are the QR's `h`. */
  hash: string;
  /** The app route that opens it for a reader who may (`/app/workforce/payslips/...`). */
  openHref: string;
}

export type DocumentStatus = 'CURRENT' | 'REPLACED' | 'WITHDRAWN';

/** A document an issuer already issued, as its source reports it to the reconciliation (the backfill and the nightly catch-up). */
export interface IssuedDocument {
  input: RegisterDocumentInput;
  /** Set for a document voided or withdrawn after it was issued. */
  withdrawn?: { at: Date; byRole: string };
}

/** One issuer's list of what it has issued for a company, oldest version first. Read only; the reconciliation writes through the door. */
export type DocumentSource = (companyId: string) => Promise<IssuedDocument[]>;

export interface RegisteredDocument {
  id: string;
  number: string;
  version: number;
  created: boolean;
}
