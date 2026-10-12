import { addCarrierInputSchema, cleanCarrierName } from './dispatch-contract';

describe('carrier names', () => {
  it('drops a stray leading "··" and spaces', () => {
    expect(cleanCarrierName('··  Wendo van KCB 214K')).toBe('Wendo van KCB 214K');
    expect(cleanCarrierName(' - Joseph Kamau ')).toBe('Joseph Kamau');
  });

  it('keeps the middle of a name alone', () => {
    expect(cleanCarrierName('Wendo van · KCB 214K')).toBe('Wendo van · KCB 214K');
  });

  it('cleans before the length check on add', () => {
    expect(addCarrierInputSchema.parse({ name: '··Van A', kind: 'VEHICLE' }).name).toBe('Van A');
    expect(addCarrierInputSchema.safeParse({ name: '·· ·', kind: 'VEHICLE' }).success).toBe(false);
  });
});
