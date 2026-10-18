import { describe, expect, it } from 'vitest';

import { departmentNameError, toCreateBody, toUpdateBody } from './department-forms';

describe('department forms', () => {
  it('needs a name of up to 60 letters', () => {
    expect(departmentNameError('  ')).toBe('Give the department a name.');
    expect(departmentNameError('x'.repeat(61))).toBe('Keep the name under 60 letters.');
    expect(departmentNameError('Bakery')).toBeUndefined();
  });
  it('trims the name and sends the site as siteId', () => {
    expect(toCreateBody(' Bakery ', 's1', ['p1'])).toEqual({ siteId: 's1', name: 'Bakery', positionIds: ['p1'] });
  });
  it('sends only what changed, and null when nothing did', () => {
    const before = { name: 'Kitchen', description: null, positionIds: ['a', 'b'] };
    expect(toUpdateBody(before, { name: 'Kitchen', description: '', positionIds: ['b', 'a'] })).toBeNull();
    expect(toUpdateBody(before, { name: 'Kitchen 2', description: 'Hot food', positionIds: ['a'] })).toEqual({ name: 'Kitchen 2', description: 'Hot food', positionIds: ['a'] });
    expect(toUpdateBody({ ...before, description: 'Old' }, { name: 'Kitchen', description: '', positionIds: ['a', 'b'] })).toEqual({ description: null });
  });
});
