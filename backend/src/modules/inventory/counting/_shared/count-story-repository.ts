import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { DeliveryFact, DispatchFact, PrepFact } from './count-story';

type Client = typeof prisma | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

export type StoryWindow = { siteId: string; locationId: string; itemId: string; from: Date; to: Date };

/** The ledger and document facts behind "what the records show" for one item between two instants (`count-story.ts` judges them). */
export const countStoryRepository = {
  /** Dispatches that took the item out of the Central Store in the window, one fact per ledger row. */
  dispatches: async (w: StoryWindow, client: Client = prisma): Promise<DispatchFact[]> => {
    const rows = await client.inventoryTransaction.findMany({
      where: { siteId: w.siteId, locationId: w.locationId, inventoryItemId: w.itemId, type: 'DISPATCH_OUT', createdAt: { gt: w.from, lte: w.to } },
      orderBy: { createdAt: 'asc' },
      select: {
        quantity: true,
        createdAt: true,
        dispatchLine: { select: { dispatch: { select: { reference: true, countedAt: true, toSite: { select: { name: true } } } } } },
      },
    });
    // Block 2: the label is the DSP- reference (a dispatch that left the store always has one: it is numbered at the final sign).
    return rows.flatMap((row) =>
      row.dispatchLine?.dispatch.reference
        ? [{ label: row.dispatchLine.dispatch.reference, toSiteName: row.dispatchLine.dispatch.toSite.name, quantity: row.quantity, confirmed: row.dispatchLine.dispatch.countedAt !== null, at: row.createdAt }]
        : [],
    );
  },

  /** Prep runs that used the item in the window (the reversing rows are not use). */
  prepRuns: async (w: StoryWindow, client: Client = prisma): Promise<PrepFact[]> => {
    const rows = await client.inventoryTransaction.findMany({
      where: {
        siteId: w.siteId,
        locationId: w.locationId,
        inventoryItemId: w.itemId,
        type: 'PREP_CONSUME',
        reversesTransactionId: null,
        quantity: { lt: 0 },
        createdAt: { gt: w.from, lte: w.to },
      },
      orderBy: { createdAt: 'asc' },
      select: { quantity: true, createdAt: true, prepRun: { select: { reference: true } } },
    });
    return rows.flatMap((row) => (row.prepRun?.reference ? [{ reference: row.prepRun.reference, quantity: row.quantity, at: row.createdAt }] : []));
  },

  /** Deliveries that brought the item in during the window (goods receipts). */
  deliveries: async (w: StoryWindow, client: Client = prisma): Promise<DeliveryFact[]> => {
    const rows = await client.inventoryTransaction.findMany({
      where: { siteId: w.siteId, locationId: w.locationId, inventoryItemId: w.itemId, type: 'RECEIVE', quantity: { gt: 0 }, createdAt: { gt: w.from, lte: w.to } },
      orderBy: { createdAt: 'asc' },
      select: { quantity: true, createdAt: true, purchaseDeliveryLine: { select: { delivery: { select: { reference: true } } } } },
    });
    return rows.flatMap((row) =>
      row.purchaseDeliveryLine ? [{ reference: row.purchaseDeliveryLine.delivery.reference, quantity: row.quantity, at: row.createdAt }] : [],
    );
  },

  /** True when the item is an input of the CURRENT version of a usual prep recipe. */
  isPrepRecipeInput: async (siteId: string, itemId: string, client: Client = prisma): Promise<boolean> => {
    const rows = await client.$queryRaw<{ found: number }[]>(Prisma.sql`
      SELECT 1 AS found
      FROM prep_recipe_lines l
      JOIN prep_recipe_versions v ON v.id = l.version_id
      JOIN prep_recipes r ON r.id = v.recipe_id AND r.current_version = v.version
      WHERE l.input_item_id = ${itemId} AND r.organization_id = ${siteId}
      LIMIT 1`);
    return rows.length > 0;
  },

  /** True when any prep run consumed the item in the 7 days before `to`. */
  usedInPrepLastWeek: async (w: Omit<StoryWindow, 'from'>, client: Client = prisma): Promise<boolean> => {
    const found = await client.inventoryTransaction.findFirst({
      where: {
        siteId: w.siteId,
        locationId: w.locationId,
        inventoryItemId: w.itemId,
        type: 'PREP_CONSUME',
        reversesTransactionId: null,
        quantity: { lt: 0 },
        createdAt: { gt: new Date(w.to.getTime() - 7 * DAY_MS), lte: w.to },
      },
      select: { id: true },
    });
    return found !== null;
  },
};
