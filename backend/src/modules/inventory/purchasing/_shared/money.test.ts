import { describe, expect, it } from 'vitest';
import {
  advanceCredit,
  ageingBucketOf,
  deliveredTotal,
  dueDateOf,
  invoiceFigures,
  lineResultOf,
  notSuppliedTotal,
  orderedTotal,
  paidTotal,
  priceMovePercent,
  suggestedQty,
  toMoney,
  toQty,
  varianceOf,
  type PaymentFacts,
} from './money';

const advance = (amount: string, status: PaymentFacts['status'] = 'RECORDED'): PaymentFacts => ({ kind: 'ADVANCE', status, amount });
const paid = (amount: string, status: PaymentFacts['status'] = 'RECORDED'): PaymentFacts => ({ kind: 'INVOICE', status, amount });
const reversal = (amount: string): PaymentFacts => ({ kind: 'REVERSAL', status: 'RECORDED', amount });

// The Paper example (LPO-0044): 82 kg sugar at 168, 4 jerricans at 2,340, 2 boxes margarine at 2,890, 2 pouches yeast at 610.
const lines = [
  { orderedQty: '82', unitPrice: '168', receivedQty: '82', confirmedPrice: '168' },
  { orderedQty: '4', unitPrice: '2340', receivedQty: '4', confirmedPrice: '2400' },
  { orderedQty: '2', unitPrice: '2890', receivedQty: '1', confirmedPrice: '2890' },
  { orderedQty: '2', unitPrice: '610', receivedQty: '2', confirmedPrice: '610' },
];

describe('totals', () => {
  it('adds the ordered value', () => {
    expect(toMoney(orderedTotal(lines))).toBe('30136.00');
  });
  it('values the delivery at the confirmed price and after dropped quantity', () => {
    expect(toMoney(deliveredTotal(lines))).toBe('27486.00');
  });
  it('values what was not supplied at the order price', () => {
    expect(toMoney(notSuppliedTotal(lines))).toBe('2890.00');
  });
});

describe('line result', () => {
  it('names the four outcomes', () => {
    expect(lineResultOf('4', '0', false)).toBe('NOT_SUPPLIED');
    expect(lineResultOf('4', '3', true)).toBe('SHORT');
    expect(lineResultOf('4', '4', true)).toBe('PRICE_CHANGED');
    expect(lineResultOf('4', '4', false)).toBe('AS_ORDERED');
  });
});

describe('invoice figures', () => {
  it('applies the advance and leaves the balance', () => {
    const f = invoiceFigures('27986', [advance('10000')], false);
    expect(toMoney(f.advanceApplied)).toBe('10000.00');
    expect(toMoney(f.balance)).toBe('17986.00');
    expect(f.paidInFull).toBe(false);
  });
  it('caps the applied advance at the invoice and keeps the rest as credit', () => {
    const f = invoiceFigures('8000', [advance('10000')], false);
    expect(toMoney(f.advanceApplied)).toBe('8000.00');
    expect(f.paidInFull).toBe(true);
    expect(toMoney(advanceCredit('8000', [advance('10000')]))).toBe('2000.00');
  });
  it('closes only when the payments clear the balance', () => {
    expect(invoiceFigures('1000', [paid('400')], false).paidInFull).toBe(false);
    expect(invoiceFigures('1000', [paid('400'), paid('600')], false).paidInFull).toBe(true);
  });
  it('never calls a disputed invoice paid in full', () => {
    expect(invoiceFigures('1000', [paid('1000')], true).paidInFull).toBe(false);
  });
  it('ignores a reversed payment and its reversal line', () => {
    const pays = [paid('17986', 'REVERSED'), reversal('-17986')];
    expect(toMoney(invoiceFigures('27986', [advance('10000'), ...pays], false).balance)).toBe('17986.00');
    expect(toMoney(paidTotal([advance('10000'), ...pays]))).toBe('10000.00');
  });
});

describe('variance and dates', () => {
  it('is positive when the supplier charged more', () => {
    expect(varianceOf('27986', '27486')).toMatchObject({ differs: true });
    expect(toMoney(varianceOf('27986', '27486').amount)).toBe('500.00');
  });
  it('is not a variance when the figures match', () => {
    expect(varianceOf('27486.00', '27486').differs).toBe(false);
  });
  it('treats a lower invoice as a variance too', () => {
    expect(toMoney(varianceOf('27000', '27486').amount)).toBe('-486.00');
  });
  it('adds the supplier’s terms to the invoice date', () => {
    expect(dueDateOf('2026-09-30', 14)).toBe('2026-10-14');
    expect(dueDateOf('2026-09-30', null)).toBe('2026-09-30');
  });
});

describe('suggested quantity and flags', () => {
  it('rounds up to whole buy units (Paper’s figures)', () => {
    expect(suggestedQty('100', '18', '1')).toBe(82);
    expect(suggestedQty('40', '0', '10')).toBe(4);
    expect(suggestedQty('14', '0', '10')).toBe(2);
    expect(suggestedQty('38', '0', '24')).toBe(2);
    expect(suggestedQty('22', '0', '5')).toBe(5);
  });
  it('has no suggestion for an item never bought', () => {
    expect(suggestedQty('10', '0', null)).toBeNull();
  });
  it('flags a price move against the last order', () => {
    expect(priceMovePercent('2433.6', '2340')).toBe(4);
    expect(priceMovePercent('100', null)).toBeNull();
  });
  it('buckets days past due', () => {
    expect([0, -3, 1, 30, 31, 60, 61, 90, 91].map(ageingBucketOf)).toEqual(['current', 'current', 'days1to30', 'days1to30', 'days31to60', 'days31to60', 'days61to90', 'days61to90', 'days90plus']);
  });
  it('formats money and quantities for the wire', () => {
    expect(toMoney('13776')).toBe('13776.00');
    expect(toQty('82.000')).toBe('82');
  });
});
