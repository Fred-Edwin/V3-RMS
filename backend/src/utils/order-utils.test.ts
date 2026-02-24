import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildPrepTicketItemsSnapshot,
  calculateOrderTotals,
  deriveOrderStatus,
  deriveStationsFromItems,
} from './order-utils';

describe('order-utils', () => {
  describe('calculateOrderTotals', () => {
    it('calculates subtotal and total with delivery fee', () => {
      const result = calculateOrderTotals(
        [
          { quantity: 2, unitPrice: new Prisma.Decimal('100.00') },
          { quantity: 1, unitPrice: new Prisma.Decimal('50.00') },
        ],
        new Prisma.Decimal('25.00'),
      );

      expect(result.subtotal.toString()).toBe('250');
      expect(result.total.toString()).toBe('275');
    });

    it('returns total equal to subtotal when delivery fee is zero', () => {
      const result = calculateOrderTotals(
        [{ quantity: 3, unitPrice: new Prisma.Decimal('80.00') }],
        new Prisma.Decimal('0'),
      );

      expect(result.subtotal.toString()).toBe('240');
      expect(result.total.toString()).toBe('240');
    });
  });

  describe('deriveStationsFromItems', () => {
    it('returns unique stations', () => {
      const stations = deriveStationsFromItems([
        { category: { prepStation: 'KITCHEN' } },
        { category: { prepStation: 'KITCHEN' } },
        { category: { prepStation: 'BARISTA' } },
      ]);

      expect(stations).toEqual(['KITCHEN', 'BARISTA']);
    });
  });

  describe('buildPrepTicketItemsSnapshot', () => {
    it('builds station-specific snapshot', () => {
      const snapshot = buildPrepTicketItemsSnapshot(
        [
          {
            name: 'Burger',
            quantity: 1,
            notes: null,
            category: { prepStation: 'KITCHEN' },
          },
          {
            name: 'Latte',
            quantity: 2,
            notes: 'Extra hot',
            category: { prepStation: 'BARISTA' },
          },
        ],
        'BARISTA',
      );

      expect(snapshot).toEqual([{ name: 'Latte', quantity: 2, notes: 'Extra hot' }]);
    });
  });

  describe('deriveOrderStatus', () => {
    it('returns pending when all tickets are pending', () => {
      expect(
        deriveOrderStatus([
          { status: 'PENDING' },
          { status: 'PENDING' },
        ]),
      ).toBe('PENDING');
    });

    it('returns in progress when one ticket has started', () => {
      expect(
        deriveOrderStatus([
          { status: 'PENDING' },
          { status: 'IN_PROGRESS' },
        ]),
      ).toBe('IN_PROGRESS');
    });

    it('returns ready when all tickets are ready', () => {
      expect(
        deriveOrderStatus([
          { status: 'READY' },
          { status: 'READY' },
        ]),
      ).toBe('READY');
    });
  });
});
