import { describe, expect, it } from 'vitest';
import fixtures from './permissions-contract.fixtures.json';
import type { PermissionsMe } from './permissions-contract';

/** Drift guard for the hand-written mirror: the shared samples are typed with the mirror type and their key sets are pinned. */
describe('permissions payload mirror', () => {
  it('keys, and the department role', () => {
    const head = fixtures.permissionsMeHead as PermissionsMe;
    expect(Object.keys(head).sort()).toEqual(['capabilities', 'departments', 'isDepartmentHead', 'role']);
    expect(Object.keys(head.departments[0]!).sort()).toEqual(['id', 'name', 'role']);
    expect(head.departments[0]!.role).toBe('HEAD');
    expect((fixtures.permissionsMeMember as PermissionsMe).departments[0]!.role).toBe('MEMBER');
    expect((fixtures.permissionsMeStoreManager as PermissionsMe).departments).toEqual([]);
  });
});
