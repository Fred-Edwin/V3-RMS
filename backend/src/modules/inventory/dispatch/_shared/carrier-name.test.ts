import { addCarrierInputSchema, cleanCarrierName, signDispatchInputSchema } from './dispatch-contract';

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

describe('the carrier choice at the final sign', () => {
  const base = { pin: '4821', idempotencyKey: 'key-0001-sign' };
  const id = '11111111-1111-4111-8111-111111111111';

  it('takes a carrier or a staff member, exactly one', () => {
    expect(signDispatchInputSchema.safeParse({ ...base, carrierId: id }).success).toBe(true);
    expect(signDispatchInputSchema.safeParse({ ...base, carrierUserId: id }).success).toBe(true);
    expect(signDispatchInputSchema.safeParse(base).success).toBe(false);
    expect(signDispatchInputSchema.safeParse({ ...base, carrierId: id, carrierUserId: id }).success).toBe(false);
  });
});
