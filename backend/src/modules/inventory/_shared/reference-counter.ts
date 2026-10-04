import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Reference numbers (ADJ-0007, DSC-0003, ...) — gap-free per (site, prefix),
// incremented inside the same transaction as the document it numbers
// (plan §1.7). Shared by every sub-module that numbers a document, and by the
// stock ledger door; it lived in purchasing/receiving-repository.ts until the
// Purchasing code was cleared for its rebuild (4 Oct 2026).
// ---------------------------------------------------------------------------

export const referenceCounterRepository = {
  /** Must run inside the same `$transaction` as the create it numbers. */
  nextReference: async (tx: TxClient, siteId: string, prefix: string, pad = 4): Promise<string> => {
    const counter = await tx.referenceCounter.upsert({
      where: { siteId_prefix: { siteId, prefix } },
      update: { lastNumber: { increment: 1 } },
      create: { siteId, prefix, lastNumber: 1 },
      select: { lastNumber: true },
    });
    return `${prefix}-${String(counter.lastNumber).padStart(pad, '0')}`;
  },
};
