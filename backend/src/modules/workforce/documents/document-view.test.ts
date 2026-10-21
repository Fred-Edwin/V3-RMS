import { describe, expect, it } from 'vitest';
import { siteOptionsFor } from './document-view';

describe('the index Site filter', () => {
  const sites = [{ id: 'a', name: 'Nyeri Town' }, { id: 'b', name: 'Highway' }];
  it('lists every site to a reader who reads a type across the company', () => {
    expect(siteOptionsFor([{ siteId: 'a' }, { siteId: null }], sites)).toEqual(sites);
  });
  it('lists none to a reader limited to one site', () => {
    expect(siteOptionsFor([{ siteId: 'a' }], sites)).toEqual([]);
    expect(siteOptionsFor([], sites)).toEqual([]);
  });
});
