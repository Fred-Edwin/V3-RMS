import { describe, expect, it } from 'vitest';
import { blindnessOf, withoutCountFigures, withoutFinancials, withoutStockFigures } from './blind-rule';
import { COUNT_STOCK_FIGURE_KEYS } from '../counting/_shared/counting-contract';

const attendant = { role: 'STORE_ATTENDANT' as const };
const storeManager = { role: 'STORE_MANAGER' as const };
const accountant = { role: 'ACCOUNTANT' as const };
const departmentHead = { role: 'CHEF' as const };

describe('blindnessOf (the one blind rule, 6 Oct 2026)', () => {
  it('blinds the Store Attendant to stock figures and financial data, not to item costs', () => {
    expect(blindnessOf(attendant)).toEqual({ stockFigures: true, financials: true, itemCosts: false });
  });

  it('blinds nobody on the Store Manager', () => {
    expect(blindnessOf(storeManager)).toEqual({ stockFigures: false, financials: false, itemCosts: false });
  });

  it('keeps the Accountant seeing money and stock figures', () => {
    expect(blindnessOf(accountant)).toEqual({ stockFigures: false, financials: false, itemCosts: false });
  });

  it('blinds a role with no Central Store capabilities (a department head) to all three', () => {
    expect(blindnessOf(departmentHead)).toEqual({ stockFigures: true, financials: true, itemCosts: true });
  });
});

describe('withoutStockFigures / withoutFinancials', () => {
  const row = { name: 'Sugar', currentCost: '178', centralStoreRestockLevel: '10', daysOfCover: '7', centralStoreOnHand: '42', amountOwed: '900', invoices: [] };

  it('removes stock figures for the Attendant and keeps the cost', () => {
    const out = withoutStockFigures(attendant, row);
    expect(out).not.toHaveProperty('centralStoreRestockLevel');
    expect(out).not.toHaveProperty('daysOfCover');
    expect(out).not.toHaveProperty('centralStoreOnHand');
    expect(out).toHaveProperty('currentCost', '178');
  });

  it('removes financial keys for the Attendant and keeps stock-free fields', () => {
    const out = withoutFinancials(attendant, row);
    expect(out).not.toHaveProperty('amountOwed');
    expect(out).not.toHaveProperty('invoices');
    expect(out).toHaveProperty('name', 'Sugar');
  });

  it('returns the object untouched for a role that may see it', () => {
    expect(withoutStockFigures(storeManager, row)).toBe(row);
    expect(withoutFinancials(accountant, row)).toBe(row);
  });
});

describe('withoutCountFigures', () => {
  const figures = Object.fromEntries(COUNT_STOCK_FIGURE_KEYS.map((key) => [key, 'x']));
  const count = {
    reference: 'CNT-2026-0001',
    ...figures,
    lines: [{ itemName: 'Sugar', countedQty: '4', unitCost: '178', ...figures }, { itemName: 'Milk', countedQty: '2', nested: { ...figures, keep: 1 } }],
    startedAt: new Date('2026-10-08T07:00:00Z'),
  };

  it('removes every count figure key at any depth for the Attendant and keeps the rest (dates stay dates)', () => {
    const out = withoutCountFigures(attendant, count);
    expect(JSON.stringify(out)).not.toMatch(new RegExp(`"(${COUNT_STOCK_FIGURE_KEYS.join('|')})"`));
    expect(out.lines[0]).toEqual({ itemName: 'Sugar', countedQty: '4', unitCost: '178' });
    expect(out.lines[1]).toMatchObject({ itemName: 'Milk', nested: { keep: 1 } });
    expect(out.reference).toBe('CNT-2026-0001');
    expect(out.startedAt).toBeInstanceOf(Date);
  });

  it('does not change what it was given', () => {
    withoutCountFigures(attendant, count);
    expect(count).toHaveProperty('expectedQty');
  });

  it('returns the object untouched for a role that sees stock figures', () => {
    expect(withoutCountFigures(storeManager, count)).toBe(count);
    expect(withoutCountFigures(accountant, count)).toBe(count);
  });
});
