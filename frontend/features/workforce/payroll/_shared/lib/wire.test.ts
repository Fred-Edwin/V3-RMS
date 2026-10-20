import { describe, expect, it } from 'vitest';

import { fromWire } from './wire';

describe('reading the wire: organization names become site names', () => {
  it('renames the five wire names at every depth, in objects and in arrays', () => {
    const wire = { organizations: [{ organizationId: 'a', organizationName: 'Nyeri Town', people: 3 }], organization: { organizationIds: ['a', 'b'] } };
    expect(fromWire(wire)).toEqual({ sites: [{ siteId: 'a', siteName: 'Nyeri Town', people: 3 }], site: { siteIds: ['a', 'b'] } });
  });

  it('leaves values, nulls and other keys alone', () => {
    expect(fromWire({ name: 'organization', gone: null, count: 2 })).toEqual({ name: 'organization', gone: null, count: 2 });
    expect(fromWire(null)).toBeNull();
    expect(fromWire('x')).toBe('x');
  });
});
