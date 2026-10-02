import type { Prisma, PrismaClient, SupplierPaymentTerms } from '@prisma/client';

type Client = PrismaClient | Prisma.TransactionClient;

export interface SeedSupplierInput {
  organizationId: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  categoryId?: string | null;
  defaultPaymentTerms?: SupplierPaymentTerms;
  paymentDays?: number;
}

/** Creates a supplier the way the service does: SUPPLIER-#### code plus a primary contact. */
export const createSeedSupplier = async (client: Client, input: SeedSupplierInput): Promise<{ id: string }> => {
  const counter = await client.referenceCounter.upsert({
    where: { organizationId_prefix: { organizationId: input.organizationId, prefix: 'SUPPLIER' } },
    update: { lastNumber: { increment: 1 } },
    create: { organizationId: input.organizationId, prefix: 'SUPPLIER', lastNumber: 1 },
    select: { lastNumber: true },
  });
  const supplier = await client.supplier.create({
    data: {
      organizationId: input.organizationId,
      code: `SUPPLIER-${String(counter.lastNumber).padStart(4, '0')}`,
      name: input.name,
      address: input.location?.trim() || '—',
      categoryId: input.categoryId ?? null,
      defaultPaymentTerms: input.defaultPaymentTerms ?? 'INVOICE_TO_FOLLOW',
      ...(input.paymentDays !== undefined ? { paymentDays: input.paymentDays } : {}),
    },
    select: { id: true },
  });
  if (input.contactName || input.phone || input.email) {
    await client.supplierContact.create({
      data: {
        organizationId: input.organizationId,
        supplierId: supplier.id,
        name: input.contactName || input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        isPrimary: true,
      },
    });
  }
  return supplier;
};
