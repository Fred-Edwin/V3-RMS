import { Prisma, type InventoryTransaction, type InventoryTransactionType, type LocationType } from '@prisma/client';
import type { LedgerLink } from './ledger-rules';

type TxClient = Prisma.TransactionClient;

export type LedgerLocationOwner = { id: string; siteId: string; type: LocationType; siteIsHub: boolean };

export type LedgerInsert = {
  siteId: string;
  locationId: string;
  inventoryItemId: string;
  type: InventoryTransactionType;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  reason: string | null;
  reference: string | null;
  reversesTransactionId: string | null;
  userId: string;
  links: Partial<Record<LedgerLink, string>>;
};

/**
 * The only file in the codebase (outside the seed scripts and the guard's allow-list) that writes
 * `inventory_transactions`. Every function takes the caller's transaction client: the door never
 * opens a transaction of its own. There is deliberately no update or delete here (append-only).
 */
export const ledgerRepository = {
  findLocationOwner: async (tx: TxClient, locationId: string): Promise<LedgerLocationOwner | null> => {
    const row = await tx.location.findUnique({
      where: { id: locationId },
      select: { id: true, siteId: true, type: true, site: { select: { isHub: true } } },
    });
    return row ? { id: row.id, siteId: row.siteId, type: row.type, siteIsHub: row.site.isHub } : null;
  },

  /**
   * The site(s) that own the document a link points at: one for most documents, two for a dispatch
   * line (it is the hub's document, and the receiving branch's too). `null` when the row is missing.
   */
  findLinkOwnerSites: async (tx: TxClient, link: LedgerLink, id: string): Promise<string[] | null> => {
    switch (link) {
      case 'goodsReceiptLineId': {
        const row = await tx.goodsReceiptLine.findUnique({ where: { id }, select: { goodsReceipt: { select: { siteId: true } } } });
        return row ? [row.goodsReceipt.siteId] : null;
      }
      case 'purchaseDeliveryLineId': {
        const row = await tx.purchaseDeliveryLine.findUnique({ where: { id }, select: { delivery: { select: { siteId: true } } } });
        return row ? [row.delivery.siteId] : null;
      }
      case 'prepRecordId': {
        const row = await tx.prepRun.findUnique({ where: { id }, select: { siteId: true } });
        return row ? [row.siteId] : null;
      }
      case 'wasteLogId': {
        const row = await tx.wasteLog.findUnique({ where: { id }, select: { siteId: true } });
        return row ? [row.siteId] : null;
      }
      case 'stockCountLineId': {
        const row = await tx.stockCountLine.findUnique({ where: { id }, select: { stockCount: { select: { siteId: true } } } });
        return row ? [row.stockCount.siteId] : null;
      }
      case 'branchDayLineId': {
        const row = await tx.branchDayLine.findUnique({
          where: { id },
          select: { department: { select: { location: { select: { siteId: true } } } } },
        });
        return row ? [row.department.location.siteId] : null;
      }
      case 'openingLineId': {
        const row = await tx.departmentOpeningLine.findUnique({
          where: { id },
          select: { opening: { select: { location: { select: { siteId: true } } } } },
        });
        return row ? [row.opening.location.siteId] : null;
      }
      case 'dispatchLineId': {
        const row = await tx.dispatchLine.findUnique({ where: { id }, select: { dispatch: { select: { siteId: true, toSiteId: true } } } });
        return row ? [row.dispatch.siteId, row.dispatch.toSiteId] : null;
      }
      case 'marketPurchaseLineId':
        // No model behind this column yet (see stock.prisma); nothing can legitimately point at it.
        return null;
    }
  },

  /** The row a correction would reverse, and whether a correction already exists for it. */
  findForReversal: async (
    tx: TxClient,
    id: string,
  ): Promise<(Pick<InventoryTransaction, 'id' | 'siteId' | 'locationId' | 'inventoryItemId' | 'type' | 'quantity'> & { alreadyReversed: boolean }) | null> => {
    const row = await tx.inventoryTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        locationId: true,
        inventoryItemId: true,
        type: true,
        quantity: true,
        reversedBy: { select: { id: true } },
      },
    });
    if (!row) return null;
    const { reversedBy, ...rest } = row;
    return { ...rest, alreadyReversed: reversedBy !== null };
  },

  create: async (tx: TxClient, input: LedgerInsert): Promise<InventoryTransaction> =>
    tx.inventoryTransaction.create({
      data: {
        siteId: input.siteId,
        locationId: input.locationId,
        inventoryItemId: input.inventoryItemId,
        type: input.type,
        quantity: input.quantity,
        unitCost: input.unitCost,
        reason: input.reason,
        reference: input.reference,
        reversesTransactionId: input.reversesTransactionId,
        userId: input.userId,
        ...input.links,
      },
    }),
};
