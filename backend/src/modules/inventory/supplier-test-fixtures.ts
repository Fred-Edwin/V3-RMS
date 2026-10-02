/** Shared fixtures + repository mock factory for the suppliers-expansion tests. */
import { vi } from 'vitest';
import { Prisma } from '@prisma/client';

export const hubOrgId = '11111111-1111-4111-8111-111111111111';
export const otherOrgId = '99999999-9999-4999-8999-999999999999';
export const supplierId = '55555555-5555-4555-8555-555555555555';
export const contactId = '66666666-6666-4666-8666-666666666666';
export const contactId2 = '66666666-6666-4666-8666-666666666667';
export const methodId = '77777777-7777-4777-8777-777777777777';
export const methodId2 = '77777777-7777-4777-8777-777777777778';
export const itemId = '33333333-3333-4333-8333-333333333333';
export const lineId = '99999999-9999-4999-8999-999999999991';
export const lineId2 = '99999999-9999-4999-8999-999999999992';
export const docId = '88888888-8888-4888-8888-888888888888';
export const categoryId = '44444444-4444-4444-8444-444444444444';

const actor = (role: string, id: string, organizationId = hubOrgId) => ({ id, role: role as never, organizationId });
export const storeManager = actor('STORE_MANAGER', 'sm1');
export const accountant = actor('ACCOUNTANT', 'acc1');
export const director = actor('DIRECTOR', 'dir1');
export const attendant = actor('STORE_ATTENDANT', 'att1');
export const waiter = actor('WAITER', 'w1');

const now = new Date('2026-09-30T08:00:00.000Z');

export const buildContact = (overrides: Record<string, unknown> = {}) => ({
  id: contactId,
  organizationId: hubOrgId,
  supplierId,
  name: 'Dattu',
  role: 'SALES_REP',
  phone: '0722160400',
  whatsapp: null,
  email: 'dattu@example.com',
  isPrimary: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

export const buildPayMethod = (overrides: Record<string, unknown> = {}) => ({
  id: methodId,
  organizationId: hubOrgId,
  supplierId,
  type: 'BANK_TRANSFER',
  bankName: 'Equity Bank',
  bankBranch: 'Nyeri',
  accountName: 'Samrat Supermarket Ltd',
  accountNumber: '0170123456789',
  paybillNumber: null,
  accountReference: null,
  tillNumber: null,
  phone: null,
  registeredName: null,
  note: null,
  isDefault: true,
  createdById: 'sm1',
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

/** A supplier catalog line as the repository returns it (with its item). */
export const buildCatalogLine = (overrides: Record<string, unknown> = {}) => ({
  id: lineId,
  organizationId: hubOrgId,
  supplierId,
  inventoryItemId: itemId,
  supplierItemName: null,
  supplierItemCode: null,
  buyUnit: 'crate',
  packSize: null,
  lastPrice: new Prisma.Decimal('2025'),
  lastPriceAt: now,
  isPreferred: false,
  preferredNeedsConfirm: false,
  createdAt: now,
  updatedAt: now,
  inventoryItem: { id: itemId, name: 'Milk', buyUnit: 'crate' },
  ...overrides,
});

export const buildSupplierRow = (overrides: Record<string, unknown> = {}) => ({
  id: supplierId,
  organizationId: hubOrgId,
  code: 'SUPPLIER-0001',
  name: 'Samrat Supermarket Ltd',
  tradingName: 'Samrat',
  status: 'ACTIVE',
  type: 'REGULAR',
  categoryId,
  kraPin: 'P051234567X',
  vatRegistered: true,
  notes: 'Pays on 30 days',
  address: 'Nyeri town',
  mapUrl: null,
  defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
  paymentDays: 30,
  creditLimit: new Prisma.Decimal('250000'),
  createdById: 'sm1',
  updatedById: 'sm1',
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  category: { id: categoryId, name: 'Dry items' },
  contacts: [buildContact()],
  payMethods: [buildPayMethod()],
  createdBy: { id: '12121212-1212-4212-8212-121212121212', name: 'Joseph' },
  updatedBy: { id: '12121212-1212-4212-8212-121212121212', name: 'Joseph' },
  ...overrides,
});

/** Every supplier repository export, mocked. */
export const supplierRepositoryMocks = () => ({
  supplierRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    findDetailById: vi.fn(),
    findLiveWithPhones: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
    countOpenInvoices: vi.fn(),
    clearPreferred: vi.fn(),
  },
  supplierContactRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    unsetPrimary: vi.fn(),
  },
  supplierPayMethodRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    findDefault: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    unsetDefault: vi.fn(),
    findHubAccountants: vi.fn(),
  },
  supplierAuditRepository: { create: vi.fn() },
  supplierItemRepository: {
    list: vi.fn(),
    listForItem: vi.fn(),
    listBySupplierItem: vi.fn(),
    listBySupplierItems: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findByKey: vi.fn(),
    findLineId: vi.fn(),
    createLine: vi.fn(),
    updateLine: vi.fn(),
    delete: vi.fn(),
    applyPreferred: vi.fn(),
    clearPreferredIfSupplier: vi.fn(),
    findLinesWithPrices: vi.fn(),
    setLinePrice: vi.fn(),
  },
  supplierDocumentRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    receiptBelongs: vi.fn(),
    invoiceBelongs: vi.fn(),
  },
  supplierHistoryRepository: {
    signedReceipts: vi.fn(),
    invoices: vi.fn(),
    payments: vi.fn(),
    summaryReceipts: vi.fn(),
    summaryInvoices: vi.fn(),
  },
  supplierItemLookupRepository: { findLiveItem: vi.fn() },
});
