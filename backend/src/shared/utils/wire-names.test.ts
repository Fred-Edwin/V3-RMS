import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { fromWire, keyToWire, toWire } from './wire-names';

describe('wire-names', () => {
  it('toWire turns code names into the names the API has always sent', () => {
    expect(
      toWire({ siteId: 'a', siteName: 'Nyeri Town', site: { id: 'a', name: 'Nyeri Town' }, toSiteId: 'b' }),
    ).toEqual({
      organizationId: 'a',
      organizationName: 'Nyeri Town',
      organization: { id: 'a', name: 'Nyeri Town' },
      toOrganizationId: 'b',
    });
  });

  it('fromWire turns wire names into code names', () => {
    expect(fromWire({ organizationId: 'a', organization: { id: 'a' }, organizationIds: ['a', 'b'] })).toEqual({
      siteId: 'a',
      site: { id: 'a' },
      siteIds: ['a', 'b'],
    });
  });

  it('walks nested arrays and objects', () => {
    expect(toWire({ data: [{ rows: [{ siteId: 'a' }] }] })).toEqual({
      data: [{ rows: [{ organizationId: 'a' }] }],
    });
  });

  it('is safe on data that is already translated (old cache entries, queued jobs)', () => {
    const old = { organizationId: 'a', organization: { name: 'x' } };
    expect(toWire(old)).toEqual(old);
    expect(fromWire({ siteId: 'a' })).toEqual({ siteId: 'a' });
  });

  it('leaves dates, decimals, primitives and unknown keys alone', () => {
    const when = new Date('2026-10-04T00:00:00.000Z');
    const amount = new Prisma.Decimal('12.50');
    const out = toWire({ when, amount, count: 3, name: 'x', website: 'w', siteId: null });

    expect(out.when).toBe(when);
    expect(out.amount).toBe(amount);
    expect(out).toEqual({ when, amount, count: 3, name: 'x', website: 'w', organizationId: null });
  });

  it('does not touch values, only keys', () => {
    expect(toWire({ note: 'siteId and site', siteId: 'siteId' })).toEqual({
      note: 'siteId and site',
      organizationId: 'siteId',
    });
  });

  it('keyToWire maps one key', () => {
    expect(keyToWire('siteId')).toBe('organizationId');
    expect(keyToWire('anything')).toBe('anything');
  });
});
