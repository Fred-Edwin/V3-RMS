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
import { prisma } from '../../config/database';
import { branchRepository } from '../../repositories/branch-repository';
import { logger } from '../../utils/logger';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../utils/errors';
import { mapPrismaError } from '../../utils/prisma-errors';
import { referenceCounterRepository } from './receiving-repository';
import {
  supplierAuditRepository,
  supplierContactRepository,
  supplierDocumentRepository,
  supplierHistoryRepository,
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
  serializePayMethod,
  serializePayMethodDetail,
  serializeSupplierBase,
  serializeSupplierDetail,
  serializeSupplierItem,
} from './supplier-serializers';
import { getDocumentStorage } from './supplier-storage';
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
import type { Paginated } from './inventory.types';

type Actor = NonNullable<Request['user']>;

const PAYMENT_DETAIL_ROLES = ['STORE_MANAGER', 'ACCOUNTANT', 'DIRECTOR'] as const;
const canSeePaymentDetails = (actor: Actor): boolean => (PAYMENT_DETAIL_ROLES as readonly string[]).includes(actor.role);
const isAttendant = (actor: Actor): boolean => actor.role === 'STORE_ATTENDANT';

/**
 * Allow-list backstop behind the route's requireRole: everything beyond the
 * attendant's stripped list and quick-add is SM / Accountant / Director only.
 */
const requireReadAccess = (actor: Actor): void => {
  if (!canSeePaymentDetails(actor)) throw new ForbiddenError('You cannot access this supplier data');
};

const requireHubActor = async (actor: Actor): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  if (actor.organizationId !== hub.id) {
    throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
  }
  return hub.id;
};

/** The single gate for sub-resources: the supplier must exist in the caller's org. */
const requireSupplier = async (id: string, organizationId: string) => {
  const supplier = await supplierRepository.findById(id, organizationId);
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
  organizationId: string,
  name: string,
  phones: (string | null | undefined)[],
  confirmDuplicate: boolean | undefined,
  excludeId?: string,
): Promise<void> => {
  if (confirmDuplicate) return;
  const wanted = normalizeName(name);
  const wantedPhones = phones.map(normalizePhone).filter((p) => p.length > 0);
  const candidates = await supplierRepository.findLiveWithPhones(organizationId);
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const createContactRows = async (
  organizationId: string,
  supplierId: string,
  contacts: CreateContactInput[],
  tx: Prisma.TransactionClient,
): Promise<void> => {
  const flagged = contacts.findIndex((c) => c.isPrimary);
  const primaryIndex = flagged >= 0 ? flagged : 0;
  for (const [index, contact] of contacts.entries()) {
    await supplierContactRepository.create(
      organizationId,
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
    const organizationId = await requireHubActor(actor);
    const attendant = isAttendant(actor);
    const { suppliers, total } = await supplierRepository.findAllByOrganization(organizationId, {
      search: query.search,
      status: attendant ? 'ACTIVE' : query.status,
      type: query.type,
      categoryId: query.categoryId,
      includeArchived: query.includeRetired,
      page: query.page,
      perPage: query.perPage,
    });
    const pagination = {
      total,
      page: query.page,
      perPage: query.perPage,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
    return attendant
      ? { data: suppliers.map(serializeAttendantSupplier), pagination }
      : { data: suppliers.map(serializeSupplierBase), pagination };
  },

  getSupplierById: async (actor: Actor, id: string) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    const supplier = await supplierRepository.findDetailById(id, organizationId);
    if (!supplier) throw new NotFoundError('Supplier not found');
    return serializeSupplierDetail(supplier, canSeePaymentDetails(actor));
  },

  createSupplier: async (actor: Actor, input: CreateSupplierInput) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);

    const legacyName = input.contactName ?? null;
    const contacts: CreateContactInput[] =
      input.contacts && input.contacts.length > 0
        ? input.contacts
        : input.contactName || input.phone || input.email
          ? [{ name: legacyName || input.name, role: 'OTHER', phone: input.phone, email: input.email, isPrimary: true }]
          : [];

    await assertNoDuplicate(
      organizationId,
      input.name,
      contacts.map((c) => c.phone),
      input.confirmDuplicate,
    );

    const id = await prisma
      .$transaction(async (tx) => {
        const code = await referenceCounterRepository.nextReference(tx, organizationId, 'SUPPLIER', 4);
        const created = await supplierRepository.create(
          organizationId,
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
            address: input.address ?? input.location ?? '—',
            mapUrl: nullable(input.mapUrl),
            defaultPaymentTerms: input.defaultPaymentTerms,
            paymentDays: input.paymentDays,
            creditLimit: nullable(input.creditLimit),
            createdById: actor.id,
          },
          tx,
        );
        await createContactRows(organizationId, created.id, contacts, tx);
        return created.id;
      })
      .catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    return supplierService.getSupplierById(actor, id);
  },

  updateSupplier: async (actor: Actor, id: string, input: UpdateSupplierInput) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    const existing = await supplierRepository.findDetailById(id, organizationId);
    if (!existing) throw new NotFoundError('Supplier not found');

    if (input.name !== undefined && normalizeName(input.name) !== normalizeName(existing.name)) {
      await assertNoDuplicate(
        organizationId,
        input.name,
        existing.contacts.map((c) => c.phone),
        input.confirmDuplicate,
        id,
      );
    }

    const legacyContactTouched =
      input.contactName !== undefined || input.phone !== undefined || input.email !== undefined;

    await prisma.$transaction(async (tx) => {
      await supplierRepository.update(
        id,
        organizationId,
        {
          name: input.name,
          tradingName: input.tradingName,
          type: input.type,
          categoryId: input.categoryId,
          kraPin: input.kraPin,
          vatRegistered: input.vatRegistered,
          notes: input.notes,
          address: input.address ?? input.location ?? undefined,
          mapUrl: input.mapUrl,
          defaultPaymentTerms: input.defaultPaymentTerms,
          paymentDays: input.paymentDays,
          creditLimit: input.creditLimit,
          updatedById: actor.id,
        },
        tx,
      );

      if (legacyContactTouched) {
        const primary = existing.contacts.find((c) => c.isPrimary);
        if (primary) {
          await supplierContactRepository.update(
            primary.id,
            id,
            organizationId,
            {
              ...(input.contactName ? { name: input.contactName } : {}),
              ...(input.phone !== undefined ? { phone: input.phone } : {}),
              ...(input.email !== undefined ? { email: input.email } : {}),
            },
            tx,
          );
        } else if (input.contactName || input.phone || input.email) {
          await supplierContactRepository.create(
            organizationId,
            id,
            {
              name: input.contactName || input.name || existing.name,
              role: 'OTHER',
              phone: nullable(input.phone),
              whatsapp: null,
              email: nullable(input.email),
              isPrimary: true,
            },
            tx,
          );
        }
      }
    }).catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    return supplierService.getSupplierById(actor, id);
  },

  /** Store Manager and Attendant. Name + phone only; complete the record later. */
  quickAddSupplier: async (actor: Actor, input: QuickAddSupplierInput) => {
    const organizationId = await requireHubActor(actor);
    await assertNoDuplicate(organizationId, input.name, [input.phone], input.confirmDuplicate);

    const id = await prisma
      .$transaction(async (tx) => {
        const code = await referenceCounterRepository.nextReference(tx, organizationId, 'SUPPLIER', 4);
        const created = await supplierRepository.create(
          organizationId,
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
          organizationId,
          created.id,
          { name: input.name, role: 'OTHER', phone: input.phone, whatsapp: null, email: null, isPrimary: true },
          tx,
        );
        return created.id;
      })
      .catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    const created = await requireSupplier(id, organizationId);
    return isAttendant(actor) ? serializeAttendantSupplier(created) : serializeSupplierBase(created);
  },

  updateStatus: async (actor: Actor, id: string, input: UpdateSupplierStatusInput) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    const existing = await requireSupplier(id, organizationId);
    if (existing.status === input.status) {
      throw new ConflictError(`This supplier is already ${input.status}`, 'STATUS_UNCHANGED');
    }

    if (input.status === 'ARCHIVED') {
      const open = await supplierRepository.countOpenInvoices(id, organizationId);
      if (open > 0) {
        throw new ConflictError(
          'This supplier still has unpaid invoices and cannot be archived',
          'SUPPLIER_HAS_OPEN_INVOICES',
          { openInvoices: open },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await supplierRepository.setStatus(id, organizationId, input.status, actor.id, tx);
      if (input.status === 'ARCHIVED') await supplierRepository.clearPreferred(id, organizationId, tx);
      await supplierAuditRepository.create(
        organizationId,
        id,
        actor.id,
        'STATUS_CHANGED',
        id,
        { status: existing.status },
        { status: input.status, ...(input.reason ? { reason: input.reason } : {}) },
        tx,
      );
    }).catch((error: unknown) => mapPrismaError(error, { conflict: NAME_TAKEN }));

    return serializeSupplierBase(await requireSupplier(id, organizationId));
  },

  /** Legacy `DELETE /suppliers/:id` and `POST /suppliers/:id/restore`, as status changes. */
  retireSupplier: (actor: Actor, id: string) => supplierService.updateStatus(actor, id, { status: 'ARCHIVED' }),
  restoreSupplier: (actor: Actor, id: string) => supplierService.updateStatus(actor, id, { status: 'ACTIVE' }),

  // ── Contacts ─────────────────────────────────────────────────────────────

  listContacts: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    return (await supplierContactRepository.list(supplierId, organizationId)).map(serializeContact);
  },

  createContact: async (actor: Actor, supplierId: string, input: CreateContactInput) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const created = await prisma.$transaction(async (tx) => {
      const count = await supplierContactRepository.count(supplierId, organizationId, tx);
      const makePrimary = count === 0 || input.isPrimary === true;
      if (makePrimary) await supplierContactRepository.unsetPrimary(supplierId, organizationId, tx);
      return supplierContactRepository.create(
        organizationId,
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
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await supplierContactRepository.findById(contactId, supplierId, organizationId, tx);
      if (!existing) throw new NotFoundError('Contact not found');
      if (input.isPrimary === false && existing.isPrimary) {
        throw new ConflictError('Make another contact primary instead', 'PRIMARY_CONTACT_REQUIRED');
      }
      if (input.isPrimary === true && !existing.isPrimary) {
        await supplierContactRepository.unsetPrimary(supplierId, organizationId, tx);
      }
      await supplierContactRepository.update(
        contactId,
        supplierId,
        organizationId,
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
      return supplierContactRepository.findById(contactId, supplierId, organizationId, tx);
    });
    if (!updated) throw new NotFoundError('Contact not found');
    return serializeContact(updated);
  },

  deleteContact: async (actor: Actor, supplierId: string, contactId: string): Promise<void> => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const existing = await supplierContactRepository.findById(contactId, supplierId, organizationId);
    if (!existing) throw new NotFoundError('Contact not found');
    if (existing.isPrimary && (await supplierContactRepository.count(supplierId, organizationId)) > 1) {
      throw new ConflictError('Make another contact primary before deleting this one', 'PRIMARY_CONTACT_REQUIRED');
    }
    await supplierContactRepository.delete(contactId, supplierId, organizationId);
  },

  // ── Payment methods (audited) ────────────────────────────────────────────

  listPayMethods: async (actor: Actor, supplierId: string) => {
    if (!canSeePaymentDetails(actor)) throw new ForbiddenError('You cannot view supplier payment details');
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    return (await supplierPayMethodRepository.list(supplierId, organizationId)).map(serializePayMethod);
  },

  /** The only response that carries the full account number. */
  getPayMethod: async (actor: Actor, supplierId: string, methodId: string) => {
    if (!canSeePaymentDetails(actor)) throw new ForbiddenError('You cannot view supplier payment details');
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const method = await supplierPayMethodRepository.findById(methodId, supplierId, organizationId);
    if (!method) throw new NotFoundError('Payment method not found');
    return serializePayMethodDetail(method);
  },

  createPayMethod: async (actor: Actor, supplierId: string, input: CreatePayMethodInput) => {
    if (actor.role !== 'STORE_MANAGER' && actor.role !== 'ACCOUNTANT') {
      throw new ForbiddenError('You cannot edit supplier payment details');
    }
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const { isDefault, ...fields } = input;
    const data = toPayData(PayMethodFieldsSchema.parse(fields));

    const created = await prisma.$transaction(async (tx) => {
      const count = await supplierPayMethodRepository.count(supplierId, organizationId, tx);
      const makeDefault = count === 0 || isDefault === true;
      const previousDefault = makeDefault && count > 0
        ? await supplierPayMethodRepository.findDefault(supplierId, organizationId, tx)
        : null;
      if (makeDefault) await supplierPayMethodRepository.unsetDefault(supplierId, organizationId, tx);
      const row = await supplierPayMethodRepository.create(
        organizationId,
        supplierId,
        actor.id,
        { ...data, isDefault: makeDefault },
        tx,
      );
      await supplierAuditRepository.create(
        organizationId, supplierId, actor.id, 'PAY_METHOD_CREATED', row.id, null, asJson(auditSnapshot(row)), tx,
      );
      if (previousDefault) {
        await supplierAuditRepository.create(
          organizationId, supplierId, actor.id, 'PAY_METHOD_DEFAULT_CHANGED', row.id,
          { defaultMethodId: previousDefault.id }, { defaultMethodId: row.id }, tx,
        );
      }
      return row;
    });
    return serializePayMethod(created);
  },

  updatePayMethod: async (actor: Actor, supplierId: string, methodId: string, input: UpdatePayMethodInput) => {
    if (actor.role !== 'STORE_MANAGER' && actor.role !== 'ACCOUNTANT') {
      throw new ForbiddenError('You cannot edit supplier payment details');
    }
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await supplierPayMethodRepository.findById(methodId, supplierId, organizationId, tx);
      if (!existing) throw new NotFoundError('Payment method not found');
      if (input.isDefault === false && existing.isDefault) {
        throw new ConflictError('Make another payment method the default instead', 'DEFAULT_METHOD_REQUIRED');
      }

      const { isDefault, ...patch } = input;
      const merged = { ...existing, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
      const data = toPayData(PayMethodFieldsSchema.parse(merged));

      let previousDefaultId: string | null = null;
      if (isDefault === true && !existing.isDefault) {
        previousDefaultId = (await supplierPayMethodRepository.findDefault(supplierId, organizationId, tx))?.id ?? null;
        await supplierPayMethodRepository.unsetDefault(supplierId, organizationId, tx);
      }
      await supplierPayMethodRepository.update(
        methodId, supplierId, organizationId, { ...data, ...(isDefault === true ? { isDefault: true } : {}) }, tx,
      );
      const after = await supplierPayMethodRepository.findById(methodId, supplierId, organizationId, tx);
      if (!after) throw new NotFoundError('Payment method not found');

      await supplierAuditRepository.create(
        organizationId, supplierId, actor.id, 'PAY_METHOD_UPDATED', methodId,
        asJson(auditSnapshot(existing)), asJson(auditSnapshot(after)), tx,
      );
      if (isDefault === true && !existing.isDefault) {
        await supplierAuditRepository.create(
          organizationId, supplierId, actor.id, 'PAY_METHOD_DEFAULT_CHANGED', methodId,
          { defaultMethodId: previousDefaultId }, { defaultMethodId: methodId }, tx,
        );
      }
      return after;
    });
    return serializePayMethod(updated);
  },

  deletePayMethod: async (actor: Actor, supplierId: string, methodId: string): Promise<void> => {
    if (actor.role !== 'STORE_MANAGER' && actor.role !== 'ACCOUNTANT') {
      throw new ForbiddenError('You cannot edit supplier payment details');
    }
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    await prisma.$transaction(async (tx) => {
      const existing = await supplierPayMethodRepository.findById(methodId, supplierId, organizationId, tx);
      if (!existing) throw new NotFoundError('Payment method not found');
      if (existing.isDefault && (await supplierPayMethodRepository.count(supplierId, organizationId, tx)) > 1) {
        throw new ConflictError('Make another payment method the default before deleting this one', 'DEFAULT_METHOD_REQUIRED');
      }
      await supplierPayMethodRepository.delete(methodId, supplierId, organizationId, tx);
      await supplierAuditRepository.create(
        organizationId, supplierId, actor.id, 'PAY_METHOD_DELETED', methodId, asJson(auditSnapshot(existing)), null, tx,
      );
    });
  },

  // ── Catalog ──────────────────────────────────────────────────────────────

  listItems: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    return (await supplierItemRepository.list(supplierId, organizationId)).map(serializeSupplierItem);
  },

  putItem: async (actor: Actor, supplierId: string, inventoryItemId: string, input: PutSupplierItemInput) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const item = await supplierItemLookupRepository.findLiveItem(inventoryItemId, organizationId);
    if (!item) throw new NotFoundError('Inventory item not found');

    await prisma.$transaction(async (tx) => {
      await supplierItemRepository.upsert(
        organizationId,
        supplierId,
        inventoryItemId,
        {
          supplierItemName: nullable(input.supplierItemName),
          supplierItemCode: nullable(input.supplierItemCode),
          buyUnit: nullable(input.buyUnit) ?? item.buyUnit,
          packSize: nullable(input.packSize),
        },
        tx,
      );
      if (input.isPreferred === true) {
        await supplierItemRepository.applyPreferred(organizationId, inventoryItemId, supplierId, tx);
      } else if (input.isPreferred === false) {
        await supplierItemRepository.clearPreferredIfSupplier(organizationId, inventoryItemId, supplierId, tx);
      }
    });
    const rows = await supplierItemRepository.list(supplierId, organizationId);
    const found = rows.find((r) => r.inventoryItemId === inventoryItemId);
    if (!found) throw new NotFoundError('Catalog row not found');
    return serializeSupplierItem(found);
  },

  deleteItem: async (actor: Actor, supplierId: string, inventoryItemId: string): Promise<void> => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    await prisma.$transaction(async (tx) => {
      const existing = await supplierItemRepository.find(supplierId, inventoryItemId, organizationId, tx);
      if (!existing) throw new NotFoundError('Catalog row not found');
      await supplierItemRepository.clearPreferredIfSupplier(organizationId, inventoryItemId, supplierId, tx);
      await supplierItemRepository.delete(supplierId, inventoryItemId, organizationId, tx);
    });
  },

  // ── Documents ────────────────────────────────────────────────────────────

  /** Timeline (receipts, invoices, payments, disputes) mixed with uploads, newest first. */
  listDocuments: async (actor: Actor, supplierId: string, limit: number) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const [receipts, invoices, payments, uploads] = await Promise.all([
      supplierHistoryRepository.signedReceipts(supplierId, organizationId, limit),
      supplierHistoryRepository.invoices(supplierId, organizationId, limit),
      supplierHistoryRepository.payments(supplierId, organizationId, limit),
      supplierDocumentRepository.list(supplierId, organizationId, limit),
    ]);

    const entries = [
      ...receipts.flatMap((r) =>
        r.signedAt
          ? [{ kind: 'RECEIPT' as const, id: r.id, occurredAt: r.signedAt.toISOString(), title: 'Goods receipt signed', reference: r.reference, amount: r.receiptTotal.toString() }]
          : [],
      ),
      ...invoices.map((i) => ({ kind: 'INVOICE' as const, id: i.id, occurredAt: i.invoiceDate.toISOString(), title: 'Invoice recorded', reference: i.invoiceNumber, amount: i.amountBilled.toString() })),
      ...invoices.flatMap((i) =>
        i.disputeStatus
          ? [{ kind: 'DISPUTE' as const, id: i.id, occurredAt: i.updatedAt.toISOString(), title: i.disputeStatus === 'OPEN' ? 'Invoice disputed' : 'Dispute resolved', reference: i.invoiceNumber, amount: null }]
          : [],
      ),
      ...payments.map((p) => ({ kind: 'PAYMENT' as const, id: p.id, occurredAt: p.paidAt.toISOString(), title: p.reversalOfId ? 'Payment reversed' : 'Payment made', reference: p.reference, amount: p.amount.toString() })),
      ...uploads.map((d) => ({ kind: 'UPLOAD' as const, id: d.id, occurredAt: d.createdAt.toISOString(), title: d.fileName, reference: null, amount: null, document: serializeDocument(d) })),
    ];
    entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return entries.slice(0, limit);
  },

  uploadDocument: async (actor: Actor, supplierId: string, file: UploadedFile | undefined, input: UploadSupplierDocumentInput) => {
    requireReadAccess(actor);
    if (actor.role !== 'STORE_MANAGER' && actor.role !== 'ACCOUNTANT') {
      throw new ForbiddenError('You cannot upload supplier documents');
    }
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);

    if (!file) throw new ValidationError('A file is required');
    if (file.size > MAX_SUPPLIER_DOCUMENT_BYTES || file.buffer.length > MAX_SUPPLIER_DOCUMENT_BYTES) {
      throw new UnprocessableEntityError('File is larger than 10 MB', 'FILE_TOO_LARGE');
    }
    const detected = detectFileType(file.buffer);
    if (!detected) {
      throw new UnprocessableEntityError('Only images (JPEG, PNG, WebP) and PDFs are accepted', 'FILE_TYPE_NOT_ALLOWED');
    }
    if (input.goodsReceiptId && !(await supplierDocumentRepository.receiptBelongs(input.goodsReceiptId, supplierId, organizationId))) {
      throw new NotFoundError('Goods receipt not found for this supplier');
    }
    if (input.supplierInvoiceId && !(await supplierDocumentRepository.invoiceBelongs(input.supplierInvoiceId, supplierId, organizationId))) {
      throw new NotFoundError('Supplier invoice not found for this supplier');
    }

    const storage = getDocumentStorage();
    const id = randomUUID();
    const objectKey = `org/${organizationId}/suppliers/${supplierId}/${randomUUID()}`;
    await storage.putObject(objectKey, file.buffer, detected);
    try {
      const created = await supplierDocumentRepository.create(organizationId, supplierId, {
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
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const doc = await supplierDocumentRepository.findById(docId, supplierId, organizationId);
    if (!doc) throw new NotFoundError('Document not found');
    const signed = await getDocumentStorage().getSignedUrl(doc.objectKey, {
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      fileName: doc.fileName,
    });
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString(), fileName: doc.fileName };
  },

  deleteDocument: async (actor: Actor, supplierId: string, docId: string): Promise<void> => {
    if (actor.role !== 'STORE_MANAGER') throw new ForbiddenError('Only a Store Manager can delete supplier documents');
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const doc = await supplierDocumentRepository.findById(docId, supplierId, organizationId);
    if (!doc) throw new NotFoundError('Document not found');
    await supplierDocumentRepository.delete(docId, supplierId, organizationId);
    await getDocumentStorage()
      .deleteObject(doc.objectKey)
      .catch((error: unknown) => logger.error({ err: error, docId }, 'Failed to delete supplier document object'));
  },

  // ── Summary ──────────────────────────────────────────────────────────────

  getSummary: async (actor: Actor, supplierId: string) => {
    requireReadAccess(actor);
    const organizationId = await requireHubActor(actor);
    await requireSupplier(supplierId, organizationId);
    const [receipts, invoices] = await Promise.all([
      supplierHistoryRepository.summaryReceipts(supplierId, organizationId),
      supplierHistoryRepository.summaryInvoices(supplierId, organizationId),
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
