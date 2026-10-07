import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseFile } from '@prisma/client';
import { branchRepository } from '../../../../repositories/branch-repository';
import { ForbiddenError } from '../../../../utils/errors';
import { InMemoryDocumentStorage, getDocumentStorage } from '../../suppliers/supplier-storage';
import { purchaseFileRepository } from './files-repository';
import { purchaseFileService, toFileRef } from './files-service';

vi.mock('./files-repository', () => ({
  purchaseFileRepository: { create: vi.fn(), findById: vi.fn(), findManyByIds: vi.fn(), findUse: vi.fn() },
}));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../suppliers/supplier-storage', async () => ({
  ...(await vi.importActual<typeof import('../../suppliers/supplier-storage')>('../../suppliers/supplier-storage')),
  getDocumentStorage: vi.fn(),
}));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

const HUB = 'hub-1';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const file = (buffer: Buffer, originalname = 'note.png') => ({ originalname, size: buffer.length, buffer });

const attendant = { id: 'att1', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const accountant = { id: 'acc1', role: 'ACCOUNTANT', siteId: HUB } as never;
const branchActor = { id: 'b1', role: 'STORE_MANAGER', siteId: 'branch-9' } as never;

const row = (over: Partial<PurchaseFile> = {}): PurchaseFile => ({
  id: 'f1',
  siteId: HUB,
  objectKey: `org/${HUB}/purchasing/f1.png`,
  fileName: 'note.png',
  mimeType: 'image/png',
  sizeBytes: 72,
  uploadedById: 'att1',
  createdAt: new Date('2026-10-06T08:00:00Z'),
  ...over,
});

let storage: InMemoryDocumentStorage;

beforeEach(() => {
  vi.clearAllMocks();
  storage = new InMemoryDocumentStorage();
  vi.mocked(getDocumentStorage).mockReturnValue(storage);
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(purchaseFileRepository.create).mockImplementation(async (_s, d) => row({ id: d.id, objectKey: d.objectKey, fileName: d.fileName, sizeBytes: d.sizeBytes }));
});

describe('upload', () => {
  it('stores an image and returns a FileRef with no thumbnail', async () => {
    const ref = await purchaseFileService.upload(attendant, file(PNG));
    expect(ref).toMatchObject({ fileName: 'note.png', size: PNG.length, thumbnail: null });
    expect(storage.objects.size).toBe(1);
    expect(purchaseFileRepository.create).toHaveBeenCalledWith(HUB, expect.objectContaining({ mimeType: 'image/png', uploadedById: 'att1' }));
  });

  it('reads the type from the bytes, not the name', async () => {
    await expect(purchaseFileService.upload(attendant, file(Buffer.from('not an image'), 'note.png'))).rejects.toMatchObject({ code: 'UPLOAD_BAD_TYPE', statusCode: 422 });
    expect(storage.objects.size).toBe(0);
  });

  it('refuses a file over 10 MB', async () => {
    const big = { originalname: 'big.png', size: 11 * 1024 * 1024, buffer: PNG };
    await expect(purchaseFileService.upload(attendant, big)).rejects.toMatchObject({ code: 'UPLOAD_TOO_LARGE', statusCode: 422 });
  });

  it('asks for a file when none is sent', async () => {
    await expect(purchaseFileService.upload(attendant, undefined)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('turns a storage failure into the retry state (503 UPLOAD_FAILED) and saves no row', async () => {
    vi.spyOn(storage, 'putObject').mockRejectedValueOnce(new Error('network'));
    await expect(purchaseFileService.upload(attendant, file(PNG))).rejects.toMatchObject({ code: 'UPLOAD_FAILED', statusCode: 503 });
    expect(purchaseFileRepository.create).not.toHaveBeenCalled();
  });

  it('removes the stored object when the database write fails', async () => {
    vi.mocked(purchaseFileRepository.create).mockRejectedValueOnce(new Error('db down'));
    await expect(purchaseFileService.upload(attendant, file(PNG))).rejects.toThrow('db down');
    expect(storage.objects.size).toBe(0);
  });

  it('refuses an actor outside the hub (D-15)', async () => {
    await expect(purchaseFileService.upload(branchActor, file(PNG))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('getDownload (blind rule)', () => {
  it('gives the Attendant a delivery note photo', async () => {
    vi.mocked(purchaseFileRepository.findUse).mockResolvedValue({ file: row(), onInvoice: false, onPayment: false });
    const link = await purchaseFileService.getDownload(attendant, 'f1');
    expect(link).toMatchObject({ fileName: 'note.png' });
    expect(link.url).toContain('memory://');
  });

  it('keeps an invoice photo from the Attendant', async () => {
    vi.mocked(purchaseFileRepository.findUse).mockResolvedValue({ file: row(), onInvoice: true, onPayment: false });
    await expect(purchaseFileService.getDownload(attendant, 'f1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('keeps a proof of payment from the Attendant', async () => {
    vi.mocked(purchaseFileRepository.findUse).mockResolvedValue({ file: row(), onInvoice: false, onPayment: true });
    await expect(purchaseFileService.getDownload(attendant, 'f1')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('gives the Accountant an invoice photo', async () => {
    vi.mocked(purchaseFileRepository.findUse).mockResolvedValue({ file: row(), onInvoice: true, onPayment: false });
    await expect(purchaseFileService.getDownload(accountant, 'f1')).resolves.toMatchObject({ fileName: 'note.png' });
  });

  it('says not found for a file on another site', async () => {
    vi.mocked(purchaseFileRepository.findUse).mockResolvedValue(null);
    await expect(purchaseFileService.getDownload(accountant, 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('resolve and toFileRef', () => {
  it('passes a null id through and refuses an unknown one', async () => {
    await expect(purchaseFileService.resolve(HUB, null)).resolves.toBeNull();
    vi.mocked(purchaseFileRepository.findById).mockResolvedValue(null);
    await expect(purchaseFileService.resolve(HUB, 'x')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('maps a row to the wire shape', () => {
    expect(toFileRef(row())).toEqual({ id: 'f1', fileName: 'note.png', size: 72, thumbnail: null });
  });
});
