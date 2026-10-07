import type { Prisma, PurchasingAuditArea } from '@prisma/client';

/** "10,000.00": for the sentences people read in the Activity tab and the Audit log. Wire amounts keep no separators. */
export const kes = (value: Prisma.Decimal.Value): string =>
  Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface AuditInput {
  siteId: string;
  orderId: string;
  supplierId: string;
  actorId: string;
  area?: PurchasingAuditArea;
  /** "Approved order", "Recorded payment": the Action column. */
  action: string;
  /** LPO-0044, INV-05188, PAY-0031. */
  document: string | null;
  /** The "What changed" column. */
  detail: string;
  /** The sentence after the person's name in the Activity tab. */
  what: string;
}

/** Written in the same transaction as the change it records, so a change without its audit row cannot exist. */
export const purchasingAudit = {
  record: async (tx: Prisma.TransactionClient, entry: AuditInput, at: Date = new Date()): Promise<void> => {
    await tx.purchasingAuditEntry.create({
      data: {
        siteId: entry.siteId,
        orderId: entry.orderId,
        supplierId: entry.supplierId,
        actorId: entry.actorId,
        area: entry.area ?? 'PURCHASING',
        action: entry.action,
        document: entry.document,
        detail: entry.detail,
        what: entry.what,
        at,
      },
    });
  },
};
