/**
 * Suppliers expansion — business rules. Plan: docs/features/inventory/suppliers-plan.md.
 *
 * Scoping: every supplier lives on the hub org (D-15); each entry point
 * resolves the org through `requireHubActor`. Role-dependent field stripping
 * happens here, never in the controller.
 */
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { authRepository } from '../../../repositories/auth-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { logger } from '../../../utils/logger';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../utils/errors';
import { mapPrismaError } from '../../../utils/prisma-errors';
import { socketService } from '../../../sockets/socket-service';
import { fcmService } from '../../../services/fcm-service';
import { goodsReceiptRepository } from '../purchasing/receiving-repository';
import { referenceCounterRepository } from '../_shared/reference-counter';
import { describePriceSet, describeSupplierAdded } from '../catalog/item-history';
import { itemChangeRepository } from '../catalog/item-history-repository';
import { describePack, matchSupplierLine, sameLineKey } from './supplier-line-key';
import {
  supplierAuditRepository,
  supplierContactRepository,
  supplierDocumentRepository,
  supplierHistoryRepository,
  supplierStripRepository,
  supplierItemLookupRepository,
  supplierItemRepository,
  supplierPayMethodRepository,
  supplierRepository,
  type PayMethodData,
} from './supplier-repository';
import {
  auditSnapshot,
  serializeAttendantSupplier,
  serializeContact,
  serializeDocument,
  serializeItemSupplierLine,
  serializePayMethod,
  serializePayMethodDetail,
  serializeSupplierBase,
  serializeSupplierDetail,
  serializeSupplierItem,
} from './supplier-serializers';
import { findLastReceipt, findPriceAlert } from './supplier-catalog-extras';
import { describePayMethodChange } from './supplier-pay-history';
import { getDocumentStorage } from './supplier-storage';
import { PROFILE_CHECK_COUNT, profileDoneCount, supplierOwed } from './supplier-summary';
import {
  MAX_SUPPLIER_DOCUMENT_BYTES,
  SIGNED_URL_TTL_SECONDS,
  detectFileType,
  sanitizeFileName,
} from './supplier-files';
import { PayMethodFieldsSchema } from './supplier-validators';
import type {
  CreateContactInput,
  CreatePayMethodInput,
  CreateSupplierItemInput,
  CreateSupplierInput,
  ListSuppliersQuery,
  PutSupplierItemInput,
  QuickAddSupplierInput,
  UpdateContactInput,
  UpdatePayMethodInput,
  UpdateSupplierInput,
  UpdateSupplierStatusInput,
  UploadSupplierDocumentInput,
  UploadedFile,
} from './supplier.types';
import type { SupplierItemRow } from './supplier-repository';
import type { Paginated } from '../catalog/inventory.types';

import { actorCan, requireHubActor, requireHubReader } from '../_shared/central-store-access';

type Actor = NonNullable<Request['user']>;

const canSeePaymentDetails = (actor: Actor): boolean => actorCan(actor, 'suppliers.read_payment_details');

/**
 * Allow-list backstop behind the route's capability guard: everything beyond the
 * attendant's stripped list and quick-add needs the right to read suppliers.
 */
const requireReadAccess = (actor: Actor): void => {
  if (!actorCan(actor, 'suppliers.read')) throw new ForbiddenError('You cannot access this supplier data');
};
/** The right to change a supplier's profile, contacts, catalog lines or status. */
const requireWriteAccess = (actor: Actor): void => {
  if (!actorCan(actor, 'suppliers.write')) throw new ForbiddenError('You cannot change supplier data');
};

/** The single gate for sub-resources: the supplier must exist in the caller's org. */
const requireSupplier = async (id: string, siteId: string) => {
  const supplier = await supplierRepository.findById(id, siteId);
  if (!supplier) throw new NotFoundError('Supplier not found');
  return supplier;
};

const normalizeName = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Kenyan numbers appear as 07xx / 2547xx / +2547xx — compare on the last nine digits. */
const normalizePhone = (phone: string | null | undefined): string => (phone ?? '').replace(/\D/g, '').slice(-9);

/** Milestone One's partial unique index (org, lower(name)) WHERE live still applies: exact names cannot coexist. */
const NAME_TAKEN = 'A live supplier already has exactly this name';

const nullable = <T>(value: T | null | undefined): T | null => value ?? null;

// ---------------------------------------------------------------------------
// Duplicate detection (name + phone)
// ---------------------------------------------------------------------------

const assertNoDuplicate = async (
  siteId: string,
  name: string,
  phones: (string | null | undefined)[],
  confirmDuplicate: boolean | undefined,
  excludeId?: string,
): Promise<void> => {
  if (confirmDuplicate) return;
  const wanted = normalizeName(name);
  const wantedPhones = phones.map(normalizePhone).filter((p) => p.length > 0);
  const candidates = await supplierRepository.findLiveWithPhones(siteId);
  const matches = candidates.filter((c) => {
    if (c.id === excludeId || normalizeName(c.name) !== wanted) return false;
    if (wantedPhones.length === 0) return true;
    const theirs = c.contacts.map((k) => normalizePhone(k.phone)).filter((p) => p.length > 0);
    return theirs.length === 0 || theirs.some((p) => wantedPhones.includes(p));
  });
  if (matches.length > 0) {
    throw new ConflictError('A supplier with this name and phone already exists', 'DUPLICATE_SUPPLIER', {
      matches: matches.map((m) => ({ id: m.id, code: m.code, name: m.name })),
    });
  }
};

// ---------------------------------------------------------------------------
// Payment-method helpers
// ---------------------------------------------------------------------------

const emptyPayData: Omit<PayMethodData, 'type'> = {
  bankName: null,
  bankBranch: null,
  accountName: null,
  accountNumber: null,
  paybillNumber: null,
  accountReference: null,
  tillNumber: null,
  phone: null,
  registeredName: null,
  note: null,
};

const toPayData = (parsed: ReturnType<typeof PayMethodFieldsSchema.parse>): PayMethodData => {
  const { type, ...rest } = parsed;
  const fields: Record<string, string | null | undefined> = rest;
  const data: PayMethodData = { ...emptyPayData, type };
  for (const key of Object.keys(emptyPayData) as (keyof typeof emptyPayData)[]) {
    data[key] = nullable(fields[key]);
  }
  return data;
};

const asJson = (value: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * Fire-and-forget (called with `void`): tells the hub's Accountant(s) a cheque method was added.
 * Same socket + FCM primitives the signed-receipt notice uses; never blocks or fails the request.
 */
const notifyAccountantsOfChequeMethod = async (
  siteId: string,
  actor: Actor,
  supplier: { id: string; name: string },
  reason: string,
): Promise<void> => {
  try {
    const accountants = await supplierPayMethodRepository.findHubAccountants(siteId);
    const recipientIds = accountants.map((a) => a.id).filter((id) => id !== actor.id);
    if (recipientIds.length === 0) return;
    const addedBy = await authRepository.findUserById(actor.id);
    const payload = { supplierId: supplier.id, supplierName: supplier.name, addedByName: addedBy?.name ?? 'A colleague', reason };
    recipientIds.forEach((id) => socketService.emitChequeMethodAdded(id, payload));
    await fcmService.sendChequeMethodAddedPush(recipientIds, payload);
  } catch (error) {
    logger.warn({ err: error, supplierId: supplier.id }, 'Failed to notify Accountants of a cheque method');
  }
};

/**
 * Tells the hub's Accountant(s) that payment details were added or changed (any kind of method but a cheque add,
 * which has its own notice above). Same primitives; never blocks or fails the request.
 */
const notifyAccountantsOfPayMethodChange = async (
  siteId: string,
  actor: Actor,
  supplier: { id: string; name: string },
  summary: string,
  reason: string,
): Promise<void> => {
  try {
    const accountants = await supplierPayMethodRepository.findHubAccountants(siteId);
    const recipientIds = accountants.map((a) => a.id).filter((id) => id !== actor.id);
    if (recipientIds.length === 0) return;
    const changedBy = await authRepository.findUserById(actor.id);
    const payload = { supplierId: supplier.id, supplierName: supplier.name, changedByName: changedBy?.name ?? 'A colleague', summary, reason };
    recipientIds.forEach((id) => socketService.emitPayMethodChanged(id, payload));
    await fcmService.sendPayMethodChangedPush(recipientIds, payload);
  } catch (error) {
    logger.warn({ err: error, supplierId: supplier.id }, 'Failed to notify Accountants of a payment-details change');
  }
};

/** The Catalog tab's extras (§30.11): the receipt behind each price and the latest price alert on each pack, last 90 days. */
const enrichCatalogRows = async (supplierId: string, siteId: string, rows: SupplierItemRow[]) => {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const priceTimes = [...new Map(rows.filter((r) => r.lastPriceAt).map((r) => [r.lastPriceAt!.getTime(), r.lastPriceAt!])).values()];
  const [receipts, alerts] = await Promise.all([
    goodsReceiptRepository.findReceiptsSignedAt(supplierId, siteId, priceTimes),
    goodsReceiptRepository.findPriceAlertLines(supplierId, siteId, since),
  ]);
  return Promise.all(
    rows.map(async (row) => {
      const base = serializeSupplierItem(row);
      const itemLines = rows.filter((r) => r.inventoryItemId === row.inventoryItemId);
      const alert = findPriceAlert(row, itemLines, alerts);
      const previousAt = alert
        ? await goodsReceiptRepository.findPreviousSignedAt(supplierId, siteId, row.inventoryItemId, alert.alertAt)
        : null;
      return {
        ...base,
        lastReceipt: findLastReceipt(row, receipts),
        priceAlert: alert ? { pct: alert.pct, previousPrice: alert.previousPrice, previousAt: previousAt ? previousAt.toISOString() : null } : null,
      };
    }),
  );
};

/** "Sugar white · bag · 50 (their code 190035)" — names the clashing line in the 409 message. */
const describeLine = (row: SupplierItemRow): string => {
  const theirCode = row.supplierItemCode ? ` (their code ${row.supplierItemCode})` : '';
  return `${row.supplierItemName ?? row.inventoryItem.name} · ${describePack(row)}${theirCode}`;
};

const packLineExists = (supplierName: string, existing: SupplierItemRow): ConflictError =>
  new ConflictError(`${supplierName} already has this pack: ${describeLine(existing)}`, 'PACK_LINE_EXISTS', {
    existingLine: serializeSupplierItem(existing),
  });

const hasOwn = (input: object, key: string): boolean => Object.prototype.hasOwnProperty.call(input, key);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const PACK_LINE_RACE = 'This supplier already has this pack for the item';

const requireLine = async (lineId: string, supplierId: string, inventoryItemId: string, siteId: string) => {
  const row = await supplierItemRepository.findById(lineId, supplierId, inventoryItemId, siteId);
  if (!row) throw new NotFoundError('Catalog row not found');
  return row;
};

/**
 * `isPreferred: true` makes the line the item's preferred one — which is also how a seeded
 * "Preferred · confirm" mark is confirmed — and writes PREFERRED_SET / PREFERRED_CONFIRMED.
 * `false` clears it when it is this line's. Absent: nothing changes.
 */
const applyPreferredChoice = async (
  siteId: string,
  actor: Actor,
  supplierId: string,
  inventoryItemId: string,
  lineId: string,
  isPreferred: boolean | undefined,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (isPreferred === true) {
    const result = await supplierItemRepository.applyPreferred(siteId, inventoryItemId, supplierId, tx, lineId);
    if (!result.wasPreferred || result.wasNeedsConfirm) {
      await supplierAuditRepository.create(
        siteId,
        supplierId,
        actor.id,
        result.wasNeedsConfirm ? 'PREFERRED_CONFIRMED' : 'PREFERRED_SET',
        lineId,
        { inventoryItemId, lineId, isPreferred: result.wasPreferred, preferredNeedsConfirm: result.wasNeedsConfirm },
        { inventoryItemId, lineId, isPreferred: true, preferredNeedsConfirm: false },
        tx,
      );
    }
  } else if (isPreferred === false) {
    await supplierItemRepository.clearPreferredIfSupplier(siteId, inventoryItemId, supplierId, tx, lineId);
  }
};


/** What the supplier line history needs to name a line: the supplier, the item, the pack. */
interface LineContext {
  siteId: string;
  actor: Actor;
  supplier: { id: string; name: string };
  item: { id: string; usageUnit: string };
}

/**
 * Sets a price by hand on a line (§30.3): the price, when, who; a supplier audit row. Returns false and writes
 * nothing when the price is unchanged. The item history row is the caller's (a new line says it in
 * "added … at KES …", an existing line in "set …'s price to …").
 */
const setHandPrice = async (
  ctx: LineContext,
  line: { id: string; lastPrice: Prisma.Decimal | null },
  price: string,
  tx: Prisma.TransactionClient,
): Promise<boolean> => {
  if (line.lastPrice && line.lastPrice.equals(price)) return false;
  await supplierItemRepository.updateLine(
    line.id,
    ctx.siteId,
    { lastPrice: price, lastPriceAt: new Date(), lastPriceSetById: ctx.actor.id },
    tx,
  );
  await supplierAuditRepository.create(
    ctx.siteId,
    ctx.supplier.id,
    ctx.actor.id,
    'LINE_PRICE_SET',
    line.id,
    { inventoryItemId: ctx.item.id, lineId: line.id, price: line.lastPrice ? line.lastPrice.toString() : null },
    { inventoryItemId: ctx.item.id, lineId: line.id, price },
    tx,
  );
  return true;
};

const lineFacts = (ctx: LineContext, line: { buyUnit: string | null; packSize: Prisma.Decimal | string | null }) => ({
  supplierName: ctx.supplier.name,
  buyUnit: line.buyUnit,
  packSize: line.packSize ? line.packSize.toString() : null,
  usageUnit: ctx.item.usageUnit,
});

/** A new line: the optional first price, then one "added …" history row. */
const recordLineAdded = async (
  ctx: LineContext,
  line: { id: string; buyUnit: string | null; packSize: Prisma.Decimal | string | null },
  price: string | undefined,
  preferred: boolean,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (price !== undefined) await setHandPrice(ctx, { id: line.id, lastPrice: null }, price, tx);
  await itemChangeRepository.record(tx, {
    siteId: ctx.siteId,
    inventoryItemId: ctx.item.id,
    kind: 'SUPPLIER_ADDED',
    summary: describeSupplierAdded(lineFacts(ctx, line), price ?? null, preferred),
    after: { supplierId: ctx.supplier.id, lineId: line.id, buyUnit: line.buyUnit, packSize: line.packSize ? line.packSize.toString() : null, price: price ?? null },
    changedById: ctx.actor.id,
  });
};

/** An existing line given a new price by hand. */
const recordPriceSet = async (
  ctx: LineContext,
  line: { id: string; buyUnit: string | null; packSize: Prisma.Decimal | null; lastPrice: Prisma.Decimal | null },
  price: string,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  if (!(await setHandPrice(ctx, line, price, tx))) return;
  const previous = line.lastPrice ? line.lastPrice.toString() : null;
  await itemChangeRepository.record(tx, {
    siteId: ctx.siteId,
    inventoryItemId: ctx.item.id,
    kind: 'SUPPLIER_PRICE_SET',
    summary: describePriceSet(lineFacts(ctx, line), price, previous),
    before: { lineId: line.id, price: previous },
    after: { lineId: line.id, price },
    changedById: ctx.actor.id,
  });
};

const createContactRows = async (
  siteId: string,
  supplierId: string,
  contacts: CreateContactInput[],
  tx: Prisma.TransactionClient,
): Promise<void> => {
  const flagged = contacts.findIndex((c) => c.isPrimary);
  const primaryIndex = flagged >= 0 ? flagged : 0;
  for (const [index, contact] of contacts.entries()) {
    await supplierContactRepository.create(
      siteId,
      supplierId,
      {
        name: contact.name,
        role: contact.role,
        phone: nullable(contact.phone),
        whatsapp: nullable(contact.whatsapp),
        email: nullable(contact.email),
        isPrimary: index === primaryIndex,
      },
      tx,
    );
  }
};

export const supplierService = {
  // ── Suppliers ────────────────────────────────────────────────────────────

  /** Attendants get a stripped list of ACTIVE suppliers only. */
  listSuppliers: async (actor: Actor, query: ListSuppliersQuery) => {
    const siteId = await requireHubReader(actor);
    const attendant = !actorCan(actor, 'suppliers.read');
    // "Profile not finished" is worked out over every live supplier first, then the list is limited to those ids.
    let ids: string[] | undefined;
    if (!attendant && query.profileNotFinished) {
      const live = await supplierStripRepository.listForStrip(siteId);
      ids = live
        .filter((s) => profileDoneCount({ ...s, payMethodCount: s._count.payMethods }) < PROFILE_CHECK_COUNT)
        .map((s) => s.id);
    }
    const { suppliers, total } = await supplierRepository.findAllBySite(siteId, {
      search: query.search,
      status: attendant ? 'ACTIVE' : query.status,
      type: query.type,
      categoryId: query.categoryId,
      includeArchived: query.includeRetired,
      ids,
      page: query.page,
      perPage: query.perPage,
    });
    const pagination = {
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
    if (attendant) return { data: suppliers.map(serializeAttendantSupplier), pagination };

    const strip = await supplierStripRepository.listForStripByIds(
      siteId,
      suppliers.map((s) => s.id),
    );
    const stripById = new Map(strip.map((s) => [s.id, s]));
    return {
      data: suppliers.map((supplier) => {
        const row = stripById.get(supplier.id);
        return {
          ...serializeSupplierBase(supplier),
          profileDone: row ? profileDoneCount({ ...row, payMethodCount: row._count.payMethods }) : 0,
          owedAmount: (row ? supplierOwed(row.supplierInvoices) : new Prisma.Decimal(0)).toFixed(2),
        };
      }),
      pagination,
    };
  },

  getSupplierById: async (actor: Actor, id: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    const supplier = await supplierRepository.findDetailById(id, siteId);
    if (!supplier) throw new NotFoundError('Supplier not found');
    return serializeSupplierDetail(supplier, canSeePaymentDetails(actor));
  },

  createSupplier: async (actor: Actor, input: CreateSupplierInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);

    const contacts: CreateContactInput[] = input.contacts ?? [];

    await assertNoDuplicate(
      siteId,
      input.name,
      contacts.map((c) => c.phone),
      input.confirmDuplicate,
    );

    const id = await prisma
      .$transaction(async (tx) => {
        const code = await referenceCounterRepository.nextReference(tx, siteId, 'SUPPLIER', 4);
        const created = await supplierRepository.create(
          siteId,
          {
            code,
            name: input.name,
            tradingName: nullable(input.tradingName),
            status: 'ACTIVE',
            type: input.type,
            categoryId: nullable(input.categoryId),
            kraPin: nullable(input.kraPin),
            vatRegistered: input.vatRegistered,
            notes: nullable(input.notes),
            address: input.address,
            mapUrl: nullable(input.mapUrl),
            defaultPaymentTerms: input.defaultPaymentTerms,
            paymentDays: input.paymentDays,
            creditLimit: nullable(input.creditLimit),
            createdById: actor.id,
          },
          tx,
        );
        await createContactRows(siteId, created.id, contacts, tx);
        return created.id;
      })
      .catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    return supplierService.getSupplierById(actor, id);
  },

  updateSupplier: async (actor: Actor, id: string, input: UpdateSupplierInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    const existing = await supplierRepository.findDetailById(id, siteId);
    if (!existing) throw new NotFoundError('Supplier not found');

    if (input.name !== undefined && normalizeName(input.name) !== normalizeName(existing.name)) {
      await assertNoDuplicate(
        siteId,
        input.name,
        existing.contacts.map((c) => c.phone),
        input.confirmDuplicate,
        id,
      );
    }

    await prisma.$transaction(async (tx) => {
      await supplierRepository.update(
        id,
        siteId,
        {
          name: input.name,
          tradingName: input.tradingName,
          type: input.type,
          categoryId: input.categoryId,
          kraPin: input.kraPin,
          vatRegistered: input.vatRegistered,
          notes: input.notes,
          address: input.address,
          mapUrl: input.mapUrl,
          defaultPaymentTerms: input.defaultPaymentTerms,
          paymentDays: input.paymentDays,
          creditLimit: input.creditLimit,
          updatedById: actor.id,
        },
        tx,
      );
    }).catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    return supplierService.getSupplierById(actor, id);
  },

  /** Store Manager and Attendant. Name + phone only; complete the record later. */
  quickAddSupplier: async (actor: Actor, input: QuickAddSupplierInput) => {
    if (!actorCan(actor, 'suppliers.quick_add')) throw new ForbiddenError('You cannot add suppliers');
    const siteId = await requireHubActor(actor);
    await assertNoDuplicate(siteId, input.name, [input.phone], input.confirmDuplicate);

    const id = await prisma
      .$transaction(async (tx) => {
        const code = await referenceCounterRepository.nextReference(tx, siteId, 'SUPPLIER', 4);
        const created = await supplierRepository.create(
          siteId,
          {
            code,
            name: input.name,
            tradingName: null,
            status: 'ACTIVE',
            type: 'ONE_OFF',
            categoryId: null,
            kraPin: null,
            vatRegistered: false,
            notes: null,
            address: '—',
            mapUrl: null,
            defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
            creditLimit: null,
            createdById: actor.id,
          },
          tx,
        );
        await supplierContactRepository.create(
          siteId,
          created.id,
          { name: input.name, role: 'OTHER', phone: input.phone, whatsapp: null, email: null, isPrimary: true },
          tx,
        );
        return created.id;
      })
      .catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    const created = await requireSupplier(id, siteId);
    return !actorCan(actor, 'suppliers.read') ? serializeAttendantSupplier(created) : serializeSupplierBase(created);
  },

  updateStatus: async (actor: Actor, id: string, input: UpdateSupplierStatusInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    const existing = await requireSupplier(id, siteId);
    if (existing.status === input.status) {
      throw new ConflictError(`This supplier is already ${input.status}`, 'STATUS_UNCHANGED');
    }

    if (input.status === 'ARCHIVED') {
      const open = await supplierRepository.countOpenInvoices(id, siteId);
      if (open > 0) {
        throw new ConflictError(
          'This supplier still has unpaid invoices and cannot be archived',
          'SUPPLIER_HAS_OPEN_INVOICES',
          { openInvoices: open },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await supplierRepository.setStatus(id, siteId, input.status, actor.id, tx);
      if (input.status === 'ARCHIVED') await supplierRepository.clearPreferred(id, siteId, tx);
      await supplierAuditRepository.create(
        siteId,
        id,
        actor.id,
        'STATUS_CHANGED',
        id,
        { status: existing.status },
        { status: input.status, ...(input.reason ? { reason: input.reason } : {}) },
        tx,
      );
    }).catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    return serializeSupplierBase(await requireSupplier(id, siteId));
  },

  // ── Contacts ─────────────────────────────────────────────────────────────

  listContacts: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    return (await supplierContactRepository.list(supplierId, siteId)).map(serializeContact);
  },

  createContact: async (actor: Actor, supplierId: string, input: CreateContactInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);
    const created = await prisma.$transaction(async (tx) => {
      const count = await supplierContactRepository.count(supplierId, siteId, tx);
      const makePrimary = count === 0 || input.isPrimary === true;
      if (makePrimary) await supplierContactRepository.unsetPrimary(supplierId, siteId, tx);
      return supplierContactRepository.create(
        siteId,
        supplierId,
        {
          name: input.name,
          role: input.role,
          phone: nullable(input.phone),
          whatsapp: nullable(input.whatsapp),
          email: nullable(input.email),
          isPrimary: makePrimary,
        },
        tx,
      );
    });
    return serializeContact(created);
  },

  updateContact: async (actor: Actor, supplierId: string, contactId: string, input: UpdateContactInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await supplierContactRepository.findById(contactId, supplierId, siteId, tx);
      if (!existing) throw new NotFoundError('Contact not found');
      if (input.isPrimary === false && existing.isPrimary) {
        throw new ConflictError('Make another contact primary instead', 'PRIMARY_CONTACT_REQUIRED');
      }
      if (input.isPrimary === true && !existing.isPrimary) {
        await supplierContactRepository.unsetPrimary(supplierId, siteId, tx);
      }
      await supplierContactRepository.update(
        contactId,
        supplierId,
        siteId,
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.isPrimary === true ? { isPrimary: true } : {}),
        },
        tx,
      );
      return supplierContactRepository.findById(contactId, supplierId, siteId, tx);
    });
    if (!updated) throw new NotFoundError('Contact not found');
    return serializeContact(updated);
  },

  deleteContact: async (actor: Actor, supplierId: string, contactId: string): Promise<void> => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);
    const existing = await supplierContactRepository.findById(contactId, supplierId, siteId);
    if (!existing) throw new NotFoundError('Contact not found');
    if (existing.isPrimary && (await supplierContactRepository.count(supplierId, siteId)) > 1) {
      throw new ConflictError('Make another contact primary before deleting this one', 'PRIMARY_CONTACT_REQUIRED');
    }
    await supplierContactRepository.delete(contactId, supplierId, siteId);
  },

  // ── Payment methods (audited) ────────────────────────────────────────────

  listPayMethods: async (actor: Actor, supplierId: string) => {
    if (!canSeePaymentDetails(actor)) throw new ForbiddenError('You cannot view supplier payment details');
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    return (await supplierPayMethodRepository.list(supplierId, siteId)).map(serializePayMethod);
  },

  /** The only response that carries the full account number. */
  getPayMethod: async (actor: Actor, supplierId: string, methodId: string) => {
    if (!canSeePaymentDetails(actor)) throw new ForbiddenError('You cannot view supplier payment details');
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const method = await supplierPayMethodRepository.findById(methodId, supplierId, siteId);
    if (!method) throw new NotFoundError('Payment method not found');
    return serializePayMethodDetail(method);
  },

  createPayMethod: async (actor: Actor, supplierId: string, input: CreatePayMethodInput) => {
    if (!actorCan(actor, 'suppliers.write_payment_methods')) {
      throw new ForbiddenError('You cannot edit supplier payment details');
    }
    const siteId = await requireHubActor(actor);
    const supplier = await requireSupplier(supplierId, siteId);
    const { isDefault, reason, ...fields } = input;
    const data = toPayData(PayMethodFieldsSchema.parse(fields));
    const isCheque = data.type === 'CHEQUE';

    const created = await prisma.$transaction(async (tx) => {
      const count = await supplierPayMethodRepository.count(supplierId, siteId, tx);
      const makeDefault = count === 0 || isDefault === true;
      const previousDefault = makeDefault && count > 0
        ? await supplierPayMethodRepository.findDefault(supplierId, siteId, tx)
        : null;
      if (makeDefault) await supplierPayMethodRepository.unsetDefault(supplierId, siteId, tx);
      const row = await supplierPayMethodRepository.create(
        siteId,
        supplierId,
        actor.id,
        { ...data, isDefault: makeDefault },
        tx,
      );
      await supplierAuditRepository.create(
        siteId, supplierId, actor.id, 'PAY_METHOD_CREATED', row.id, null,
        asJson(isCheque ? { ...auditSnapshot(row), summary: 'cheque method added', reason } : { ...auditSnapshot(row), reason }),
        tx,
      );
      if (previousDefault) {
        await supplierAuditRepository.create(
          siteId, supplierId, actor.id, 'PAY_METHOD_DEFAULT_CHANGED', row.id,
          { defaultMethodId: previousDefault.id }, { defaultMethodId: row.id }, tx,
        );
      }
      return row;
    });
    if (isCheque) void notifyAccountantsOfChequeMethod(siteId, actor, supplier, reason ?? '');
    else void notifyAccountantsOfPayMethodChange(siteId, actor, supplier, describePayMethodChange('PAY_METHOD_CREATED', null, auditSnapshot(created)), reason ?? '');
    return serializePayMethod(created);
  },

  updatePayMethod: async (actor: Actor, supplierId: string, methodId: string, input: UpdatePayMethodInput) => {
    if (!actorCan(actor, 'suppliers.write_payment_methods')) {
      throw new ForbiddenError('You cannot edit supplier payment details');
    }
    const siteId = await requireHubActor(actor);
    const supplier = await requireSupplier(supplierId, siteId);

    let detailsChanged: { summary: string; reason: string } | null = null;
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await supplierPayMethodRepository.findById(methodId, supplierId, siteId, tx);
      if (!existing) throw new NotFoundError('Payment method not found');
      if (input.isDefault === false && existing.isDefault) {
        throw new ConflictError('Make another payment method the default instead', 'DEFAULT_METHOD_REQUIRED');
      }

      const { isDefault, reason, ...patch } = input;
      const merged = { ...existing, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
      const data = toPayData(PayMethodFieldsSchema.parse(merged));

      let previousDefaultId: string | null = null;
      if (isDefault === true && !existing.isDefault) {
        previousDefaultId = (await supplierPayMethodRepository.findDefault(supplierId, siteId, tx))?.id ?? null;
        await supplierPayMethodRepository.unsetDefault(supplierId, siteId, tx);
      }
      await supplierPayMethodRepository.update(
        methodId, supplierId, siteId, { ...data, ...(isDefault === true ? { isDefault: true } : {}) }, tx,
      );
      const after = await supplierPayMethodRepository.findById(methodId, supplierId, siteId, tx);
      if (!after) throw new NotFoundError('Payment method not found');

      const summary = describePayMethodChange('PAY_METHOD_UPDATED', auditSnapshot(existing), auditSnapshot(after));
      const detailFieldsSent = Object.values(patch).some((v) => v !== undefined);
      await supplierAuditRepository.create(
        siteId, supplierId, actor.id, 'PAY_METHOD_UPDATED', methodId,
        asJson(auditSnapshot(existing)), asJson({ ...auditSnapshot(after), ...(reason ? { reason } : {}) }), tx,
      );
      if (detailFieldsSent) detailsChanged = { summary, reason: reason ?? '' };
      if (isDefault === true && !existing.isDefault) {
        await supplierAuditRepository.create(
          siteId, supplierId, actor.id, 'PAY_METHOD_DEFAULT_CHANGED', methodId,
          { defaultMethodId: previousDefaultId }, { defaultMethodId: methodId }, tx,
        );
      }
      return after;
    });
    if (detailsChanged) {
      const { summary, reason } = detailsChanged as { summary: string; reason: string };
      void notifyAccountantsOfPayMethodChange(siteId, actor, supplier, summary, reason);
    }
    return serializePayMethod(updated);
  },

  deletePayMethod: async (actor: Actor, supplierId: string, methodId: string): Promise<void> => {
    if (!actorCan(actor, 'suppliers.write_payment_methods')) {
      throw new ForbiddenError('You cannot edit supplier payment details');
    }
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);
    await prisma.$transaction(async (tx) => {
      const existing = await supplierPayMethodRepository.findById(methodId, supplierId, siteId, tx);
      if (!existing) throw new NotFoundError('Payment method not found');
      if (existing.isDefault && (await supplierPayMethodRepository.count(supplierId, siteId, tx)) > 1) {
        throw new ConflictError('Make another payment method the default before deleting this one', 'DEFAULT_METHOD_REQUIRED');
      }
      await supplierPayMethodRepository.delete(methodId, supplierId, siteId, tx);
      await supplierAuditRepository.create(
        siteId, supplierId, actor.id, 'PAY_METHOD_DELETED', methodId, asJson(auditSnapshot(existing)), null, tx,
      );
    });
  },

  /** "Who changed these, and when": the payment-method rows of the audit log in plain words, newest first (§30.10). */
  listPayMethodHistory: async (actor: Actor, supplierId: string) => {
    if (!canSeePaymentDetails(actor)) throw new ForbiddenError('You cannot view supplier payment details');
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const rows = await supplierAuditRepository.listPayMethodChanges(supplierId, siteId, 50);
    return rows.map((row) => {
      const before = (row.before ?? null) as Record<string, unknown> | null;
      const after = (row.after ?? null) as Record<string, unknown> | null;
      const reason = typeof after?.reason === 'string' && after.reason.length > 0 ? after.reason : null;
      return {
        id: row.id,
        at: row.createdAt.toISOString(),
        action: row.action as 'PAY_METHOD_CREATED' | 'PAY_METHOD_UPDATED' | 'PAY_METHOD_DELETED' | 'PAY_METHOD_DEFAULT_CHANGED',
        summary: describePayMethodChange(
          row.action as 'PAY_METHOD_CREATED' | 'PAY_METHOD_UPDATED' | 'PAY_METHOD_DELETED' | 'PAY_METHOD_DEFAULT_CHANGED',
          before,
          after,
        ),
        reason,
        actor: row.actor,
      };
    });
  },

  // ── Catalog ──────────────────────────────────────────────────────────────

  listItems: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const rows = await supplierItemRepository.list(supplierId, siteId);
    return enrichCatalogRows(supplierId, siteId, rows);
  },

  /** Add one pack line. The key (supplier, item, buy unit, pack size) must be new — a clash is a 409. */
  addItem: async (actor: Actor, supplierId: string, input: CreateSupplierItemInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    const supplier = await requireSupplier(supplierId, siteId);
    const item = await supplierItemLookupRepository.findLiveItem(input.inventoryItemId, siteId);
    if (!item) throw new NotFoundError('Inventory item not found');

    const key = { buyUnit: nullable(input.buyUnit) ?? item.buyUnit, packSize: nullable(input.packSize) };
    const lineId = await prisma
      .$transaction(async (tx) => {
        const clash = await supplierItemRepository.findByKey(supplierId, input.inventoryItemId, siteId, key, tx);
        if (clash) throw packLineExists(supplier.name, clash);
        const created = await supplierItemRepository.createLine(
          siteId,
          supplierId,
          input.inventoryItemId,
          {
            supplierItemName: nullable(input.supplierItemName),
            supplierItemCode: nullable(input.supplierItemCode),
            buyUnit: key.buyUnit,
            packSize: key.packSize,
          },
          tx,
        );
        await applyPreferredChoice(siteId, actor, supplierId, input.inventoryItemId, created.id, input.isPreferred, tx);
        await recordLineAdded({ siteId, actor, supplier, item }, created, input.price, input.isPreferred === true, tx);
        return created.id;
      })
      .catch((error: unknown) => mapPrismaError(error, { conflict: PACK_LINE_RACE }));
    return serializeSupplierItem(await requireLine(lineId, supplierId, input.inventoryItemId, siteId));
  },

  /**
   * Edit or add on the line key. `lineId` edits that line (a key change onto another line is a 409).
   * Without it: a named pack finds-or-creates the line with exactly that key; no pack named means the
   * supplier's oldest line for the item (created if none) — the pre-pack-lines behaviour.
   * Only the fields present in the body change.
   */
  putItem: async (actor: Actor, supplierId: string, inventoryItemId: string, input: PutSupplierItemInput) => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    const supplier = await requireSupplier(supplierId, siteId);
    const item = await supplierItemLookupRepository.findLiveItem(inventoryItemId, siteId);
    if (!item) throw new NotFoundError('Inventory item not found');

    const namedPack = hasOwn(input, 'buyUnit') || hasOwn(input, 'packSize');
    const fields = {
      ...(input.supplierItemName !== undefined ? { supplierItemName: nullable(input.supplierItemName) } : {}),
      ...(input.supplierItemCode !== undefined ? { supplierItemCode: nullable(input.supplierItemCode) } : {}),
    };

    const lineId = await prisma
      .$transaction(async (tx) => {
        let target: SupplierItemRow | null = null;
        let createdLine = false;
        if (input.lineId) {
          target = await supplierItemRepository.findById(input.lineId, supplierId, inventoryItemId, siteId, tx);
          if (!target) throw new NotFoundError('Catalog line not found');
          const nextKey = {
            buyUnit: input.buyUnit !== undefined ? nullable(input.buyUnit) : target.buyUnit,
            packSize: input.packSize !== undefined ? nullable(input.packSize) : target.packSize,
          };
          if (!sameLineKey(target, nextKey)) {
            const clash = await supplierItemRepository.findByKey(supplierId, inventoryItemId, siteId, nextKey, tx);
            if (clash && clash.id !== target.id) throw packLineExists(supplier.name, clash);
          }
          await supplierItemRepository.updateLine(
            target.id,
            siteId,
            {
              ...fields,
              ...(input.buyUnit !== undefined ? { buyUnit: nullable(input.buyUnit) } : {}),
              ...(input.packSize !== undefined ? { packSize: nullable(input.packSize) } : {}),
            },
            tx,
          );
        } else if (namedPack) {
          const key = { buyUnit: nullable(input.buyUnit) ?? item.buyUnit, packSize: nullable(input.packSize) };
          target = await supplierItemRepository.findByKey(supplierId, inventoryItemId, siteId, key, tx);
          if (target) {
            await supplierItemRepository.updateLine(target.id, siteId, fields, tx);
          } else {
            target = await supplierItemRepository.createLine(
              siteId,
              supplierId,
              inventoryItemId,
              { supplierItemName: null, supplierItemCode: null, ...fields, buyUnit: key.buyUnit, packSize: key.packSize },
              tx,
            );
            createdLine = true;
          }
        } else {
          const [oldest] = await supplierItemRepository.listBySupplierItems(supplierId, [inventoryItemId], siteId, tx);
          if (oldest) {
            target = await supplierItemRepository.findById(oldest.id, supplierId, inventoryItemId, siteId, tx);
            if (Object.keys(fields).length > 0) await supplierItemRepository.updateLine(oldest.id, siteId, fields, tx);
          } else {
            target = await supplierItemRepository.createLine(
              siteId,
              supplierId,
              inventoryItemId,
              { supplierItemName: null, supplierItemCode: null, ...fields, buyUnit: item.buyUnit, packSize: null },
              tx,
            );
            createdLine = true;
          }
        }
        if (!target) throw new NotFoundError('Catalog line not found');
        const lineCtx = { siteId, actor, supplier, item };
        if (createdLine) await recordLineAdded(lineCtx, target, input.price, input.isPreferred === true, tx);
        else if (input.price !== undefined) await recordPriceSet(lineCtx, target, input.price, tx);
        await applyPreferredChoice(siteId, actor, supplierId, inventoryItemId, target.id, input.isPreferred, tx);
        return target.id;
      })
      .catch((error: unknown) => mapPrismaError(error, { conflict: PACK_LINE_RACE }));
    return serializeSupplierItem(await requireLine(lineId, supplierId, inventoryItemId, siteId));
  },

  deleteItem: async (actor: Actor, supplierId: string, inventoryItemId: string, lineId?: string): Promise<void> => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);
    await prisma.$transaction(async (tx) => {
      const lines = await supplierItemRepository.listBySupplierItems(supplierId, [inventoryItemId], siteId, tx);
      if (lines.length === 0 || (lineId && !lines.some((l) => l.id === lineId))) {
        throw new NotFoundError('Catalog row not found');
      }
      if (!lineId && lines.length > 1) {
        throw new ConflictError(
          'This supplier has several pack lines for this item — say which one to remove',
          'MULTIPLE_PACK_LINES',
          { lineIds: lines.map((l) => l.id) },
        );
      }
      await supplierItemRepository.clearPreferredIfSupplier(siteId, inventoryItemId, supplierId, tx, lineId);
      await supplierItemRepository.delete(supplierId, inventoryItemId, siteId, tx, lineId);
    });
  },

  /**
   * Signed receipt lines whose pack matched no catalog line. Re-checked against today's lines, so
   * adding the missing pack makes the row disappear without any write.
   */
  listPackMismatches: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const flagged = await goodsReceiptRepository.findPackNotOnFileLines(supplierId, siteId);
    if (flagged.length === 0) return [];
    const lines = await supplierItemRepository.listBySupplierItems(
      supplierId,
      [...new Set(flagged.map((f) => f.inventoryItemId))],
      siteId,
    );
    return flagged
      .filter((f) => !matchSupplierLine(lines.filter((l) => l.inventoryItemId === f.inventoryItemId), { buyUnit: f.packBuyUnit, packSize: f.packSize }))
      .map((f) => ({
        receiptLineId: f.id,
        goodsReceiptId: f.goodsReceipt.id,
        reference: f.goodsReceipt.reference,
        signedAt: f.goodsReceipt.signedAt ? f.goodsReceipt.signedAt.toISOString() : null,
        inventoryItemId: f.inventoryItemId,
        itemName: f.inventoryItem.name,
        packBuyUnit: f.packBuyUnit,
        packSize: f.packSize ? f.packSize.toString() : null,
        unitPrice: f.unitPrice.toString(),
      }));
  },

  // ── Documents ────────────────────────────────────────────────────────────

  /** Timeline (receipts, invoices, payments, disputes) mixed with uploads, newest first. */
  listDocuments: async (actor: Actor, supplierId: string, limit: number) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const [receipts, invoices, payments, uploads] = await Promise.all([
      supplierHistoryRepository.signedReceipts(supplierId, siteId, limit),
      supplierHistoryRepository.invoices(supplierId, siteId, limit),
      supplierHistoryRepository.payments(supplierId, siteId, limit),
      supplierDocumentRepository.list(supplierId, siteId, limit),
    ]);

    const entries = [
      ...receipts.flatMap((r) =>
        r.signedAt
          ? [{ kind: 'RECEIPT' as const, id: r.id, occurredAt: r.signedAt.toISOString(), title: 'Goods receipt signed', reference: r.reference, amount: r.receiptTotal.toString(), actor: r.signedBy ?? null }]
          : [],
      ),
      ...invoices.map((i) => ({ kind: 'INVOICE' as const, id: i.id, occurredAt: i.invoiceDate.toISOString(), title: 'Invoice recorded', reference: i.invoiceNumber, amount: i.amountBilled.toString(), actor: i.recordedBy })),
      ...invoices.flatMap((i) =>
        i.disputeStatus
          ? [{ kind: 'DISPUTE' as const, id: i.id, occurredAt: i.updatedAt.toISOString(), title: i.disputeStatus === 'OPEN' ? 'Invoice disputed' : 'Dispute resolved', reference: i.invoiceNumber, amount: null, actor: null }]
          : [],
      ),
      ...payments.map((p) => ({ kind: 'PAYMENT' as const, id: p.id, occurredAt: p.paidAt.toISOString(), title: p.reversalOfId ? 'Payment reversed' : 'Payment made', reference: p.reference, amount: p.amount.toString(), actor: p.recordedBy })),
      ...uploads.map((d) => ({ kind: 'UPLOAD' as const, id: d.id, occurredAt: d.createdAt.toISOString(), title: d.fileName, reference: null, amount: null, actor: null, document: serializeDocument(d) })),
    ];
    entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return entries.slice(0, limit);
  },

  uploadDocument: async (actor: Actor, supplierId: string, file: UploadedFile | undefined, input: UploadSupplierDocumentInput) => {
    requireReadAccess(actor);
    if (!actorCan(actor, 'suppliers.upload_documents')) {
      throw new ForbiddenError('You cannot upload supplier documents');
    }
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);

    if (!file) throw new ValidationError('A file is required');
    if (file.size > MAX_SUPPLIER_DOCUMENT_BYTES || file.buffer.length > MAX_SUPPLIER_DOCUMENT_BYTES) {
      throw new UnprocessableEntityError('File is larger than 10 MB', 'FILE_TOO_LARGE');
    }
    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new UnprocessableEntityError('Only images (JPEG, PNG, WebP) and PDFs are accepted', 'FILE_TYPE_NOT_ALLOWED');
    }
    if (input.goodsReceiptId && !(await supplierDocumentRepository.receiptBelongs(input.goodsReceiptId, supplierId, siteId))) {
      throw new NotFoundError('Goods receipt not found for this supplier');
    }
    if (input.supplierInvoiceId && !(await supplierDocumentRepository.invoiceBelongs(input.supplierInvoiceId, supplierId, siteId))) {
      throw new NotFoundError('Supplier invoice not found for this supplier');
    }

    const storage = getDocumentStorage();
    const id = randomUUID();
    const objectKey = `org/${siteId}/suppliers/${supplierId}/${randomUUID()}`;
    await storage.putObject(objectKey, file.buffer, detected);
    try {
      const created = await supplierDocumentRepository.create(siteId, supplierId, {
        id,
        objectKey,
        fileName: sanitizeFileName(file.originalname),
        mimeType: detected,
        sizeBytes: file.buffer.length,
        docType: input.docType,
        docDate: input.docDate ? new Date(`${input.docDate}T00:00:00.000Z`) : null,
        note: nullable(input.note),
        goodsReceiptId: nullable(input.goodsReceiptId),
        supplierInvoiceId: nullable(input.supplierInvoiceId),
        uploadedById: actor.id,
      });
      return serializeDocument(created);
    } catch (error) {
      await storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  },

  /** Signed URL only — same org and supplier check as the supplier itself. */
  getDocumentDownload: async (actor: Actor, supplierId: string, docId: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const doc = await supplierDocumentRepository.findById(docId, supplierId, siteId);
    if (!doc) throw new NotFoundError('Document not found');
    const signed = await getDocumentStorage().getSignedUrl(doc.objectKey, {
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      fileName: doc.fileName,
    });
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString(), fileName: doc.fileName };
  },

  deleteDocument: async (actor: Actor, supplierId: string, docId: string): Promise<void> => {
    requireWriteAccess(actor);
    const siteId = await requireHubActor(actor);
    await requireSupplier(supplierId, siteId);
    const doc = await supplierDocumentRepository.findById(docId, supplierId, siteId);
    if (!doc) throw new NotFoundError('Document not found');
    await supplierDocumentRepository.delete(docId, supplierId, siteId);
    await getDocumentStorage()
      .deleteObject(doc.objectKey)
      .catch((error: unknown) => logger.error({ err: error, docId }, 'Failed to delete supplier document object'));
  },

  // ── Summary ──────────────────────────────────────────────────────────────

  /** The strip above the suppliers list: active, on hold, profile not finished, owed (§29.3). */
  getListSummary: async (actor: Actor) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    const suppliers = await supplierStripRepository.listForStrip(siteId);
    let owed = new Prisma.Decimal(0);
    let suppliersOwed = 0;
    for (const supplier of suppliers) {
      const balance = supplierOwed(supplier.supplierInvoices);
      if (balance.greaterThan(0)) suppliersOwed += 1;
      owed = owed.plus(balance);
    }
    return {
      active: suppliers.filter((s) => s.status === 'ACTIVE').length,
      onHold: suppliers.filter((s) => s.status === 'ON_HOLD').length,
      profileNotFinished: suppliers.filter(
        (s) => profileDoneCount({ ...s, payMethodCount: s._count.payMethods }) < PROFILE_CHECK_COUNT,
      ).length,
      owedAmount: owed.toFixed(2),
      suppliersOwed,
    };
  },

  /** The strip on a supplier's Catalog tab: items they sell, price alerts, last receipt, spend over 90 days (§29.3). */
  getCatalogSummary: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const since = new Date(Date.now() - 90 * 86_400_000);
    const strip = await supplierStripRepository.catalogStrip(supplierId, siteId, since);
    return {
      itemsTheySell: strip.itemsTheySell,
      priceAlerts: strip.recent.reduce((n, r) => n + r.lines.filter((l) => l.priceAlertPct !== null).length, 0),
      lastReceiptAt: strip.lastReceiptAt ? strip.lastReceiptAt.toISOString() : null,
      spend90Days: strip.recent.reduce((sum, r) => sum.plus(r.receiptTotal), new Prisma.Decimal(0)).toFixed(2),
    };
  },

  getSummary: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const siteId = await requireHubReader(actor);
    await requireSupplier(supplierId, siteId);
    const [receipts, invoices] = await Promise.all([
      supplierHistoryRepository.summaryReceipts(supplierId, siteId),
      supplierHistoryRepository.summaryInvoices(supplierId, siteId),
    ]);

    let totalSpend = new Prisma.Decimal(0);
    let lastPurchaseAt: Date | null = null;
    let priceAlerts = 0;
    let shortDeliveries = 0;
    for (const receipt of receipts) {
      totalSpend = totalSpend.plus(receipt.receiptTotal);
      if (receipt.signedAt && (!lastPurchaseAt || receipt.signedAt > lastPurchaseAt)) lastPurchaseAt = receipt.signedAt;
      priceAlerts += receipt.lines.filter((l) => l.priceAlertPct !== null).length;
      const expected = receipt.expectedDelivery?.lines ?? [];
      const isShort = expected.some((e) => {
        const received = receipt.lines
          .filter((l) => l.inventoryItemId === e.inventoryItemId)
          .reduce((sum, l) => sum.plus(l.quantityBuyUnit), new Prisma.Decimal(0));
        return received.lessThan(e.quantity);
      });
      if (isShort) shortDeliveries += 1;
    }

    const daysToPay: number[] = [];
    for (const invoice of invoices) {
      const adjusted = invoice.adjustments.reduce((s, a) => s.plus(a.amount), invoice.amountBilled);
      const paid = invoice.allocations.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0));
      if (adjusted.minus(paid).greaterThan(0)) continue;
      const lastPaidAt = invoice.allocations
        .filter((a) => a.supplierPayment.reversalOfId === null)
        .reduce<Date | null>((latest, a) => (!latest || a.supplierPayment.paidAt > latest ? a.supplierPayment.paidAt : latest), null);
      if (!lastPaidAt) continue;
      daysToPay.push(Math.max(0, (lastPaidAt.getTime() - invoice.invoiceDate.getTime()) / 86_400_000));
    }

    return {
      totalSpend: totalSpend.toString(),
      lastPurchaseAt: lastPurchaseAt ? lastPurchaseAt.toISOString() : null,
      receiptsCount: receipts.length,
      averageDaysToPay:
        daysToPay.length > 0 ? Math.round((daysToPay.reduce((a, b) => a + b, 0) / daysToPay.length) * 10) / 10 : null,
      priceAlerts,
      shortDeliveries,
    };
  },
};
