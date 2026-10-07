import { randomUUID } from 'crypto';
import type { Request } from 'express';
import type { PurchaseFile } from '@prisma/client';
import { blindnessOf } from '../../_shared/blind-rule';
import { requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { detectFileType, MAX_SUPPLIER_DOCUMENT_BYTES, sanitizeFileName, SIGNED_URL_TTL_SECONDS } from '../../suppliers/supplier-files';
import { getDocumentStorage } from '../../suppliers/supplier-storage';
import { ForbiddenError } from '../../../../utils/errors';
import { toFileRef } from '../_shared/file-ref';
import { purchasingError } from '../_shared/purchasing-errors';
import type { FileDownload, FileRef, UploadedFile } from './files.types';
import { purchaseFileRepository } from './files-repository';

type Actor = NonNullable<Request['user']>;

const EXTENSION = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as const;

export { toFileRef };

export const purchaseFileService = {
  /**
   * Store a photo or PDF for a purchase file. The type is read from the file's own bytes, never from its name. A storage
   * failure is the contract's 503 `UPLOAD_FAILED`, which the screens show as "Could not upload" with a Retry.
   */
  upload: async (actor: Actor, file: UploadedFile | undefined): Promise<FileRef> => {
    const siteId = await requireHubActor(actor);
    if (!file) throw purchasingError('VALIDATION', 'Choose a photo or a PDF to upload.');
    if (file.size > MAX_SUPPLIER_DOCUMENT_BYTES || file.buffer.length > MAX_SUPPLIER_DOCUMENT_BYTES) {
      throw purchasingError('UPLOAD_TOO_LARGE', 'That file is too large. The limit is 10 MB.');
    }
    const detected = detectFileType(file.buffer);
    if (!detected) throw purchasingError('UPLOAD_BAD_TYPE', 'Add a photo or a PDF.');

    const id = randomUUID();
    const objectKey = `org/${siteId}/purchasing/${id}.${EXTENSION[detected]}`;
    const storage = getDocumentStorage();
    try {
      await storage.putObject(objectKey, file.buffer, detected);
    } catch {
      throw purchasingError('UPLOAD_FAILED', 'The upload did not go through. Check the connection and try again.');
    }
    try {
      const created = await purchaseFileRepository.create(siteId, {
        id,
        objectKey,
        fileName: sanitizeFileName(file.originalname),
        mimeType: detected,
        sizeBytes: file.buffer.length,
        uploadedById: actor.id,
      });
      return toFileRef(created);
    } catch (error) {
      await storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  },

  /**
   * A short-lived link to view a file. An invoice photo or a proof of payment is financial data, so the blind rule keeps
   * it from a caller who may not see money (the Store Attendant); a delivery note photo stays open to them.
   */
  getDownload: async (actor: Actor, id: string): Promise<FileDownload> => {
    const siteId = await requireHubReader(actor);
    const use = await purchaseFileRepository.findUse(siteId, id);
    if (!use) throw purchasingError('ORDER_NOT_FOUND', 'That file does not exist.');
    if ((use.onInvoice || use.onPayment) && blindnessOf(actor).financials) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    const signed = await getDocumentStorage().getSignedUrl(use.file.objectKey, { expiresInSeconds: SIGNED_URL_TTL_SECONDS, fileName: use.file.fileName });
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString(), fileName: use.file.fileName };
  },

  /**
   * For the other folders: turn the file ids a request names into `FileRef`s, refusing an id that is not on this site.
   * A null id passes through as null.
   */
  resolve: async (siteId: string, id: string | null | undefined): Promise<PurchaseFile | null> => {
    if (!id) return null;
    const file = await purchaseFileRepository.findById(siteId, id);
    if (!file) throw purchasingError('VALIDATION', 'That file was not found. Add it again.');
    return file;
  },
};
