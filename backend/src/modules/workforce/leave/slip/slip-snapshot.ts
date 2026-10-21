import { createHash } from 'node:crypto';
import { stableStringify } from '../../timesheets/approval/snapshot';
import { hashPrefixOf } from '../../_shared/documents/qr-hash';
import { addDays, type NairobiDate } from '../../_shared/time/nairobi-time';

export const SLIP_TEMPLATE_VERSION = 1;

export const slipCode = (number: number): string => `LVE-${String(number).padStart(4, '0')}`;

/** The frozen record of an approval (spec section 7). The PDF is drawn from this alone, so a re-render has the same bytes. */
export interface SlipSnapshot {
  templateVersion: number;
  number: number;
  person: { name: string; roleLabel: string; department: string | null; site: string };
  type: { code: string; label: string; paid: boolean };
  start: NairobiDate;
  end: NairobiDate;
  returnOn: NairobiDate;
  days: number;
  /** The unpaid tail: the last days of the range (L12). */
  unpaidTailDays: number;
  sickNoteNeeded: boolean;
  askedAt: string;
  approvedAt: string;
  approver: { name: string; roleLabel: string; role: string };
  /** Days left before and after, for limited types; null for a type without a balance. */
  balanceBefore: number | null;
  balanceAfter: number | null;
  head: { name: string; roleLabel: string } | null;
  signature: { method: 'PIN'; signedAt: string };
}

export interface SlipInput {
  number: number;
  person: SlipSnapshot['person'];
  type: SlipSnapshot['type'];
  start: NairobiDate;
  end: NairobiDate;
  days: number;
  unpaidTailDays: number;
  sickNoteNeeded: boolean;
  askedAt: Date;
  approvedAt: Date;
  approver: SlipSnapshot['approver'];
  balanceBefore: number | null;
  balanceAfter: number | null;
  head: SlipSnapshot['head'];
}

export function buildSlipSnapshot(input: SlipInput): SlipSnapshot {
  return {
    templateVersion: SLIP_TEMPLATE_VERSION,
    number: input.number,
    person: input.person,
    type: input.type,
    start: input.start,
    end: input.end,
    returnOn: addDays(input.end, 1),
    days: input.days,
    unpaidTailDays: input.unpaidTailDays,
    sickNoteNeeded: input.sickNoteNeeded,
    askedAt: input.askedAt.toISOString(),
    approvedAt: input.approvedAt.toISOString(),
    approver: input.approver,
    balanceBefore: input.balanceBefore,
    balanceAfter: input.balanceAfter,
    head: input.head,
    signature: { method: 'PIN', signedAt: input.approvedAt.toISOString() },
  };
}

/** Keys sorted at every level, so the same snapshot always hashes the same. */
export const hashSlip = (snapshot: SlipSnapshot): string => createHash('sha256').update(stableStringify(snapshot)).digest('hex');

/** The first 10 characters of the hash, as the QR carries them and the Signed documents index stores them. */
export const hashPrefix = (hash: string | null): string => hashPrefixOf(hash ?? '');
