import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { computePaymentBreakdown } from './report-repository';

describe('computePaymentBreakdown', () => {
  it('allocates guest split lines to their actual payment methods', () => {
    const value = computePaymentBreakdown([
      {
        paymentMethod: 'GUEST_SPLIT',
        total: new Prisma.Decimal('1500.00'),
        mpesaAmount: null,
        cashAmount: null,
        cardAmount: null,
        splitType: null,
        splitPaymentLines: [
          { method: 'MPESA', amount: new Prisma.Decimal('700.00') },
          { method: 'CASH', amount: new Prisma.Decimal('500.00') },
          { method: 'CARD', amount: new Prisma.Decimal('300.00') },
        ],
      },
    ]);

    expect(value).toEqual({
      mpesa: '700.00',
      cash: '500.00',
      card: '300.00',
      houseAccount: '0.00',
      corporateAccount: '0.00',
      customerCredit: '0.00',
      total: '1500.00',
    });
  });
});
