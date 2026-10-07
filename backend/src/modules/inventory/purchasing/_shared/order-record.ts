import type { Prisma } from '@prisma/client';

/**
 * Everything the order view needs, loaded in one query by every Purchasing repository that returns an order. Keeping the
 * `include` here means orders, receiving and payables all hand `order-view.ts` the same shape.
 */
const person = { select: { id: true, name: true, role: true } } as const;

export const ORDER_INCLUDE = {
  supplier: {
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      kraPin: true,
      defaultPaymentTerms: true,
      paymentDays: true,
      contacts: { where: { isPrimary: true }, select: { name: true, phone: true, whatsapp: true }, take: 1 },
      payMethods: { select: { type: true, bankName: true, accountNumber: true, paybillNumber: true, tillNumber: true, phone: true, registeredName: true, isDefault: true } },
    },
  },
  raisedBy: person,
  approvedBy: person,
  returnedBy: person,
  cancelledBy: person,
  lines: { orderBy: { lineOrder: 'asc' }, include: { inventoryItem: { select: { name: true } } } },
  delivery: { include: { receivedBy: person, deliveryNoteFile: true, lines: true } },
  invoices: { orderBy: { enteredAt: 'asc' }, include: { enteredBy: person, settledBy: person, voidedBy: person, file: true } },
  payments: { orderBy: { recordedAt: 'asc' }, include: { recordedBy: person, approvedBy: person, proofFile: true } },
  documents: { orderBy: { addedAt: 'asc' }, include: { file: true, addedBy: person } },
  audit: { orderBy: { at: 'desc' }, include: { actor: person } },
} satisfies Prisma.PurchaseOrderInclude;

export type OrderRecord = Prisma.PurchaseOrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
