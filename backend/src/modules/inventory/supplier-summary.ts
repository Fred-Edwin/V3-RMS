/**
 * Pure counting rules for the supplier strips (API_CONTRACT.md §29.3). The repository fetches rows;
 * these decide what they mean, so the rules are testable without a database.
 */
import { Prisma } from '@prisma/client';

export const PROFILE_CHECK_COUNT = 7;

export type ProfileInput = {
  name: string;
  type: string | null;
  address: string | null;
  kraPin: string | null;
  contacts: { name: string; phone: string | null; isPrimary: boolean }[];
  payMethodCount: number;
};

const filled = (value: string | null | undefined): boolean => !!value && value.trim().length > 0;

/** The seven checks behind "Profile 4 of 7": name · type · phone · address · contact person · payment details · KRA PIN. */
export const profileChecks = (s: ProfileInput): boolean[] => {
  const primary = s.contacts.find((c) => c.isPrimary) ?? s.contacts[0];
  const hasPhone = filled(primary?.phone) || s.contacts.some((c) => filled(c.phone));
  return [
    filled(s.name),
    filled(s.type),
    hasPhone,
    filled(s.address) && s.address!.trim() !== '—',
    // A contact whose name was just defaulted to the supplier's own name is not a person on file.
    s.contacts.some((c) => filled(c.name) && c.name.trim().toLowerCase() !== s.name.trim().toLowerCase()),
    s.payMethodCount > 0,
    filled(s.kraPin),
  ];
};

export const profileDoneCount = (s: ProfileInput): number => profileChecks(s).filter(Boolean).length;

/** `amountBilled + Σ adjustments − Σ allocations` — the same derivation the AP screens use (plan §1.5). */
export const invoiceOutstanding = (invoice: {
  amountBilled: Prisma.Decimal;
  adjustments: { amount: Prisma.Decimal }[];
  allocations: { amount: Prisma.Decimal }[];
}): Prisma.Decimal => {
  const adjusted = invoice.adjustments.reduce((sum, a) => sum.plus(a.amount), invoice.amountBilled);
  return invoice.allocations.reduce((sum, a) => sum.minus(a.amount), adjusted);
};
