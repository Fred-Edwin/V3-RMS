/**
 * Supplier-facing documents for an expected delivery (API_CONTRACT §28.6): the LPO print data and
 * the WhatsApp message body. The supplier's own name and code lead, our item name comes second
 * ("Our item: …"), and a line with no supplier name falls back to ours. Pure: no database access.
 */
import { Prisma } from '@prisma/client';

export type PurchaseDocumentLineInput = {
  itemName: string;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  quantity: Prisma.Decimal.Value;
  buyUnit: string;
  estimatedUnitPrice: Prisma.Decimal.Value;
};

export type PurchaseDocumentInput = {
  reference: string;
  createdAt: Date;
  expectedDate: Date | null;
  estimatedTotal: Prisma.Decimal.Value;
  supplier: {
    id: string;
    code: string;
    name: string;
    address: string;
    contactName: string | null;
    phone: string | null;
    whatsapp: string | null;
  };
  lines: PurchaseDocumentLineInput[];
};

const dateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const blankToNull = (value: string | null): string | null => (value && value.trim() !== '' ? value.trim() : null);

export const buildPurchaseDocument = (input: PurchaseDocumentInput) => {
  const lines = input.lines.map((line, index) => {
    const theirName = blankToNull(line.supplierItemName);
    const theirCode = blankToNull(line.supplierItemCode);
    const quantity = new Prisma.Decimal(line.quantity);
    const unitPrice = new Prisma.Decimal(line.estimatedUnitPrice);
    return {
      lineNo: index + 1,
      itemName: line.itemName,
      supplierItemName: theirName,
      supplierItemCode: theirCode,
      displayName: theirName ?? line.itemName,
      displayCode: theirCode,
      ourItemLabel: theirName ? `Our item: ${line.itemName}` : null,
      quantity: quantity.toString(),
      buyUnit: line.buyUnit,
      estimatedUnitPrice: unitPrice.toString(),
      lineTotal: quantity.times(unitPrice).toFixed(2),
    };
  });

  const lpo = {
    reference: input.reference,
    createdAt: input.createdAt.toISOString(),
    expectedDate: input.expectedDate ? input.expectedDate.toISOString() : null,
    supplier: {
      id: input.supplier.id,
      code: input.supplier.code,
      name: input.supplier.name,
      address: input.supplier.address,
      contactName: input.supplier.contactName,
      phone: input.supplier.phone,
    },
    lines,
    estimatedTotal: new Prisma.Decimal(input.estimatedTotal).toFixed(2),
  };

  const bodyLines = lines.flatMap((line) => [
    `${line.lineNo}. ${line.displayName}${line.displayCode ? ` (${line.displayCode})` : ''} — ${line.quantity} ${line.buyUnit}`,
    ...(line.ourItemLabel ? [`   ${line.ourItemLabel}`] : []),
  ]);
  const body = [
    `Hello ${input.supplier.contactName ?? input.supplier.name}, order ${input.reference}:`,
    ...bodyLines,
    ...(input.expectedDate ? [`Needed by ${dateOnly(input.expectedDate)}.`] : []),
    'Please confirm availability. Thank you.',
  ].join('\n');

  return { lpo, whatsapp: { to: input.supplier.whatsapp ?? input.supplier.phone, body } };
};
