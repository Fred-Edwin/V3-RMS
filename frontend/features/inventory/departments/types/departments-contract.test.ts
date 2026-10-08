import { describe, expect, it } from 'vitest';
import fixtures from './departments-contract.fixtures.json';
import type { DepartmentRow, ListDepartments } from './departments-contract';

const keysOf = (o: object): string[] => Object.keys(o).sort();

describe('departments contract mirror', () => {
  it('row keys', () => {
    const row = (fixtures.listDepartmentsManager as ListDepartments).rows[0] as DepartmentRow;
    expect(keysOf(row)).toEqual(['branchId', 'can', 'head', 'id', 'itemsTagged', 'key', 'name', 'position', 'retiredAt', 'status']);
    expect(keysOf(row.can)).toEqual(['rename', 'restore', 'retire']);
  });

  it('an added department has no key; hub roles get the branch picker', () => {
    expect((fixtures.listDepartmentsManager as ListDepartments).rows[1]!.key).toBeNull();
    expect(keysOf(fixtures.listDepartmentsDirector as ListDepartments)).toContain('branches');
    expect(keysOf(fixtures.listDepartmentsManager as ListDepartments)).not.toContain('branches');
  });
});
