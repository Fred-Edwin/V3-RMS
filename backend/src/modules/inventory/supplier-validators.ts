/**
 * Suppliers expansion — request/response schemas (the frozen contract).
 * Plan: docs/features/inventory/suppliers-plan.md. Endpoints: docs/API_CONTRACT.md §27.
 *
 * Supersedes the Milestone One supplier schemas that lived in
 * `inventory-validators.ts` (moved here; the legacy read keys `contactName`,
 * `phone`, `email`, `location` and `retiredAt` are kept on `SupplierSchema`
 * as DEPRECATED aliases until the frontend session replaces the old screens).
 *
 * Wire-format rule (unchanged): every decimal crosses the wire as a string.
 */
import { z } from 'zod';
import {
  PaginationQuerySchema,
  nonNegativeDecimalSchema,
  positiveDecimalSchema,
  supplierPaymentTermsSchema,
  uuidSchema,
} from './inventory-validators';

const booleanQueryParamSchema = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'string' ? v === 'true' : v));

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const supplierStatusSchema = z.enum(['ACTIVE', 'ON_HOLD', 'ARCHIVED']);
export const supplierTypeSchema = z.enum(['REGULAR', 'OCCASIONAL', 'ONE_OFF', 'MARKET']);
export const supplierContactRoleSchema = z.enum(['SALES_REP', 'ACCOUNTS', 'DELIVERY', 'OWNER', 'OTHER']);
export const supplierPayMethodTypeSchema = z.enum([
  'BANK_TRANSFER',
  'MPESA_PAYBILL',
  'MPESA_TILL',
  'MPESA_SEND_MONEY',
  'CASH',
]);
export const supplierDocumentTypeSchema = z.enum([
  'INVOICE',
  'DELIVERY_NOTE',
  'RECEIPT',
  'PRICE_LIST',
  'CONTRACT',
  'TAX_DOCUMENT',
  'OTHER',
]);

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export const SupplierIdParamSchema = z.object({ id: z.string().uuid('id param must be a valid UUID') });
export const SupplierContactParamSchema = SupplierIdParamSchema.extend({ cid: z.string().uuid() });
export const SupplierPayMethodParamSchema = SupplierIdParamSchema.extend({ pid: z.string().uuid() });
export const SupplierItemParamSchema = SupplierIdParamSchema.extend({ itemId: z.string().uuid() });
export const SupplierDocumentParamSchema = SupplierIdParamSchema.extend({ docId: z.string().uuid() });

// ---------------------------------------------------------------------------
// Supplier — read models
// ---------------------------------------------------------------------------

const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const SupplierContactSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  role: supplierContactRoleSchema,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** List row and the base of every other supplier read. */
export const SupplierSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  tradingName: z.string().nullable(),
  status: supplierStatusSchema,
  type: supplierTypeSchema,
  category: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  address: z.string(),
  mapUrl: z.string().nullable(),
  primaryContact: z
    .object({
      id: uuidSchema,
      name: z.string(),
      role: supplierContactRoleSchema,
      phone: z.string().nullable(),
      whatsapp: z.string().nullable(),
      email: z.string().nullable(),
    })
    .nullable(),
  defaultPaymentTerms: supplierPaymentTermsSchema,
  paymentDays: z.number().int(),
  /** @deprecated derived from `primaryContact.name` — use `primaryContact`. */
  contactName: z.string().nullable(),
  /** @deprecated derived from `primaryContact.phone` — use `primaryContact`. */
  phone: z.string().nullable(),
  /** @deprecated derived from `primaryContact.email` — use `primaryContact`. */
  email: z.string().nullable(),
  /** @deprecated alias of `address`. */
  location: z.string().nullable(),
  /** @deprecated set when `status` is ARCHIVED — use `status`. */
  retiredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** Attendant-safe list row: no payment data, KRA PIN, credit limit, terms or documents. */
export const AttendantSupplierSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  type: supplierTypeSchema,
  primaryPhone: z.string().nullable(),
});

const maskedPayMethodShape = {
  id: uuidSchema,
  type: supplierPayMethodTypeSchema,
  isDefault: z.boolean(),
  bankName: z.string().nullable(),
  bankBranch: z.string().nullable(),
  accountName: z.string().nullable(),
  /** e.g. "••••4821"; the full number is only on the single-method GET. */
  accountNumberMasked: z.string().nullable(),
  paybillNumber: z.string().nullable(),
  accountReference: z.string().nullable(),
  tillNumber: z.string().nullable(),
  phone: z.string().nullable(),
  registeredName: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

export const SupplierPayMethodSchema = z.object(maskedPayMethodShape);
export const SupplierPayMethodDetailSchema = z.object({
  ...maskedPayMethodShape,
  accountNumber: z.string().nullable(),
});

const actorRefSchema = z.object({ id: uuidSchema, name: z.string() });

export const SupplierDetailSchema = SupplierSchema.extend({
  kraPin: z.string().nullable(),
  vatRegistered: z.boolean(),
  notes: z.string().nullable(),
  creditLimit: z.string().nullable(),
  contacts: z.array(SupplierContactSchema),
  paymentMethods: z.array(SupplierPayMethodSchema),
  createdBy: actorRefSchema.nullable(),
  updatedBy: actorRefSchema.nullable(),
});

export const SupplierItemSchema = z.object({
  inventoryItemId: uuidSchema,
  itemName: z.string(),
  itemBuyUnit: z.string(),
  supplierItemName: z.string().nullable(),
  supplierItemCode: z.string().nullable(),
  buyUnit: z.string().nullable(),
  packSize: z.string().nullable(),
  lastPrice: z.string().nullable(),
  lastPriceAt: z.string().datetime().nullable(),
  isPreferred: z.boolean(),
});

export const SupplierDocumentSchema = z.object({
  id: uuidSchema,
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  docType: supplierDocumentTypeSchema,
  docDate: z.string().nullable(), // YYYY-MM-DD
  note: z.string().nullable(),
  goodsReceiptId: uuidSchema.nullable(),
  supplierInvoiceId: uuidSchema.nullable(),
  uploadedBy: actorRefSchema,
  createdAt: z.string().datetime(),
});

const timelineBase = {
  occurredAt: z.string().datetime(),
  title: z.string(),
  reference: z.string().nullable(),
  amount: z.string().nullable(),
};

/** Receipts, invoices, payments and disputes (automatic) mixed with uploads, newest first. */
export const SupplierTimelineEntrySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('RECEIPT'), id: uuidSchema, ...timelineBase }),
  z.object({ kind: z.literal('INVOICE'), id: uuidSchema, ...timelineBase }),
  z.object({ kind: z.literal('PAYMENT'), id: uuidSchema, ...timelineBase }),
  z.object({ kind: z.literal('DISPUTE'), id: uuidSchema, ...timelineBase }),
  z.object({ kind: z.literal('UPLOAD'), id: uuidSchema, ...timelineBase, document: SupplierDocumentSchema }),
]);

export const SupplierDownloadSchema = z.object({
  url: z.string(),
  expiresAt: z.string().datetime(),
  fileName: z.string(),
});

export const SupplierSummarySchema = z.object({
  totalSpend: z.string(),
  lastPurchaseAt: z.string().datetime().nullable(),
  receiptsCount: z.number().int().min(0),
  /** Mean days from invoice date to the last payment, over fully paid invoices; null when none. */
  averageDaysToPay: z.number().nullable(),
  /** Lines on signed receipts that fired a price alert. */
  priceAlerts: z.number().int().min(0),
  /** Signed receipts (against an estimate) with at least one line received under the estimated quantity. */
  shortDeliveries: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Supplier — requests
// ---------------------------------------------------------------------------

export const ListSuppliersQuerySchema = PaginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: supplierStatusSchema.optional(),
  type: supplierTypeSchema.optional(),
  categoryId: uuidSchema.optional(),
  /** Legacy: with no `status`, false (default) hides ARCHIVED suppliers. */
  includeRetired: booleanQueryParamSchema.default(false),
});

const contactFields = {
  name: z.string().trim().min(1, 'Name is required').max(200),
  role: supplierContactRoleSchema.default('OTHER'),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z.string().trim().email('Must be a valid email address').max(200).nullish(),
};

export const CreateContactSchema = z.object({ ...contactFields, isPrimary: z.boolean().optional() });

export const UpdateContactSchema = z
  .object({
    name: contactFields.name.optional(),
    role: supplierContactRoleSchema.optional(),
    phone: optionalText(40),
    whatsapp: optionalText(40),
    email: contactFields.email,
    isPrimary: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'At least one field must be provided' });

const supplierWriteFields = {
  tradingName: optionalText(200),
  type: supplierTypeSchema,
  categoryId: uuidSchema.nullish(),
  kraPin: optionalText(40),
  vatRegistered: z.boolean(),
  notes: optionalText(2000),
  mapUrl: z.string().trim().url('Must be a valid link').max(500).nullish(),
  defaultPaymentTerms: supplierPaymentTermsSchema,
  paymentDays: z.number().int().positive().max(365),
  creditLimit: nonNegativeDecimalSchema.nullish(),
};

/**
 * DEPRECATED write aliases so the current UI keeps working: `location` → `address`,
 * `contactName` / `phone` / `email` → the primary contact.
 */
const legacyWriteFields = {
  location: optionalText(200),
  contactName: optionalText(200),
  phone: optionalText(40),
  email: z.string().trim().email('Must be a valid email address').max(200).nullish(),
};

export const CreateSupplierSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    address: z.string().trim().min(1).max(300).optional(),
    ...legacyWriteFields,
    ...supplierWriteFields,
    type: supplierWriteFields.type.default('REGULAR'),
    vatRegistered: supplierWriteFields.vatRegistered.default(false),
    defaultPaymentTerms: supplierWriteFields.defaultPaymentTerms.default('INVOICE_TO_FOLLOW'),
    paymentDays: supplierWriteFields.paymentDays.optional(),
    /** Optional at create; the first (or the one flagged `isPrimary`) becomes primary. */
    contacts: z.array(CreateContactSchema).max(20).optional(),
    /** Proceed even though a supplier with the same name and phone exists. */
    confirmDuplicate: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.address !== undefined ||
      d.location !== undefined ||
      d.contactName !== undefined ||
      d.phone !== undefined ||
      d.email !== undefined,
    { message: 'Address is required', path: ['address'] },
  );

/** Field-by-field (never `.partial()`): defaults must not overwrite stored values on PATCH. */
export const UpdateSupplierSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    ...legacyWriteFields,
    tradingName: supplierWriteFields.tradingName,
    type: supplierWriteFields.type.optional(),
    categoryId: supplierWriteFields.categoryId,
    kraPin: supplierWriteFields.kraPin,
    vatRegistered: supplierWriteFields.vatRegistered.optional(),
    notes: supplierWriteFields.notes,
    mapUrl: supplierWriteFields.mapUrl,
    defaultPaymentTerms: supplierWriteFields.defaultPaymentTerms.optional(),
    paymentDays: supplierWriteFields.paymentDays.optional(),
    creditLimit: supplierWriteFields.creditLimit,
    confirmDuplicate: z.boolean().optional(),
  })
  .refine((d) => Object.entries(d).some(([k, v]) => k !== 'confirmDuplicate' && v !== undefined), {
    message: 'At least one field must be provided',
  });

export const QuickAddSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().min(1, 'Phone is required').max(40),
  confirmDuplicate: z.boolean().optional(),
});

export const UpdateSupplierStatusSchema = z.object({
  status: supplierStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Payment methods — requests
// ---------------------------------------------------------------------------

const required = (label: string, max = 100) => z.string().trim().min(1, `${label} is required`).max(max);

/** Fields that belong to each type; anything else is dropped. */
export const PayMethodFieldsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BANK_TRANSFER'),
    bankName: required('Bank name'),
    bankBranch: optionalText(100),
    accountName: required('Account name'),
    accountNumber: required('Account number', 40),
  }),
  z.object({
    type: z.literal('MPESA_PAYBILL'),
    paybillNumber: required('Paybill number', 20),
    accountReference: optionalText(100),
  }),
  z.object({ type: z.literal('MPESA_TILL'), tillNumber: required('Till number', 20) }),
  z.object({
    type: z.literal('MPESA_SEND_MONEY'),
    phone: required('Phone', 40),
    registeredName: required('Registered name'),
  }),
  z.object({ type: z.literal('CASH') }),
]);

export const CreatePayMethodSchema = z.intersection(PayMethodFieldsSchema, z.object({ isDefault: z.boolean().optional() }));

/** `type` cannot change; the merged record is re-validated against its type in the service. */
export const UpdatePayMethodSchema = z
  .object({
    bankName: z.string().trim().max(100).nullish(),
    bankBranch: z.string().trim().max(100).nullish(),
    accountName: z.string().trim().max(100).nullish(),
    accountNumber: z.string().trim().max(40).nullish(),
    paybillNumber: z.string().trim().max(20).nullish(),
    accountReference: z.string().trim().max(100).nullish(),
    tillNumber: z.string().trim().max(20).nullish(),
    phone: z.string().trim().max(40).nullish(),
    registeredName: z.string().trim().max(100).nullish(),
    isDefault: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'At least one field must be provided' });

// ---------------------------------------------------------------------------
// Catalog + documents — requests
// ---------------------------------------------------------------------------

export const PutSupplierItemSchema = z.object({
  supplierItemName: optionalText(200),
  supplierItemCode: optionalText(100),
  buyUnit: optionalText(50),
  packSize: positiveDecimalSchema.nullish(),
  isPreferred: z.boolean().optional(),
});

/** Multipart text fields alongside the `file` part. */
export const UploadSupplierDocumentSchema = z.object({
  docType: supplierDocumentTypeSchema,
  docDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'docDate must be YYYY-MM-DD')
    .optional(),
  note: z.string().trim().max(500).optional(),
  goodsReceiptId: uuidSchema.optional(),
  supplierInvoiceId: uuidSchema.optional(),
});

export const ListSupplierDocumentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
