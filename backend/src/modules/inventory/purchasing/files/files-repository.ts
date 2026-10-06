/** Purchasing files: database access only. Every query carries `siteId` (column `organization_id`). */
import type { PurchaseFile } from '@prisma/client';
import { prisma } from '../../../../config/database';

export interface CreateFileData {
  id: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
}

/** Where a file is attached, so the service can keep money documents from a caller who may not see money. */
export interface FileUse {
  file: PurchaseFile;
  onInvoice: boolean;
  onPayment: boolean;
}

export const purchaseFileRepository = {
  create: (siteId: string, data: CreateFileData): Promise<PurchaseFile> => prisma.purchaseFile.create({ data: { siteId, ...data } }),

  findById: (siteId: string, id: string): Promise<PurchaseFile | null> => prisma.purchaseFile.findFirst({ where: { id, siteId } }),

  /** The files that exist on this site out of `ids`: lets a service refuse an id from another site in one query. */
  findManyByIds: (siteId: string, ids: readonly string[]): Promise<PurchaseFile[]> =>
    prisma.purchaseFile.findMany({ where: { siteId, id: { in: [...ids] } } }),

  findUse: async (siteId: string, id: string): Promise<FileUse | null> => {
    const row = await prisma.purchaseFile.findFirst({
      where: { id, siteId },
      include: { _count: { select: { invoices: true, paymentProofs: true } } },
    });
    if (!row) return null;
    const { _count, ...file } = row;
    return { file, onInvoice: _count.invoices > 0, onPayment: _count.paymentProofs > 0 };
  },
};
