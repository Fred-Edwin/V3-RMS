/**
 * Suppliers expansion — database access only (no business rules).
 * Every query carries `organizationId`. Sub-resources (contacts, pay methods,
 * catalog rows, documents) are always addressed through `supplierId` AND
 * `organizationId`; the service verifies the supplier first.
 */
import { Prisma } from '@prisma/client';
import type {
  SupplierAuditAction,
  SupplierContactRole,
  SupplierDocumentType,
  SupplierPayMethodType,
  SupplierPaymentTerms,
  SupplierStatus,
  SupplierType,
} from '@prisma/client';
import { prisma } from '../../../config/database';
import { normalizeBuyUnit, normalizePackSize, type LineKey } from './supplier-line-key';

type TxClient = Prisma.TransactionClient;
type Client = typeof prisma | TxClient;

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

const listInclude = {
  category: { select: { id: true, name: true } },
  contacts: { where: { isPrimary: true }, take: 1 },
} satisfies Prisma.SupplierInclude;

const detailInclude = {
  category: { select: { id: true, name: true } },
  contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
  payMethods: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
} satisfies Prisma.SupplierInclude;

export type SupplierWithRelations = Prisma.SupplierGetPayload<{ include: typeof listInclude }>;
export type SupplierDetailRow = Prisma.SupplierGetPayload<{ include: typeof detailInclude }>;

export type SupplierListFilters = {
  search?: string;
  status?: SupplierStatus;
  type?: SupplierType;
  categoryId?: string;
  /** Exclude ARCHIVED unless a `status` filter says otherwise. */
  includeArchived: boolean;
  /** Only these suppliers (the "profile not finished" filter resolves to ids first). */
  ids?: string[];
  page: number;
  perPage: number;
};

export type CreateSupplierData = {
  code: string;
  name: string;
  tradingName: string | null;
  status: SupplierStatus;
  type: SupplierType;
  categoryId: string | null;
  kraPin: string | null;
  vatRegistered: boolean;
  notes: string | null;
  address: string;
  mapUrl: string | null;
  defaultPaymentTerms: SupplierPaymentTerms;
  paymentDays?: number;
  creditLimit: string | null;
  createdById: string;
};

export type UpdateSupplierData = Partial<Omit<CreateSupplierData, 'code' | 'status' | 'createdById'>> & {
  updatedById: string;
};

export const supplierRepository = {
  findAllBySite: async (
    siteId: string,
    filters: SupplierListFilters,
  ): Promise<{ suppliers: SupplierWithRelations[]; total: number }> => {
    const where: Prisma.SupplierWhereInput = {
      siteId,
      ...(filters.status ? { status: filters.status } : filters.includeArchived ? {} : { deletedAt: null }),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.ids ? { id: { in: filters.ids } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { tradingName: { contains: filters.search, mode: 'insensitive' } },
              { code: { contains: filters.search, mode: 'insensitive' } },
              { contacts: { some: { phone: { contains: filters.search } } } },
            ],
          }
        : {}),
    };
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: listInclude,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.supplier.count({ where }),
    ]);
    return { suppliers, total };
  },

  findById: async (id: string, siteId: string, client: Client = prisma): Promise<SupplierWithRelations | null> =>
    client.supplier.findFirst({ where: { id, siteId }, include: listInclude }),

  findDetailById: async (id: string, siteId: string, client: Client = prisma): Promise<SupplierDetailRow | null> =>
    client.supplier.findFirst({ where: { id, siteId }, include: detailInclude }),

  /** Non-archived suppliers with their contact phones, for the duplicate check. */
  findLiveWithPhones: async (
    siteId: string,
  ): Promise<{ id: string; code: string; name: string; contacts: { phone: string | null }[] }[]> =>
    prisma.supplier.findMany({
      where: { siteId, deletedAt: null },
      select: { id: true, code: true, name: true, contacts: { select: { phone: true } } },
    }),

  create: async (siteId: string, data: CreateSupplierData, tx: TxClient): Promise<{ id: string }> =>
    tx.supplier.create({
      data: {
        siteId,
        code: data.code,
        name: data.name,
        tradingName: data.tradingName,
        status: data.status,
        type: data.type,
        categoryId: data.categoryId,
        kraPin: data.kraPin,
        vatRegistered: data.vatRegistered,
        notes: data.notes,
        address: data.address,
        mapUrl: data.mapUrl,
        defaultPaymentTerms: data.defaultPaymentTerms,
        ...(data.paymentDays !== undefined ? { paymentDays: data.paymentDays } : {}),
        creditLimit: data.creditLimit,
        createdById: data.createdById,
        updatedById: data.createdById,
      },
      select: { id: true },
    }),

  update: async (id: string, siteId: string, data: UpdateSupplierData, tx: Client = prisma): Promise<number> => {
    const { count } = await tx.supplier.updateMany({
      where: { id, siteId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.tradingName !== undefined ? { tradingName: data.tradingName } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.kraPin !== undefined ? { kraPin: data.kraPin } : {}),
        ...(data.vatRegistered !== undefined ? { vatRegistered: data.vatRegistered } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.mapUrl !== undefined ? { mapUrl: data.mapUrl } : {}),
        ...(data.defaultPaymentTerms !== undefined ? { defaultPaymentTerms: data.defaultPaymentTerms } : {}),
        ...(data.paymentDays !== undefined ? { paymentDays: data.paymentDays } : {}),
        ...(data.creditLimit !== undefined ? { creditLimit: data.creditLimit } : {}),
        updatedById: data.updatedById,
      },
    });
    return count;
  },

  /** Keeps `deletedAt` in step with ARCHIVED, so other reads that hide deleted rows also hide archived suppliers. */
  setStatus: async (
    id: string,
    siteId: string,
    status: SupplierStatus,
    updatedById: string,
    tx: TxClient,
  ): Promise<number> => {
    const { count } = await tx.supplier.updateMany({
      where: { id, siteId },
      data: { status, deletedAt: status === 'ARCHIVED' ? new Date() : null, updatedById },
    });
    return count;
  },

  /** Invoices not yet fully paid (stored status UNPAID / PARTIALLY_PAID). */
  countOpenInvoices: async (supplierId: string, siteId: string, client: Client = prisma): Promise<number> =>
    client.supplierInvoice.count({ where: { siteId, supplierId, status: { not: 'PAID' } } }),

  /** Drops the supplier's preferred marks (both sides of the sync). */
  clearPreferred: async (supplierId: string, siteId: string, tx: TxClient): Promise<void> => {
    await tx.supplierItem.updateMany({ where: { siteId, supplierId, isPreferred: true }, data: { isPreferred: false } });
    await tx.inventoryItem.updateMany({
      where: { siteId, preferredSupplierId: supplierId },
      data: { preferredSupplierId: null },
    });
  },
};

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ContactData = {
  name: string;
  role: SupplierContactRole;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
};

export const supplierContactRepository = {
  list: (supplierId: string, siteId: string) =>
    prisma.supplierContact.findMany({
      where: { supplierId, siteId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    }),

  findById: (id: string, supplierId: string, siteId: string, client: Client = prisma) =>
    client.supplierContact.findFirst({ where: { id, supplierId, siteId } }),

  count: (supplierId: string, siteId: string, client: Client = prisma) =>
    client.supplierContact.count({ where: { supplierId, siteId } }),

  create: (siteId: string, supplierId: string, data: ContactData & { isPrimary: boolean }, tx: TxClient) =>
    tx.supplierContact.create({ data: { siteId, supplierId, ...data } }),

  update: async (
    id: string,
    supplierId: string,
    siteId: string,
    data: Partial<ContactData & { isPrimary: boolean }>,
    tx: TxClient,
  ): Promise<number> => {
    const { count } = await tx.supplierContact.updateMany({ where: { id, supplierId, siteId }, data });
    return count;
  },

  delete: async (id: string, supplierId: string, siteId: string): Promise<number> => {
    const { count } = await prisma.supplierContact.deleteMany({ where: { id, supplierId, siteId } });
    return count;
  },

  unsetPrimary: async (supplierId: string, siteId: string, tx: TxClient): Promise<void> => {
    await tx.supplierContact.updateMany({ where: { supplierId, siteId, isPrimary: true }, data: { isPrimary: false } });
  },
};

// ---------------------------------------------------------------------------
// Payment methods (Prisma model SupplierPayMethod) + audit log
// ---------------------------------------------------------------------------

export type PayMethodData = {
  type: SupplierPayMethodType;
  bankName: string | null;
  bankBranch: string | null;
  accountName: string | null;
  accountNumber: string | null;
  paybillNumber: string | null;
  accountReference: string | null;
  tillNumber: string | null;
  phone: string | null;
  registeredName: string | null;
  /** Cheque only: free-text note. */
  note: string | null;
};

export const supplierPayMethodRepository = {
  list: (supplierId: string, siteId: string) =>
    prisma.supplierPayMethod.findMany({
      where: { supplierId, siteId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    }),

  findById: (id: string, supplierId: string, siteId: string, client: Client = prisma) =>
    client.supplierPayMethod.findFirst({ where: { id, supplierId, siteId } }),

  findDefault: (supplierId: string, siteId: string, client: Client = prisma) =>
    client.supplierPayMethod.findFirst({ where: { supplierId, siteId, isDefault: true } }),

  count: (supplierId: string, siteId: string, client: Client = prisma) =>
    client.supplierPayMethod.count({ where: { supplierId, siteId } }),

  create: (
    siteId: string,
    supplierId: string,
    createdById: string,
    data: PayMethodData & { isDefault: boolean },
    tx: TxClient,
  ) => tx.supplierPayMethod.create({ data: { siteId, supplierId, createdById, ...data } }),

  update: async (
    id: string,
    supplierId: string,
    siteId: string,
    data: Partial<PayMethodData & { isDefault: boolean }>,
    tx: TxClient,
  ): Promise<number> => {
    const { count } = await tx.supplierPayMethod.updateMany({ where: { id, supplierId, siteId }, data });
    return count;
  },

  delete: async (id: string, supplierId: string, siteId: string, tx: TxClient): Promise<number> => {
    const { count } = await tx.supplierPayMethod.deleteMany({ where: { id, supplierId, siteId } });
    return count;
  },

  unsetDefault: async (supplierId: string, siteId: string, tx: TxClient): Promise<void> => {
    await tx.supplierPayMethod.updateMany({ where: { supplierId, siteId, isDefault: true }, data: { isDefault: false } });
  },

  /** Recipients for the "cheque method added" notice: every active Accountant on the hub org. */
  findHubAccountants: (siteId: string): Promise<{ id: string }[]> =>
    prisma.user.findMany({
      where: { siteId, role: 'ACCOUNTANT', isActive: true, deletedAt: null },
      select: { id: true },
    }),
};

export const supplierAuditRepository = {
  /** `before` / `after` must already be masked by the caller. */
  create: (
    siteId: string,
    supplierId: string,
    actorId: string,
    action: SupplierAuditAction,
    entityId: string | null,
    before: Prisma.InputJsonValue | null,
    after: Prisma.InputJsonValue | null,
    tx: TxClient,
  ) =>
    tx.supplierAuditLog.create({
      data: {
        siteId,
        supplierId,
        actorId,
        action,
        entityId,
        before: before ?? Prisma.JsonNull,
        after: after ?? Prisma.JsonNull,
      },
    }),

  /** The payment-method rows of the audit log, newest first (snapshots are already masked). */
  listPayMethodChanges: (supplierId: string, siteId: string, limit: number) =>
    prisma.supplierAuditLog.findMany({
      where: {
        supplierId,
        siteId,
        action: { in: ['PAY_METHOD_CREATED', 'PAY_METHOD_UPDATED', 'PAY_METHOD_DELETED', 'PAY_METHOD_DEFAULT_CHANGED'] },
      },
      include: { actor: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    }),
};

// ---------------------------------------------------------------------------
// Catalog (SupplierItem)
// ---------------------------------------------------------------------------

const supplierItemInclude = {
  inventoryItem: { select: { id: true, name: true, buyUnit: true, usageUnit: true, conversionFactor: true } },
  lastPriceSetBy: { select: { id: true, name: true } },
} satisfies Prisma.SupplierItemInclude;

export type SupplierItemRow = Prisma.SupplierItemGetPayload<{ include: typeof supplierItemInclude }>;

export type SupplierItemData = {
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string | null;
  packSize: string | null;
};

export type SupplierItemUpdate = Partial<SupplierItemData> & {
  isPreferred?: boolean;
  preferredNeedsConfirm?: boolean;
  /** A price set by hand (§30.3): the price, when, and who. */
  lastPrice?: Prisma.Decimal.Value;
  lastPriceAt?: Date;
  lastPriceSetById?: string | null;
};

/** A line plus the supplier it belongs to, for the item page and search. */
const supplierItemWithSupplierInclude = {
  supplier: { select: { id: true, code: true, name: true } },
  lastPriceSetBy: { select: { id: true, name: true } },
} satisfies Prisma.SupplierItemInclude;
export type SupplierItemWithSupplier = Prisma.SupplierItemGetPayload<{ include: typeof supplierItemWithSupplierInclude }>;

/**
 * Prisma has no compound key for the line index (it uses COALESCE), so the same equality is
 * spelled out: a missing buy unit is null or '', a missing pack size is null or 0.
 */
const lineKeyWhere = (key: LineKey): Prisma.SupplierItemWhereInput => {
  const unit = normalizeBuyUnit(key.buyUnit);
  const pack = normalizePackSize(key.packSize);
  return {
    AND: [
      unit === '' ? { OR: [{ buyUnit: null }, { buyUnit: '' }] } : { buyUnit: unit },
      pack === null ? { OR: [{ packSize: null }, { packSize: 0 }] } : { packSize: pack },
    ],
  };
};

export const supplierItemRepository = {
  list: (supplierId: string, siteId: string): Promise<SupplierItemRow[]> =>
    prisma.supplierItem.findMany({
      where: { supplierId, siteId },
      include: supplierItemInclude,
      orderBy: [{ inventoryItem: { name: 'asc' } }, { createdAt: 'asc' }],
    }),

  /** Every line for the item across suppliers (item page), with the supplier's id, code and name. */
  listForItem: (inventoryItemId: string, siteId: string): Promise<SupplierItemWithSupplier[]> =>
    prisma.supplierItem.findMany({
      where: { inventoryItemId, siteId },
      include: supplierItemWithSupplierInclude,
      orderBy: [{ isPreferred: 'desc' }, { supplier: { name: 'asc' } }, { createdAt: 'asc' }],
    }),

  /** All of one supplier's lines for one item, oldest first. */
  listBySupplierItem: (supplierId: string, inventoryItemId: string, siteId: string, client: Client = prisma) =>
    client.supplierItem.findMany({
      where: { supplierId, inventoryItemId, siteId },
      orderBy: { createdAt: 'asc' },
    }),

  /** One supplier's lines for many items (receipt pricing, document names). */
  listBySupplierItems: (supplierId: string, inventoryItemIds: string[], siteId: string, client: Client = prisma) =>
    client.supplierItem.findMany({
      where: { supplierId, inventoryItemId: { in: inventoryItemIds }, siteId },
      orderBy: { createdAt: 'asc' },
    }),

  find: (supplierId: string, inventoryItemId: string, siteId: string, client: Client = prisma) =>
    client.supplierItem.findFirst({ where: { supplierId, inventoryItemId, siteId } }),

  findById: (id: string, supplierId: string, inventoryItemId: string, siteId: string, client: Client = prisma) =>
    client.supplierItem.findFirst({ where: { id, supplierId, inventoryItemId, siteId }, include: supplierItemInclude }),

  /** The line with exactly this key, or null. */
  findByKey: (
    supplierId: string,
    inventoryItemId: string,
    siteId: string,
    key: LineKey,
    client: Client = prisma,
  ): Promise<SupplierItemRow | null> =>
    client.supplierItem.findFirst({
      where: { supplierId, inventoryItemId, siteId, ...lineKeyWhere(key) },
      include: supplierItemInclude,
    }),

  /** The oldest line for the pair — for callers that carry no pack (legacy toggles, preferred sync). */
  findLineId: async (supplierId: string, inventoryItemId: string, siteId: string, tx: TxClient): Promise<string | null> => {
    const row = await tx.supplierItem.findFirst({
      where: { supplierId, inventoryItemId, siteId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return row?.id ?? null;
  },

  createLine: (
    siteId: string,
    supplierId: string,
    inventoryItemId: string,
    data: Partial<SupplierItemData> & { lastPrice?: Prisma.Decimal.Value; lastPriceAt?: Date; lastPriceSetById?: string | null },
    tx: TxClient,
  ): Promise<SupplierItemRow> =>
    tx.supplierItem.create({ data: { siteId, supplierId, inventoryItemId, ...data }, include: supplierItemInclude }),

  updateLine: async (id: string, siteId: string, data: SupplierItemUpdate, tx: TxClient): Promise<SupplierItemRow | null> => {
    const { count } = await tx.supplierItem.updateMany({ where: { id, siteId }, data });
    if (count === 0) return null;
    return tx.supplierItem.findFirst({ where: { id, siteId }, include: supplierItemInclude });
  },

  /** Removes one line, or every line the supplier has for the item when no id is given. */
  delete: async (
    supplierId: string,
    inventoryItemId: string,
    siteId: string,
    tx: TxClient,
    lineId?: string,
  ): Promise<number> => {
    const { count } = await tx.supplierItem.deleteMany({
      where: { supplierId, inventoryItemId, siteId, ...(lineId ? { id: lineId } : {}) },
    });
    return count;
  },

  /**
   * Sets exactly one preferred line for the item (or none), on both sides of the sync. Only one
   * line per item may be preferred (partial unique index), including two lines of one supplier.
   * `lineId` picks the line; without it the supplier's oldest line is used (created when none).
   * Whatever line ends up preferred has its "needs confirm" mark cleared; lines that lose the
   * mark lose it too. Returns what changed so the caller can log it.
   */
  applyPreferred: async (
    siteId: string,
    inventoryItemId: string,
    supplierId: string | null,
    tx: TxClient,
    lineId?: string,
  ): Promise<{ lineId: string | null; wasPreferred: boolean; wasNeedsConfirm: boolean }> => {
    const existing = supplierId
      ? lineId
        ? await tx.supplierItem.findFirst({ where: { id: lineId, supplierId, inventoryItemId, siteId } })
        : await tx.supplierItem.findFirst({
            where: { supplierId, inventoryItemId, siteId },
            orderBy: { createdAt: 'asc' },
          })
      : null;

    await tx.supplierItem.updateMany({
      where: { siteId, inventoryItemId, isPreferred: true, ...(existing ? { id: { not: existing.id } } : {}) },
      data: { isPreferred: false, preferredNeedsConfirm: false },
    });

    let resultId: string | null = null;
    if (supplierId) {
      if (existing) {
        await tx.supplierItem.update({ where: { id: existing.id }, data: { isPreferred: true, preferredNeedsConfirm: false } });
        resultId = existing.id;
      } else {
        const created = await tx.supplierItem.create({
          data: { siteId, supplierId, inventoryItemId, isPreferred: true },
          select: { id: true },
        });
        resultId = created.id;
      }
    }
    await tx.inventoryItem.updateMany({
      where: { id: inventoryItemId, siteId },
      data: { preferredSupplierId: supplierId },
    });
    return {
      lineId: resultId,
      wasPreferred: existing?.isPreferred ?? false,
      wasNeedsConfirm: existing?.preferredNeedsConfirm ?? false,
    };
  },

  /** Clears a preferred mark only if it is currently this supplier's (optionally one line). */
  clearPreferredIfSupplier: async (
    siteId: string,
    inventoryItemId: string,
    supplierId: string,
    tx: TxClient,
    lineId?: string,
  ): Promise<void> => {
    const { count } = await tx.supplierItem.updateMany({
      where: { siteId, inventoryItemId, supplierId, isPreferred: true, ...(lineId ? { id: lineId } : {}) },
      data: { isPreferred: false, preferredNeedsConfirm: false },
    });
    if (count === 0) return;
    await tx.inventoryItem.updateMany({
      where: { id: inventoryItemId, siteId, preferredSupplierId: supplierId },
      data: { preferredSupplierId: null },
    });
  },

  /** The supplier's lines (with prices) for the receiving price alert. */
  findLinesWithPrices: (siteId: string, supplierId: string, itemIds: string[]) =>
    prisma.supplierItem.findMany({
      where: { siteId, supplierId, inventoryItemId: { in: itemIds } },
      orderBy: { createdAt: 'asc' },
    }),

  /** Called from the receipt-sign transaction: the price wins outright (latest-price, no averaging). */
  setLinePrice: async (
    id: string,
    siteId: string,
    price: Prisma.Decimal.Value,
    at: Date,
    tx: TxClient,
  ): Promise<void> => {
    // A signed receipt's price wins outright and is no longer "set by" anyone (§30.3).
    await tx.supplierItem.updateMany({ where: { id, siteId }, data: { lastPrice: price, lastPriceAt: at, lastPriceSetById: null } });
  },
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const documentInclude = { uploadedBy: { select: { id: true, name: true } } } satisfies Prisma.SupplierDocumentInclude;
export type SupplierDocumentRow = Prisma.SupplierDocumentGetPayload<{ include: typeof documentInclude }>;

export type CreateDocumentData = {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType: SupplierDocumentType;
  docDate: Date | null;
  note: string | null;
  goodsReceiptId: string | null;
  supplierInvoiceId: string | null;
  uploadedById: string;
};

export const supplierDocumentRepository = {
  list: (supplierId: string, siteId: string, limit: number): Promise<SupplierDocumentRow[]> =>
    prisma.supplierDocument.findMany({
      where: { supplierId, siteId },
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),

  findById: (id: string, supplierId: string, siteId: string): Promise<SupplierDocumentRow | null> =>
    prisma.supplierDocument.findFirst({ where: { id, supplierId, siteId }, include: documentInclude }),

  create: (siteId: string, supplierId: string, data: CreateDocumentData): Promise<SupplierDocumentRow> =>
    prisma.supplierDocument.create({ data: { siteId, supplierId, ...data }, include: documentInclude }),

  delete: async (id: string, supplierId: string, siteId: string): Promise<number> => {
    const { count } = await prisma.supplierDocument.deleteMany({ where: { id, supplierId, siteId } });
    return count;
  },

  receiptBelongs: async (goodsReceiptId: string, supplierId: string, siteId: string): Promise<boolean> =>
    (await prisma.goodsReceipt.count({ where: { id: goodsReceiptId, supplierId, siteId } })) > 0,

  invoiceBelongs: async (supplierInvoiceId: string, supplierId: string, siteId: string): Promise<boolean> =>
    (await prisma.supplierInvoice.count({ where: { id: supplierInvoiceId, supplierId, siteId } })) > 0,
};

// ---------------------------------------------------------------------------
// Timeline + summary reads
// ---------------------------------------------------------------------------

export const supplierHistoryRepository = {
  signedReceipts: (supplierId: string, siteId: string, limit?: number) =>
    prisma.goodsReceipt.findMany({
      where: { supplierId, siteId, signedAt: { not: null }, status: { not: 'CANCELLED' } },
      orderBy: { signedAt: 'desc' },
      ...(limit ? { take: limit } : {}),
      select: { id: true, reference: true, signedAt: true, receiptTotal: true, signedBy: { select: { id: true, name: true } } },
    }),

  invoices: (supplierId: string, siteId: string, limit: number) =>
    prisma.supplierInvoice.findMany({
      where: { supplierId, siteId },
      orderBy: { invoiceDate: 'desc' },
      take: limit,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        amountBilled: true,
        disputeStatus: true,
        disputeReason: true,
        updatedAt: true,
        recordedBy: { select: { id: true, name: true } },
      },
    }),

  payments: (supplierId: string, siteId: string, limit: number) =>
    prisma.supplierPayment.findMany({
      where: { supplierId, siteId },
      orderBy: { paidAt: 'desc' },
      take: limit,
      select: { id: true, paidAt: true, amount: true, method: true, reference: true, reversalOfId: true, recordedBy: { select: { id: true, name: true } } },
    }),

  /** Everything the summary aggregates, in three bounded reads. */
  summaryReceipts: (supplierId: string, siteId: string) =>
    prisma.goodsReceipt.findMany({
      where: { supplierId, siteId, signedAt: { not: null }, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        signedAt: true,
        receiptTotal: true,
        lines: { select: { inventoryItemId: true, quantityBuyUnit: true, priceAlertPct: true } },
        expectedDelivery: { select: { lines: { select: { inventoryItemId: true, quantity: true } } } },
      },
    }),

  summaryInvoices: (supplierId: string, siteId: string) =>
    prisma.supplierInvoice.findMany({
      where: { supplierId, siteId },
      select: {
        invoiceDate: true,
        amountBilled: true,
        adjustments: { select: { amount: true } },
        allocations: { select: { amount: true, supplierPayment: { select: { paidAt: true, reversalOfId: true } } } },
      },
    }),
};

export const supplierItemLookupRepository = {
  /** A live catalog item in this org, for the supplier catalog PUT. */
  findLiveItem: (inventoryItemId: string, siteId: string) =>
    prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, siteId, deletedAt: null },
      select: { id: true, name: true, buyUnit: true, usageUnit: true },
    }),
};

// ---------------------------------------------------------------------------
// Summary strips (B11, API_CONTRACT.md §29.3)
// ---------------------------------------------------------------------------

const stripSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  address: true,
  kraPin: true,
  contacts: { select: { name: true, phone: true, isPrimary: true } },
  _count: { select: { payMethods: true } },
  supplierInvoices: {
    select: {
      amountBilled: true,
      adjustments: { select: { amount: true } },
      allocations: { select: { amount: true } },
    },
  },
} satisfies Prisma.SupplierSelect;

export const supplierStripRepository = {
  /** Every non-archived supplier with just what the profile checks and the owed figure need. */
  listForStrip: (siteId: string) =>
    prisma.supplier.findMany({
      where: { siteId, deletedAt: null, status: { not: 'ARCHIVED' } },
      select: stripSelect,
    }),

  /** The same data for exactly these suppliers, whatever their status (the list rows' profile and owed figures). */
  listForStripByIds: (siteId: string, ids: string[]) =>
    prisma.supplier.findMany({ where: { siteId, id: { in: ids } }, select: stripSelect }),

  /** The supplier Catalog tab's four numbers: lines, receipts since `since`, and the latest signed receipt. */
  catalogStrip: async (supplierId: string, siteId: string, since: Date) => {
    const signed = { supplierId, siteId, signedAt: { not: null }, status: { not: 'CANCELLED' as const } };
    const [itemGroups, recent, latest] = await Promise.all([
      prisma.supplierItem.groupBy({ by: ['inventoryItemId'], where: { supplierId, siteId } }),
      prisma.goodsReceipt.findMany({
        where: { ...signed, signedAt: { gte: since } },
        select: { receiptTotal: true, lines: { select: { priceAlertPct: true } } },
      }),
      prisma.goodsReceipt.findFirst({ where: signed, orderBy: { signedAt: 'desc' }, select: { signedAt: true } }),
    ]);
    return { itemsTheySell: itemGroups.length, recent, lastReceiptAt: latest?.signedAt ?? null };
  },
};
