/** What `GET /api/v1/verify/:kind/:number?h=` may carry (15 named keys, pinned by a back-end test): role and date only. */

export type VerifyOutcome = 'GENUINE' | 'REPLACED' | 'WITHDRAWN' | 'ARCHIVED' | 'NOT_VERIFIED' | 'MALFORMED' | 'RATE_LIMITED';

export interface VerifyAnswer {
  outcome: VerifyOutcome;
  kind?: string;
  number?: string;
  documentLabel?: string;
  version?: number;
  periodLabel?: string;
  signedByRole?: string;
  signedOn?: string;
  replacedByNumber?: string;
  replacedByVersion?: number;
  replacedOn?: string;
  withdrawnOn?: string;
  withdrawnByRole?: string;
  checkedAt: string;
  employerName: string;
}

/** The signed-in answer adds the signer, the Open button and who may read the type. */
export interface SignedInAnswer extends VerifyAnswer {
  signedBy: { name: string; role: string } | null;
  canOpen: boolean;
  openHref: string | null;
  readableBy: string[];
}

export type Tone = 'success' | 'warning' | 'error' | 'neutral';

/** What the page draws: the kicker, title, text, rows, and which button (if any). */
export interface VerifyView {
  tone: Tone;
  kicker: string;
  title: string;
  text: string;
  rows: { label: string; value: string }[];
  /** `signin` for a signed-out person, `open` for one who may read it, `report` for a copy that does not match, `home` when they may not read it. */
  action: 'signin' | 'open' | 'report' | 'home' | null;
}
