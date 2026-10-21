import type { IssuedDocument, RegisterDocumentInput } from '../../_shared/documents/documents.types';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { dayLabel } from '../../notifications';
import { roleWord } from '../leave-words';
import { slipsRepository } from '../data/slips-repository';
import { slipCode } from './slip-snapshot';

/** The day or the range in words. No day count, balance, type or reason: the index and the public page never carry them. */
export const slipAbout = (start: NairobiDate, end: NairobiDate): string => (start === end ? dayLabel(start) : `${dayLabel(start)} to ${dayLabel(end)}`);

export interface SlipDocumentFacts {
  companyId: string;
  siteId: string;
  applicationId: string;
  slipNumber: number;
  slipHash: string;
  start: NairobiDate;
  end: NairobiDate;
  employeeUserId: string | null;
  signer: { id: string | null; name: string; role: string };
  signedAt: Date;
}

/** What `registerDocument` gets for a leave slip: the same call from the approve transaction and from the reconcile source. */
export const slipDocumentInput = (facts: SlipDocumentFacts): RegisterDocumentInput => ({
  companyId: facts.companyId,
  siteId: facts.siteId,
  kind: 'LVE',
  number: slipCode(facts.slipNumber),
  title: 'Leave slip',
  about: slipAbout(facts.start, facts.end),
  subjectUserId: facts.employeeUserId,
  signedBy: { id: facts.signer.id, name: facts.signer.name, role: roleWord(facts.signer.role) },
  signedAt: facts.signedAt,
  hash: facts.slipHash,
  openHref: `/workforce/leave/${facts.applicationId}/slip`,
});

const UNKNOWN = { name: 'Unknown', role: 'Staff' };

/** LVE source for the reconciliation: every approved or cancelled slip with a number and a hash. A cancelled one is listed withdrawn. */
export async function issuedLeaveSlips(companyId: string): Promise<IssuedDocument[]> {
  const slips = await slipsRepository.issued(companyId);
  const people = await slipsRepository.people(slips.flatMap((s) => [s.decidedBy, s.cancelledBy].filter((id): id is string => id !== null)));
  return slips.flatMap((s): IssuedDocument[] => {
    if (s.slipNumber === null || s.slipHash === null || s.decidedAt === null) return [];
    const signer = (s.decidedBy ? people.get(s.decidedBy) : undefined) ?? UNKNOWN;
    const canceller = (s.cancelledBy ? people.get(s.cancelledBy) : undefined) ?? UNKNOWN;
    return [
      {
        input: slipDocumentInput({
          companyId, siteId: s.siteId, applicationId: s.id, slipNumber: s.slipNumber, slipHash: s.slipHash, start: s.start, end: s.end,
          employeeUserId: s.employeeUserId, signer: { id: s.decidedBy, name: signer.name, role: s.deciderRole ?? signer.role }, signedAt: s.decidedAt,
        }),
        ...(s.status === 'CANCELLED' && s.cancelledAt ? { withdrawn: { at: s.cancelledAt, byRole: roleWord(canceller.role) } } : {}),
      },
    ];
  });
}
