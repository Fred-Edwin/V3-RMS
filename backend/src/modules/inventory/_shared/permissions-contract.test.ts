/** Contract drift guard for the permissions payload: the shared samples parse, and the front end's copy of the fixtures is identical. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './permissions-contract.fixtures.json';
import { permissionsMeSchema } from './permissions-contract';

describe('permissions payload contract', () => {
  it.each(['permissionsMeHead', 'permissionsMeMember', 'permissionsMeStoreManager'] as const)('%s parses', (name) => {
    const result = permissionsMeSchema.safeParse(fixtures[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('carries the departments and whether the person heads or belongs to each; a desktop role has none', () => {
    expect(fixtures.permissionsMeHead.departments[0]!.role).toBe('HEAD');
    expect(fixtures.permissionsMeMember.departments[0]!.role).toBe('MEMBER');
    expect(fixtures.permissionsMeStoreManager.departments).toEqual([]);
  });

  it('refuses a department without a role or a capability that does not exist', () => {
    expect(permissionsMeSchema.safeParse({ ...fixtures.permissionsMeHead, departments: [{ id: fixtures.permissionsMeHead.departments[0]!.id, name: 'Barista' }] }).success).toBe(false);
    expect(permissionsMeSchema.safeParse({ ...fixtures.permissionsMeHead, capabilities: ['dispatch.fly'] }).success).toBe(false);
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'permissions-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../frontend/features/inventory/_shared/types/permissions-contract.fixtures.json'), 'utf8');
    expect(theirs).toBe(mine);
  });
});
