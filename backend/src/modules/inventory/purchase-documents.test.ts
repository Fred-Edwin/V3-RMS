import { describe, expect, it } from 'vitest';
import { buildPurchaseDocument, type PurchaseDocumentInput } from './purchase-documents';

const base = (lines: PurchaseDocumentInput['lines']): PurchaseDocumentInput => ({
  reference: 'EXP-0091',
  createdAt: new Date('2026-10-02T08:00:00.000Z'),
  expectedDate: new Date('2026-10-05T00:00:00.000Z'),
  estimatedTotal: '5450',
  supplier: {
    id: 's1',
    code: 'SUPPLIER-0003',
    name: 'Samrat Wholesalers',
    address: 'Nyeri town',
    contactName: 'Asha',
    phone: '0712000111',
    whatsapp: '0712000222',
  },
  lines,
});

describe('buildPurchaseDocument (B7)', () => {
  const sugar = {
    itemName: 'Sugar white',
    supplierItemName: 'Kabras sugar 50kg',
    supplierItemCode: '190035',
    quantity: '2',
    buyUnit: 'bag',
    estimatedUnitPrice: '5000',
  };
  const flour = {
    itemName: 'Flour',
    supplierItemName: null,
    supplierItemCode: null,
    quantity: '3',
    buyUnit: 'bag',
    estimatedUnitPrice: '150',
  };

  it('LPO lines lead with their name and code, ours second', () => {
    const { lpo } = buildPurchaseDocument(base([sugar]));
    expect(lpo.lines[0]).toMatchObject({
      displayName: 'Kabras sugar 50kg',
      displayCode: '190035',
      ourItemLabel: 'Our item: Sugar white',
      itemName: 'Sugar white',
      lineTotal: '10000.00',
    });
  });

  it('falls back to our name (no "Our item" line) when they have no name', () => {
    const { lpo, whatsapp } = buildPurchaseDocument(base([flour]));
    expect(lpo.lines[0]).toMatchObject({ displayName: 'Flour', displayCode: null, ourItemLabel: null });
    expect(whatsapp.body).toContain('1. Flour — 3 bag');
    expect(whatsapp.body).not.toContain('Our item');
  });

  it('treats a blank supplier name as missing', () => {
    const { lpo } = buildPurchaseDocument(base([{ ...flour, supplierItemName: '  ', supplierItemCode: ' ' }]));
    expect(lpo.lines[0]?.displayName).toBe('Flour');
  });

  it('WhatsApp body: supplier name + code first, "Our item" second, no prices', () => {
    const { whatsapp } = buildPurchaseDocument(base([sugar, flour]));
    expect(whatsapp.body).toBe(
      [
        'Hello Asha, order EXP-0091:',
        '1. Kabras sugar 50kg (190035) — 2 bag',
        '   Our item: Sugar white',
        '2. Flour — 3 bag',
        'Needed by 2026-10-05.',
        'Please confirm availability. Thank you.',
      ].join('\n'),
    );
    expect(whatsapp.body).not.toMatch(/5000|10000|150\b/);
    expect(whatsapp.to).toBe('0712000222');
  });

  it('sends to the phone when there is no WhatsApp number', () => {
    const input = base([flour]);
    input.supplier.whatsapp = null;
    expect(buildPurchaseDocument(input).whatsapp.to).toBe('0712000111');
  });
});
