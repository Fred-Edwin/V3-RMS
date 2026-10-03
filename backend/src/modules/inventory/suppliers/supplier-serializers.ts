/**
 * Pure serializers for the Suppliers read models. The service decides WHICH
 * serializer a role may use; nothing here reads the database.
 */
import type { SupplierContact, SupplierPayMethod } from '@prisma/client';
import type {
  SupplierDetailRow,
  SupplierWithRelations,
  SupplierItemRow,
  SupplierItemWithSupplier,
  SupplierDocumentRow,
} from './supplier-repository';

/** "••••4821" — never more than the last four characters. */
export const maskSensitive = (value: string | null): string | null => {
  if (value === null || value === '') return null;
  const tail = value.length > 4 ? value.slice(-4) : '';
  return `••••${tail}`;
};

export const serializeContact = (c: SupplierContact) => ({
  id: c.id,
  name: c.name,
  role: c.role,
  phone: c.phone,
  whatsapp: c.whatsapp,
  email: c.email,
  isPrimary: c.isPrimary,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

/** List/detail shape: the account number is masked. */
export const serializePayMethod = (m: SupplierPayMethod) => ({
  id: m.id,
  type: m.type,
  isDefault: m.isDefault,
  bankName: m.bankName,
  bankBranch: m.bankBranch,
  accountName: m.accountName,
  accountNumberMasked: maskSensitive(m.accountNumber),
  paybillNumber: m.paybillNumber,
  accountReference: m.accountReference,
  tillNumber: m.tillNumber,
  phone: m.phone,
  registeredName: m.registeredName,
  note: m.note,
  createdAt: m.createdAt.toISOString(),
  updatedAt: m.updatedAt.toISOString(),
});

/** Only the single-method GET returns the full account number. */
export const serializePayMethodDetail = (m: SupplierPayMethod) => ({
  ...serializePayMethod(m),
  accountNumber: m.accountNumber,
});

/** What the audit log stores: same fields, account number and wallet phone masked. */
export const auditSnapshot = (m: SupplierPayMethod) => ({
  type: m.type,
  isDefault: m.isDefault,
  bankName: m.bankName,
  bankBranch: m.bankBranch,
  accountName: m.accountName,
  accountNumber: maskSensitive(m.accountNumber),
  paybillNumber: m.paybillNumber,
  accountReference: m.accountReference,
  tillNumber: m.tillNumber,
  phone: m.type === 'MPESA_SEND_MONEY' ? maskSensitive(m.phone) : m.phone,
  registeredName: m.registeredName,
  note: m.note,
});

type SupplierBaseSource = SupplierWithRelations | SupplierDetailRow;

export const serializeSupplierBase = (supplier: SupplierBaseSource) => {
  const primary = supplier.contacts.find((c) => c.isPrimary) ?? null;
  return {
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    tradingName: supplier.tradingName,
    status: supplier.status,
    type: supplier.type,
    category: supplier.category,
    address: supplier.address,
    mapUrl: supplier.mapUrl,
    primaryContact: primary
      ? {
          id: primary.id,
          name: primary.name,
          role: primary.role,
          phone: primary.phone,
          whatsapp: primary.whatsapp,
          email: primary.email,
        }
      : null,
    defaultPaymentTerms: supplier.defaultPaymentTerms,
    paymentDays: supplier.paymentDays,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
};

export const serializeAttendantSupplier = (supplier: SupplierWithRelations) => ({
  id: supplier.id,
  code: supplier.code,
  name: supplier.name,
  type: supplier.type,
  primaryPhone: supplier.contacts.find((c) => c.isPrimary)?.phone ?? null,
});

export const serializeSupplierDetail = (supplier: SupplierDetailRow, includePaymentMethods: boolean) => ({
  ...serializeSupplierBase(supplier),
  kraPin: supplier.kraPin,
  vatRegistered: supplier.vatRegistered,
  notes: supplier.notes,
  creditLimit: supplier.creditLimit ? supplier.creditLimit.toString() : null,
  contacts: supplier.contacts.map(serializeContact),
  paymentMethods: includePaymentMethods ? supplier.payMethods.map(serializePayMethod) : [],
  createdBy: supplier.createdBy,
  updatedBy: supplier.updatedBy,
});

export const serializeSupplierItem = (row: SupplierItemRow) => ({
  id: row.id,
  inventoryItemId: row.inventoryItemId,
  itemName: row.inventoryItem.name,
  itemBuyUnit: row.inventoryItem.buyUnit,
  itemUsageUnit: row.inventoryItem.usageUnit,
  itemConversionFactor: row.inventoryItem.conversionFactor ? row.inventoryItem.conversionFactor.toString() : null,
  supplierItemName: row.supplierItemName,
  supplierItemCode: row.supplierItemCode,
  buyUnit: row.buyUnit,
  packSize: row.packSize ? row.packSize.toString() : null,
  lastPrice: row.lastPrice ? row.lastPrice.toString() : null,
  lastPriceAt: row.lastPriceAt ? row.lastPriceAt.toISOString() : null,
  lastPriceSetBy: row.lastPriceSetBy,
  isPreferred: row.isPreferred,
  preferredNeedsConfirm: row.preferredNeedsConfirm,
  // Filled in by the Catalog tab's list only (§30.11); null everywhere else a line is returned.
  lastReceipt: null as { id: string; reference: string } | null,
  priceAlert: null as { pct: string; previousPrice: string | null; previousAt: string | null } | null,
});

/** The item page's "who sells it" row: their name and code beside the supplier, ours stays the page title. */
export const serializeItemSupplierLine = (row: SupplierItemWithSupplier) => ({
  lineId: row.id,
  supplierId: row.supplier.id,
  supplierCode: row.supplier.code,
  supplierName: row.supplier.name,
  supplierItemName: row.supplierItemName,
  supplierItemCode: row.supplierItemCode,
  buyUnit: row.buyUnit,
  packSize: row.packSize ? row.packSize.toString() : null,
  lastPrice: row.lastPrice ? row.lastPrice.toString() : null,
  lastPriceAt: row.lastPriceAt ? row.lastPriceAt.toISOString() : null,
  lastPriceSetBy: row.lastPriceSetBy,
  isPreferred: row.isPreferred,
  preferredNeedsConfirm: row.preferredNeedsConfirm,
});

export const serializeDocument = (doc: SupplierDocumentRow) => ({
  id: doc.id,
  fileName: doc.fileName,
  mimeType: doc.mimeType,
  sizeBytes: doc.sizeBytes,
  docType: doc.docType,
  docDate: doc.docDate ? doc.docDate.toISOString().slice(0, 10) : null,
  note: doc.note,
  goodsReceiptId: doc.goodsReceiptId,
  supplierInvoiceId: doc.supplierInvoiceId,
  uploadedBy: doc.uploadedBy,
  createdAt: doc.createdAt.toISOString(),
});
