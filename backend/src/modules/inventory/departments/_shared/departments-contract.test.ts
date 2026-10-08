/**
 * Contract drift guard for Departments as data: fixtures parse, bad inputs are refused, the front end's copy is identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './departments-contract.fixtures.json';
import {
  addDepartmentInputSchema,
  departmentRowSchema,
  listDepartmentsQuerySchema,
  listDepartmentsSchema,
  renameDepartmentInputSchema,
  DEPARTMENT_ERROR_CODES,
} from './departments-contract';
import { errorBodySchema } from '../../requisitions/_shared/requisitions-contract';

const F = fixtures as Record<string, unknown>;

describe('departments contract fixtures', () => {
  it.each([
    ['listDepartmentsManager', listDepartmentsSchema],
    ['listDepartmentsDirector', listDepartmentsSchema],
    ['addDepartmentInput', addDepartmentInputSchema],
    ['addDepartmentResult', departmentRowSchema],
    ['renameDepartmentInput', renameDepartmentInputSchema],
    ['errorNameTaken', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('the error fixture uses a listed code', () => {
    expect(DEPARTMENT_ERROR_CODES as readonly string[]).toContain(fixtures.errorNameTaken.error.code);
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'departments-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../../frontend/features/inventory/departments/types/departments-contract.fixtures.json'), 'utf8');
    expect(theirs).toBe(mine);
  });
});

describe('shapes that matter', () => {
  it('an added department has no enum key; an original has one', () => {
    const rows = fixtures.listDepartmentsManager.rows;
    expect(rows[0]!.key).toBe('KITCHEN');
    expect(rows[1]!.key).toBeNull();
  });

  it('a read-only caller sees no write flags and cannot add', () => {
    expect(fixtures.listDepartmentsDirector.canAdd).toBe(false);
    expect(fixtures.listDepartmentsDirector.rows[0]!.can).toEqual({ rename: false, retire: false, restore: false });
  });
});

describe('inputs that must be refused', () => {
  it('a name is 1 to 40 characters and the body is strict', () => {
    expect(renameDepartmentInputSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(renameDepartmentInputSchema.safeParse({ name: 'x'.repeat(41) }).success).toBe(false);
    expect(addDepartmentInputSchema.safeParse({ ...fixtures.addDepartmentInput, key: 'KITCHEN' }).success).toBe(false);
  });

  it('the branch is optional on the list query', () => {
    expect(listDepartmentsQuerySchema.safeParse({}).success).toBe(true);
    expect(listDepartmentsQuerySchema.safeParse({ branchId: 'nope' }).success).toBe(false);
  });
});
