import type { PurchaseFile } from '@prisma/client';
import type { FileRef } from './purchasing.types';

/** What the screens receive for any photo or PDF on a purchase file. The picture itself comes from a short-lived link. */
export const toFileRef = (file: Pick<PurchaseFile, 'id' | 'fileName' | 'sizeBytes'>): FileRef => ({
  id: file.id,
  fileName: file.fileName,
  size: file.sizeBytes,
  thumbnail: null,
});
