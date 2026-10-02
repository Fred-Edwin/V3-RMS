/** Upload / download rules for supplier documents (plan §7 "Upload tests"). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supplierService } from './supplier-service';
import { supplierDocumentRepository, supplierHistoryRepository, supplierRepository } from './supplier-repository';
import { InMemoryDocumentStorage, getDocumentStorage } from './supplier-storage';
import { MAX_SUPPLIER_DOCUMENT_BYTES, SIGNED_URL_TTL_SECONDS } from './supplier-files';
import { branchRepository } from '../../repositories/branch-repository';
import { ForbiddenError, NotFoundError } from '../../utils/errors';
import {
  accountant,
  attendant,
  buildSupplierRow,
  director,
  docId,
  hubOrgId,
  storeManager,
  supplierId,
  waiter,
} from './supplier-test-fixtures';

vi.mock('./supplier-repository', async () => (await import('./supplier-test-fixtures')).supplierRepositoryMocks());
vi.mock('./receiving-repository', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('./supplier-storage', async () => ({
  ...(await vi.importActual<typeof import('./supplier-storage')>('./supplier-storage')),
  getDocumentStorage: vi.fn(),
}));
vi.mock('../../config/database', () => ({ prisma: { $transaction: vi.fn() } }));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const file = (buffer: Buffer, originalname = 'scan.png') => ({ originalname, size: buffer.length, buffer });
const meta = { docType: 'INVOICE' as const };

let storage: InMemoryDocumentStorage;

const docRow = (overrides: Record<string, unknown> = {}) => ({
  id: docId,
  objectKey: `org/${hubOrgId}/suppliers/${supplierId}/abc`,
  fileName: 'scan.png',
  mimeType: 'image/png',
  sizeBytes: 72,
  docType: 'INVOICE',
  docDate: null,
  note: null,
  goodsReceiptId: null,
  supplierInvoiceId: null,
  uploadedBy: { id: 'sm1', name: 'Joseph' },
  createdAt: new Date('2026-09-30T08:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  storage = new InMemoryDocumentStorage();
  vi.mocked(getDocumentStorage).mockReturnValue(storage);
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierRow() as never);
  vi.mocked(supplierDocumentRepository.create).mockImplementation(async (_o, _s, data) => docRow({ ...data }) as never);
});

describe('uploadDocument', () => {
  it('stores an image under org/<orgId>/suppliers/<supplierId>/<uuid>, typed from content not the name', async () => {
    const result = await supplierService.uploadDocument(storeManager, supplierId, file(PNG, 'invoice.pdf'), meta);

    const [key] = [...storage.objects.keys()];
    expect(key).toMatch(new RegExp(`^org/${hubOrgId}/suppliers/${supplierId}/[0-9a-f-]{36}$`));
    expect(storage.objects.get(key!)!.contentType).toBe('image/png');
    expect(result.mimeType).toBe('image/png');
    expect(JSON.stringify(result)).not.toContain(key!); // the object key never leaves the server
  });

  it('accepts a PDF from the Accountant', async () => {
    await supplierService.uploadDocument(accountant, supplierId, file(Buffer.from('%PDF-1.4 x'), 'a.pdf'), meta);
    expect(storage.objects.size).toBe(1);
  });

  it('rejects a disguised executable with 422 and stores nothing', async () => {
    await expect(
      supplierService.uploadDocument(storeManager, supplierId, file(Buffer.from('MZ\x90\x00binary'), 'invoice.pdf'), meta),
    ).rejects.toMatchObject({ statusCode: 422, code: 'FILE_TYPE_NOT_ALLOWED' });
    expect(storage.objects.size).toBe(0);
    expect(supplierDocumentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a file over 10 MB with 422', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_SUPPLIER_DOCUMENT_BYTES)]);
    await expect(supplierService.uploadDocument(storeManager, supplierId, file(big), meta)).rejects.toMatchObject({
      statusCode: 422,
      code: 'FILE_TOO_LARGE',
    });
    expect(storage.objects.size).toBe(0);
  });

  it('requires a file part', async () => {
    await expect(supplierService.uploadDocument(storeManager, supplierId, undefined, meta)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('404s for a supplier outside the org and stores nothing', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    await expect(supplierService.uploadDocument(storeManager, supplierId, file(PNG), meta)).rejects.toThrow(NotFoundError);
    expect(storage.objects.size).toBe(0);
  });

  it('refuses to link a receipt that belongs to another supplier', async () => {
    vi.mocked(supplierDocumentRepository.receiptBelongs).mockResolvedValue(false);
    await expect(
      supplierService.uploadDocument(storeManager, supplierId, file(PNG), {
        ...meta,
        goodsReceiptId: '12121212-1212-4212-8212-121212121212',
      }),
    ).rejects.toThrow(NotFoundError);
    expect(storage.objects.size).toBe(0);
  });

  it.each([
    ['director', director],
    ['attendant', attendant],
    ['waiter', waiter],
  ])('%s cannot upload', async (_n, who) => {
    await expect(supplierService.uploadDocument(who, supplierId, file(PNG), meta)).rejects.toThrow(ForbiddenError);
    expect(storage.objects.size).toBe(0);
  });

  it('removes the stored object when the database write fails', async () => {
    vi.mocked(supplierDocumentRepository.create).mockRejectedValue(new Error('db down'));
    await expect(supplierService.uploadDocument(storeManager, supplierId, file(PNG), meta)).rejects.toThrow('db down');
    expect(storage.objects.size).toBe(0);
  });
});

describe('getDocumentDownload', () => {
  it.each([
    ['store manager', storeManager],
    ['accountant', accountant],
    ['director', director],
  ])('%s gets a short-lived signed URL', async (_n, who) => {
    vi.mocked(supplierDocumentRepository.findById).mockResolvedValue(docRow() as never);
    const before = Date.now();
    const result = await supplierService.getDocumentDownload(who, supplierId, docId);
    expect(result.url).toContain(`org/${hubOrgId}/suppliers/${supplierId}/abc`);
    expect(new Date(result.expiresAt).getTime() - before).toBeLessThanOrEqual(SIGNED_URL_TTL_SECONDS * 1000 + 1000);
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(600);
  });

  it.each([
    ['attendant', attendant],
    ['waiter', waiter],
  ])('%s never receives a signed URL', async (_n, who) => {
    vi.mocked(supplierDocumentRepository.findById).mockResolvedValue(docRow() as never);
    const spy = vi.spyOn(storage, 'getSignedUrl');
    await expect(supplierService.getDocumentDownload(who, supplierId, docId)).rejects.toThrow(ForbiddenError);
    expect(spy).not.toHaveBeenCalled();
  });

  it('cross-org: the supplier is not visible, so no URL is issued', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    const spy = vi.spyOn(storage, 'getSignedUrl');
    await expect(supplierService.getDocumentDownload(storeManager, supplierId, docId)).rejects.toThrow(NotFoundError);
    expect(spy).not.toHaveBeenCalled();
    expect(supplierDocumentRepository.findById).not.toHaveBeenCalled();
  });

  it('a non-hub actor is refused before any lookup', async () => {
    await expect(
      supplierService.getDocumentDownload({ ...storeManager, organizationId: 'other-org' }, supplierId, docId),
    ).rejects.toThrow(ForbiddenError);
    expect(supplierRepository.findById).not.toHaveBeenCalled();
  });

  it("a document that is not this supplier's is a 404", async () => {
    vi.mocked(supplierDocumentRepository.findById).mockResolvedValue(null);
    await expect(supplierService.getDocumentDownload(storeManager, supplierId, docId)).rejects.toThrow(NotFoundError);
  });

  it('every document lookup is org- and supplier-scoped', async () => {
    vi.mocked(supplierDocumentRepository.findById).mockResolvedValue(docRow() as never);
    await supplierService.getDocumentDownload(storeManager, supplierId, docId);
    expect(supplierDocumentRepository.findById).toHaveBeenCalledWith(docId, supplierId, hubOrgId);
  });
});

describe('deleteDocument', () => {
  it('lets only the Store Manager delete, removing the row and the object', async () => {
    vi.mocked(supplierDocumentRepository.findById).mockResolvedValue(docRow() as never);
    vi.mocked(supplierDocumentRepository.delete).mockResolvedValue(1);
    const spy = vi.spyOn(storage, 'deleteObject');
    await supplierService.deleteDocument(storeManager, supplierId, docId);
    expect(supplierDocumentRepository.delete).toHaveBeenCalledWith(docId, supplierId, hubOrgId);
    expect(spy).toHaveBeenCalledWith(`org/${hubOrgId}/suppliers/${supplierId}/abc`);

    await expect(supplierService.deleteDocument(accountant, supplierId, docId)).rejects.toThrow(ForbiddenError);
  });
});

describe('listDocuments', () => {
  it('mixes the automatic history with uploads, newest first', async () => {
    vi.mocked(supplierHistoryRepository.signedReceipts).mockResolvedValue([
      { id: 'r1', reference: 'GRN-0001', signedAt: new Date('2026-09-02T00:00:00Z'), receiptTotal: { toString: () => '900' } },
    ] as never);
    vi.mocked(supplierHistoryRepository.invoices).mockResolvedValue([
      {
        id: 'i1', invoiceNumber: 'INV-1', invoiceDate: new Date('2026-09-03T00:00:00Z'), amountBilled: { toString: () => '900' },
        disputeStatus: 'OPEN', disputeReason: 'short', updatedAt: new Date('2026-09-05T00:00:00Z'),
      },
    ] as never);
    vi.mocked(supplierHistoryRepository.payments).mockResolvedValue([
      { id: 'p1', paidAt: new Date('2026-09-04T00:00:00Z'), amount: { toString: () => '900' }, method: 'BANK', reference: 'EFT-1', reversalOfId: null },
    ] as never);
    vi.mocked(supplierDocumentRepository.list).mockResolvedValue([docRow({ createdAt: new Date('2026-09-06T00:00:00Z') })] as never);

    const entries = await supplierService.listDocuments(storeManager, supplierId, 100);
    expect(entries.map((e) => e.kind)).toEqual(['UPLOAD', 'DISPUTE', 'PAYMENT', 'INVOICE', 'RECEIPT']);
  });
});
