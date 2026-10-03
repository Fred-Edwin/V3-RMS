import { Prisma, type InventoryItemChangeKind } from '@prisma/client';
import { prisma } from '../../../config/database';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

const changeInclude = { changedBy: { select: { id: true, name: true } } } satisfies Prisma.InventoryItemChangeInclude;
export type ItemChangeRow = Prisma.InventoryItemChangeGetPayload<{ include: typeof changeInclude }>;

export interface RecordItemChange {
  organizationId: string;
  inventoryItemId: string;
  kind: InventoryItemChangeKind;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string | null;
  changedById: string;
}

const toJson = (value: Record<string, unknown> | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

/** Append-only item history (API_CONTRACT.md §30.4). Written in the same transaction as the change it records. */
export const itemChangeRepository = {
  record: (client: Client, data: RecordItemChange): Promise<{ id: string }> =>
    client.inventoryItemChange.create({
      data: {
        organizationId: data.organizationId,
        inventoryItemId: data.inventoryItemId,
        kind: data.kind,
        summary: data.summary,
        before: toJson(data.before),
        after: toJson(data.after),
        reason: data.reason ?? null,
        changedById: data.changedById,
      },
      select: { id: true },
    }),

  /** Newest first. */
  list: (inventoryItemId: string, organizationId: string, limit: number): Promise<ItemChangeRow[]> =>
    prisma.inventoryItemChange.findMany({
      where: { inventoryItemId, organizationId },
      include: changeInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),

  /** Live items created since `since` whose creator was a Store Attendant ("1 added by an attendant"). */
  countAttendantCreatedSince: (organizationId: string, since: Date): Promise<number> =>
    prisma.inventoryItemChange.count({
      where: {
        organizationId,
        kind: 'CREATED',
        changedBy: { role: 'STORE_ATTENDANT' },
        inventoryItem: { deletedAt: null, createdAt: { gte: since } },
      },
    }),
};
