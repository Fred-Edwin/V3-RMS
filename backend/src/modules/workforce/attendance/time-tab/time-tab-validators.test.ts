import { describe, expect, it } from 'vitest';
import { timeMonthQuerySchema, timeTilesQuerySchema } from './time-tab-validators';

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';

describe('the Time tab queries', () => {
  it('fills in the filter, page and page size', () => {
    expect(timeMonthQuerySchema.parse({ employeeId: id, month: '2026-10' })).toEqual({ employeeId: id, month: '2026-10', filter: 'all', page: 1, pageSize: 10 });
  });

  it('reads the filter, page and page size from the query string', () => {
    expect(timeMonthQuerySchema.parse({ employeeId: id, month: '2026-10', filter: 'late', page: '2', pageSize: '25' })).toMatchObject({ filter: 'late', page: 2, pageSize: 25 });
  });

  it.each([
    { month: '2026-13' },
    { month: '2026-1' },
    { month: '2026-10', filter: 'everything' },
    { month: '2026-10', page: '0' },
    { month: '2026-10', pageSize: '7' },
    { month: '2026-10', extra: 'x' },
  ])('refuses %j', (bad) => {
    expect(timeMonthQuerySchema.safeParse({ employeeId: id, ...bad }).success).toBe(false);
  });

  it('needs a real person id', () => {
    expect(timeMonthQuerySchema.safeParse({ employeeId: 'nope', month: '2026-10' }).success).toBe(false);
    expect(timeTilesQuerySchema.safeParse({ employeeId: 'nope' }).success).toBe(false);
    expect(timeTilesQuerySchema.safeParse({ employeeId: id }).success).toBe(true);
  });
});
