import { prisma } from '../../../config/database';
import { withdrawDocument, registerDocument } from '../_shared/documents/register-document';
import type { IssuedDocument } from '../_shared/documents/documents.types';

export const reconcileRepository = {
  companies: () => prisma.company.findMany({ where: { isActive: true }, select: { id: true } }),

  /** One document, one transaction: a document that cannot be registered never blocks the others. */
  registerOne: (doc: IssuedDocument): Promise<boolean> =>
    prisma.$transaction(async (tx) => {
      const registered = await registerDocument(tx, doc.input);
      if (doc.withdrawn) await withdrawDocument(tx, { companyId: doc.input.companyId, number: doc.input.number, byRole: doc.withdrawn.byRole, at: doc.withdrawn.at });
      return registered.created;
    }),
};
