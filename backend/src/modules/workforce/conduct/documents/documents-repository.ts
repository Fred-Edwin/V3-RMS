import { prisma } from '../../../../config/database';

export interface StoredDocument {
  bytes: Buffer;
  hash: string;
}

/** Stored letters: insert-only. A copy is made once the receipt is final (or the notice is withdrawn) and is never rewritten. */
export const documentsRepository = {
  async find(noticeId: string, version: number, withdrawn: boolean): Promise<StoredDocument | null> {
    const row = await prisma.conductNoticeDocument.findUnique({ where: { noticeId_version_withdrawn: { noticeId, version, withdrawn } } });
    return row ? { bytes: Buffer.from(row.bytes), hash: row.hash } : null;
  },

  /** Two requests rendering together both try to store; the second is ignored (the first copy stands). */
  async store(noticeId: string, version: number, withdrawn: boolean, doc: StoredDocument): Promise<void> {
    await prisma.conductNoticeDocument.createMany({ data: [{ noticeId, version, withdrawn, bytes: doc.bytes, hash: doc.hash }], skipDuplicates: true });
  },
};
