/**
 * Contract drift guard for the Suppliers expansion (plan §7): response shapes
 * are frozen, the attendant list is scanned for forbidden keys on the
 * serialized JSON, and the route role matrix is asserted against plan §4.
 */
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { supplierService } from './supplier-service';
import * as repos from './supplier-repository';
import { branchRepository } from '../../repositories/branch-repository';
import inventoryRouter from './inventory-routes';
import {
  AttendantSupplierSchema,
  SupplierContactSchema,
  SupplierDetailSchema,
  SupplierDocumentSchema,
  SupplierDownloadSchema,
  SupplierItemSchema,
  SupplierListRowSchema,
  SupplierPayMethodDetailSchema,
  SupplierPayMethodSchema,
  SupplierSchema,
  SupplierSummarySchema,
  SupplierTimelineEntrySchema,
} from './supplier-validators';
import {
  attendant,
  buildContact,
  buildPayMethod,
  buildSupplierRow,
  docId,
  hubOrgId,
  itemId,
  methodId,
  storeManager,
  supplierId,
} from './supplier-test-fixtures';

vi.mock('./item-history-repository', () => ({
  itemChangeRepository: { record: vi.fn(), list: vi.fn(), countAttendantCreatedSince: vi.fn() },
}));
vi.mock('./supplier-repository', async () => (await import('./supplier-test-fixtures')).supplierRepositoryMocks());
vi.mock('./receiving-repository', () => ({
  referenceCounterRepository: { nextReference: vi.fn() },
  goodsReceiptRepository: { findPackNotOnFileLines: vi.fn() },
}));
vi.mock('../../repositories/auth-repository', () => ({ authRepository: { findUserById: vi.fn() } }));
vi.mock('../../sockets/socket-service', () => ({ socketService: { emitChequeMethodAdded: vi.fn() } }));
vi.mock('../../services/fcm-service', () => ({ fcmService: { sendChequeMethodAddedPush: vi.fn() } }));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('./supplier-storage', async () => {
  const actual = await vi.importActual<typeof import('./supplier-storage')>('./supplier-storage');
  const storage = new actual.InMemoryDocumentStorage();
  return { ...actual, getDocumentStorage: () => storage };
});
vi.mock('../../config/database', () => ({ prisma: { $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn({})) } }));
// The router imports controllers that pull in the whole app; only routes/roles matter here.
vi.mock('./inventory-controller', () => ({ inventoryController: new Proxy({}, { get: () => vi.fn() }) }));

const keys = (o: object) => Object.keys(o).sort();

/** Keys an attendant must never see anywhere in a supplier response. */
const FORBIDDEN = /pay|account|bank|paybill|till|mpesa|kra|credit|document|terms|vat|notes|whatsapp|email|address/i;
const forbiddenKeys = (payload: unknown): string[] => {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (FORBIDDEN.test(key)) found.push(key);
        walk(value);
      }
    }
  };
  walk(JSON.parse(JSON.stringify(payload)));
  return found;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(repos.supplierRepository.findById).mockResolvedValue(buildSupplierRow() as never);
  vi.mocked(repos.supplierRepository.findDetailById).mockResolvedValue(buildSupplierRow() as never);
  vi.mocked(repos.supplierRepository.findLiveWithPhones).mockResolvedValue([]);
  vi.mocked(repos.supplierStripRepository.listForStripByIds).mockResolvedValue([]);
});

describe('suppliers contract — response shapes', () => {
  it('list rows satisfy SupplierListRowSchema (profileDone, owedAmount) and keep the deprecated legacy keys', async () => {
    vi.mocked(repos.supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const { data } = await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false });
    const row = SupplierListRowSchema.parse(data[0]);
    expect(keys(row)).toEqual(
      [
        'address', 'category', 'code', 'contactName', 'createdAt', 'defaultPaymentTerms', 'email', 'id', 'location',
        'mapUrl', 'name', 'owedAmount', 'paymentDays', 'phone', 'primaryContact', 'profileDone', 'retiredAt', 'status',
        'tradingName', 'type', 'updatedAt',
      ].sort(),
    );
    expect(SupplierSchema.safeParse(data[0]).success).toBe(true);
    // Legacy aliases derive from the primary contact / address.
    expect(row).toMatchObject({ contactName: 'Dattu', phone: '0722160400', email: 'dattu@example.com', location: 'Nyeri town', retiredAt: null });
  });

  it('an archived supplier reports retiredAt for the legacy UI', async () => {
    vi.mocked(repos.supplierRepository.findAllByOrganization).mockResolvedValue({
      suppliers: [buildSupplierRow({ status: 'ARCHIVED', deletedAt: new Date() })],
      total: 1,
    } as never);
    const { data } = await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: true });
    expect((data[0] as { retiredAt: string | null }).retiredAt).not.toBeNull();
  });

  it('detail satisfies SupplierDetailSchema with the extended keys', async () => {
    const detail = SupplierDetailSchema.parse(await supplierService.getSupplierById(storeManager, supplierId));
    expect(keys(detail)).toEqual(
      expect.arrayContaining(['kraPin', 'vatRegistered', 'notes', 'creditLimit', 'contacts', 'paymentMethods', 'createdBy', 'updatedBy']),
    );
    expect(detail.creditLimit).toBe('250000');
    expect(detail.paymentMethods[0]).toMatchObject({ accountNumberMasked: '••••6789' });
  });

  it('contacts, pay methods (masked + full), catalog rows, documents, summary and download satisfy their schemas', async () => {
    vi.mocked(repos.supplierContactRepository.list).mockResolvedValue([buildContact()] as never);
    SupplierContactSchema.array().parse(await supplierService.listContacts(storeManager, supplierId));

    vi.mocked(repos.supplierPayMethodRepository.list).mockResolvedValue([buildPayMethod()] as never);
    vi.mocked(repos.supplierPayMethodRepository.findById).mockResolvedValue(buildPayMethod() as never);
    const list = SupplierPayMethodSchema.array().parse(await supplierService.listPayMethods(storeManager, supplierId));
    expect(keys(list[0]!)).not.toContain('accountNumber');
    const one = SupplierPayMethodDetailSchema.parse(await supplierService.getPayMethod(storeManager, supplierId, methodId));
    expect(one.accountNumber).toBe('0170123456789');

    vi.mocked(repos.supplierItemRepository.list).mockResolvedValue([
      {
        id: '99999999-9999-4999-8999-999999999991',
        inventoryItemId: itemId, supplierItemName: 'Fresh milk', supplierItemCode: 'M1', buyUnit: 'crate',
        packSize: new Prisma.Decimal('12'), lastPrice: new Prisma.Decimal('2025'), lastPriceAt: new Date(), lastPriceSetBy: null, isPreferred: true,
        preferredNeedsConfirm: true,
        inventoryItem: { id: itemId, name: 'Milk', buyUnit: 'crate' },
      },
    ] as never);
    const [item] = SupplierItemSchema.array().parse(await supplierService.listItems(storeManager, supplierId));
    expect(item).toMatchObject({ lastPrice: '2025', packSize: '12', preferredNeedsConfirm: true }); // decimals cross the wire as strings

    const doc = {
      id: docId, objectKey: 'k', fileName: 'a.png', mimeType: 'image/png', sizeBytes: 5, docType: 'INVOICE',
      docDate: new Date('2026-09-01'), note: null, goodsReceiptId: null, supplierInvoiceId: null,
      uploadedBy: { id: '99999999-9999-4999-8999-999999999991', name: 'J' }, createdAt: new Date(),
    };
    vi.mocked(repos.supplierDocumentRepository.list).mockResolvedValue([doc] as never);
    vi.mocked(repos.supplierDocumentRepository.findById).mockResolvedValue(doc as never);
    vi.mocked(repos.supplierHistoryRepository.signedReceipts).mockResolvedValue([]);
    vi.mocked(repos.supplierHistoryRepository.invoices).mockResolvedValue([]);
    vi.mocked(repos.supplierHistoryRepository.payments).mockResolvedValue([]);
    const entries = SupplierTimelineEntrySchema.array().parse(await supplierService.listDocuments(storeManager, supplierId, 10));
    expect(entries[0]!.kind).toBe('UPLOAD');
    const parsedDoc = SupplierDocumentSchema.parse((entries[0] as { document: unknown }).document);
    expect(parsedDoc.docDate).toBe('2026-09-01');
    expect(JSON.stringify(entries)).not.toContain('objectKey');
    SupplierDownloadSchema.parse(await supplierService.getDocumentDownload(storeManager, supplierId, docId));

    vi.mocked(repos.supplierHistoryRepository.summaryReceipts).mockResolvedValue([]);
    vi.mocked(repos.supplierHistoryRepository.summaryInvoices).mockResolvedValue([]);
    SupplierSummarySchema.parse(await supplierService.getSummary(storeManager, supplierId));
  });
});

describe('suppliers contract — attendant blindness', () => {
  it('the attendant list carries only code, name, type and primary phone (serialized scan)', async () => {
    vi.mocked(repos.supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const response = await supplierService.listSuppliers(attendant, { page: 1, perPage: 20, includeRetired: false });

    expect(forbiddenKeys(response)).toEqual([]);
    expect(keys(response.data[0]!)).toEqual(['code', 'id', 'name', 'primaryPhone', 'type']);
    AttendantSupplierSchema.parse(response.data[0]);

    const text = JSON.stringify(response);
    for (const secret of ['P051234567X', '0170123456789', '250000', 'Equity Bank', 'Pays on 30 days']) {
      expect(text).not.toContain(secret);
    }
  });

  it('the attendant quick-add response is the same stripped row', async () => {
    vi.mocked(repos.supplierRepository.create).mockResolvedValue({ id: supplierId });
    const { referenceCounterRepository } = await import('./receiving-repository');
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0002');
    const created = await supplierService.quickAddSupplier(attendant, { name: 'New Vendor', phone: '0700000000' });
    expect(forbiddenKeys(created)).toEqual([]);
    AttendantSupplierSchema.parse(created);
  });

  it('control: the same scan does flag the full list (the scan really bites)', async () => {
    vi.mocked(repos.supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const full = await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false });
    expect(forbiddenKeys(full).length).toBeGreaterThan(0);
  });

  it('the supplier list never carries payment methods, KRA PIN or credit limit for any role', async () => {
    vi.mocked(repos.supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const full = await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false });
    const found = forbiddenKeys(full).filter((k) => /pay(?!ment(Terms|Days))|account|bank|kra|credit/i.test(k));
    expect(found).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Route role matrix — plan §4
// ---------------------------------------------------------------------------

const ALL_ROLES = [
  'SYSTEM_ADMIN', 'DIRECTOR', 'HR_MANAGER', 'MANAGER', 'ACCOUNTANT', 'WAITER', 'CHEF', 'BARISTA',
  'KITCHEN_DISPLAY', 'BARISTA_DISPLAY', 'STEWARD', 'HOUSEKEEPING', 'STORE_MANAGER', 'STORE_ATTENDANT', 'DEPARTMENT_HEAD',
];

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (...a: unknown[]) => unknown }[] } };

const allowedRoles = (method: string, path: string): string[] => {
  const layer = (inventoryRouter.stack as unknown as Layer[]).find(
    (l) => l.route && l.route.path === path && l.route.methods[method],
  );
  if (!layer?.route) throw new Error(`route not found: ${method} ${path}`);
  expect(layer.route.stack.length, `${method} ${path} needs middleware and a handler`).toBeGreaterThanOrEqual(2);
  const guard = layer.route.stack[0]!.handle;
  return ALL_ROLES.filter((role) => {
    const next = vi.fn() as unknown as NextFunction;
    try {
      guard({ user: { id: 'u', role, organizationId: hubOrgId } } as Request, {} as Response, next);
    } catch {
      return false;
    }
    return vi.mocked(next).mock.calls.length === 1;
  }).sort();
};

const SM = ['STORE_MANAGER'];
const READ = ['ACCOUNTANT', 'DIRECTOR', 'STORE_MANAGER'];
const SM_ACC = ['ACCOUNTANT', 'STORE_MANAGER'];
const P = '/inventory/suppliers';

describe('suppliers contract — route role matrix (plan §4)', () => {
  it.each([
    ['get', P, [...READ, 'STORE_ATTENDANT']],
    ['post', `${P}/quick`, [...SM, 'STORE_ATTENDANT']],
    ['get', `${P}/:id`, READ],
    ['post', P, SM],
    ['patch', `${P}/:id`, SM],
    ['patch', `${P}/:id/status`, SM],
    ['delete', `${P}/:id`, SM],
    ['post', `${P}/:id/restore`, SM],
    ['get', `${P}/:id/summary`, READ],
    ['get', `${P}/:id/contacts`, READ],
    ['post', `${P}/:id/contacts`, SM],
    ['patch', `${P}/:id/contacts/:cid`, SM],
    ['delete', `${P}/:id/contacts/:cid`, SM],
    ['get', `${P}/:id/payment-methods`, READ],
    ['get', `${P}/:id/payment-methods/history`, READ],
    ['get', `${P}/:id/payment-methods/:pid`, READ],
    ['post', `${P}/:id/payment-methods`, SM_ACC],
    ['patch', `${P}/:id/payment-methods/:pid`, SM_ACC],
    ['delete', `${P}/:id/payment-methods/:pid`, SM_ACC],
    ['get', `${P}/:id/items`, READ],
    ['put', `${P}/:id/items/:itemId`, SM],
    ['delete', `${P}/:id/items/:itemId`, SM],
    ['get', `${P}/:id/documents`, READ],
    ['post', `${P}/:id/documents`, SM_ACC],
    ['get', `${P}/:id/documents/:docId/download`, READ],
    ['delete', `${P}/:id/documents/:docId`, SM],
  ])('%s %s', (method, path, expected) => {
    expect(allowedRoles(method, path)).toEqual([...expected].sort());
  });

  it('registers /quick before /:id so it is never read as an id', () => {
    const order = (inventoryRouter.stack as unknown as Layer[])
      .filter((l) => l.route && l.route.methods['post'] || l.route?.methods['get'])
      .map((l) => l.route!.path);
    expect(order.indexOf(`${P}/quick`)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(`${P}/quick`)).toBeLessThan(order.indexOf(`${P}/:id`));
  });
});
